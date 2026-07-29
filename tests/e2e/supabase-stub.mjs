// Minimal in-process Supabase emulator (node:http) for the generated-app runtime
// smoke test. Emulates just enough of GoTrue (/auth/v1) and PostgREST (/rest/v1)
// for a generated platform app to sign in and render its data-backed surfaces.
//
// Emulated surface:
// - POST /auth/v1/token?grant_type=password|refresh_token  -> session with an
//   HS256-signed JWT (syntactically valid; nothing validates it locally).
// - GET  /auth/v1/user  -> the authority. core-auth's requireServerUserAccess /
//   getServerAccess call supabase.auth.getUser() on every request; the stub only
//   accepts access tokens it issued, so a broken cookie/token pipeline fails here.
// - GET/HEAD/POST /rest/v1/:table  -> canned rows from fixtures.mjs. `head:true`
//   count queries arrive as HEAD requests and are answered with an empty body and
//   a real Content-Range. Only `eq.` / `is.null` filters are applied; all other
//   operators are ignored (rows pass through), which keeps counts deterministic.
// - POST/GET /rest/v1/rpc/current_global_role -> "admin" (the only RPC on the
//   generated app's read path; see packages/core-auth/src/server.ts).
// - Anything else -> 404 plus a log line, so contract gaps are diagnosable.

import { createHmac } from "node:crypto";
import http from "node:http";
import { rpcResults, tables, USER_EMAIL, USER_ID } from "./fixtures.mjs";

const JWT_SECRET = "smoke-test-jwt-secret";
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24; // long-lived: keep auth-js from refreshing mid-run

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");

function signAccessToken(nowSeconds) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: "supabase-stub",
      sub: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: USER_EMAIL,
      iat: nowSeconds,
      exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
      session_id: "99999999-9999-4999-8999-999999999999",
    }),
  );
  const signature = b64url(createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

function buildUser() {
  const timestamp = new Date().toISOString();
  return {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: USER_EMAIL,
    email_confirmed_at: timestamp,
    phone: "",
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function sendJson(response, status, body, extraHeaders = {}) {
  const serialized = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(serialized),
    ...extraHeaders,
  });
  response.end(serialized);
}

// Apply only the deterministic subset of PostgREST filters: `column=eq.value`
// and `column=is.null`. Everything else (neq, gte, lte, lt, in, not.*, or,
// embedded-table params, order, ...) intentionally passes rows through.
const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "apikey", "or", "and"]);

function filterRows(rows, searchParams) {
  let filtered = rows;
  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_PARAMS.has(key) || key.includes(".")) continue;
    if (value.startsWith("eq.")) {
      const expected = value.slice(3);
      filtered = filtered.filter((row) => String(row[key]) === expected);
    } else if (value === "is.null") {
      filtered = filtered.filter((row) => row[key] === null || row[key] === undefined);
    }
  }
  return filtered;
}

function paginate(rows, searchParams) {
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw === null ? null : Number.parseInt(limitRaw, 10);
  const sliced = rows.slice(offset);
  return Number.isInteger(limit) && limit >= 0 ? sliced.slice(0, limit) : sliced;
}

function contentRange(pageLength, total, offset = 0) {
  const range = pageLength > 0 ? `${offset}-${offset + pageLength - 1}` : "*";
  return `${range}/${total}`;
}

export async function startSupabaseStub({ log = () => {} } = {}) {
  const issuedTokens = new Set();
  const stats = { headRequestsByTable: new Map(), unhandled: [] };

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://stub.local");
    const { pathname } = url;
    const method = request.method ?? "GET";

    // ---- GoTrue -----------------------------------------------------------
    if (method === "POST" && pathname === "/auth/v1/token") {
      const grantType = url.searchParams.get("grant_type");
      if (grantType !== "password" && grantType !== "refresh_token") {
        stats.unhandled.push(`${method} ${request.url}`);
        return sendJson(response, 400, { error: "unsupported_grant_type" });
      }
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        void body;
        const nowSeconds = Math.floor(Date.now() / 1000);
        const accessToken = signAccessToken(nowSeconds);
        issuedTokens.add(accessToken);
        log(`auth: issued token via grant_type=${grantType}`);
        sendJson(response, 200, {
          access_token: accessToken,
          token_type: "bearer",
          expires_in: TOKEN_LIFETIME_SECONDS,
          expires_at: nowSeconds + TOKEN_LIFETIME_SECONDS,
          refresh_token: `smoke-refresh-${nowSeconds}`,
          user: buildUser(),
        });
      });
      return undefined;
    }

    if (method === "GET" && pathname === "/auth/v1/user") {
      const authorization = request.headers.authorization ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
      if (!token || !issuedTokens.has(token)) {
        log(`auth: rejected /auth/v1/user (unknown token: ${token ? `${token.slice(0, 16)}...` : "none"})`);
        return sendJson(response, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      }
      return sendJson(response, 200, buildUser());
    }

    // ---- PostgREST --------------------------------------------------------
    const restMatch = pathname.match(/^\/rest\/v1\/([^/]+)$/u);
    if (restMatch) {
      const resource = decodeURIComponent(restMatch[1]);

      if (resource === "rpc") {
        stats.unhandled.push(`${method} ${request.url}`);
        log(`stub 404: ${method} ${request.url}`);
        return sendJson(response, 404, { message: `Unhandled RPC route: ${request.url}` });
      }

      const rows = tables[resource];
      if (rows === undefined) {
        stats.unhandled.push(`${method} ${request.url}`);
        log(`stub 404: unknown table "${resource}" (${method} ${request.url})`);
        return sendJson(response, 404, {
          code: "PGRST205",
          message: `Could not find the table 'public.${resource}' in the schema cache`,
        });
      }

      const filtered = filterRows(rows, url.searchParams);

      if (method === "HEAD") {
        stats.headRequestsByTable.set(resource, (stats.headRequestsByTable.get(resource) ?? 0) + 1);
        log(`rest: HEAD ${resource} -> count ${filtered.length}`);
        response.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "content-range": contentRange(Math.min(filtered.length, 25), filtered.length),
        });
        return response.end();
      }

      if (method === "GET" || method === "POST") {
        // POST on a table (inserts) is accepted leniently and echoes the fixtures;
        // the read-path smoke test never mutates, but auth-adjacent probes may POST.
        const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
        const page = paginate(filtered, url.searchParams);
        const accept = request.headers.accept ?? "";
        log(`rest: ${method} ${resource} -> ${page.length}/${filtered.length} rows`);

        if (accept.includes("application/vnd.pgrst.object+json")) {
          if (page.length === 0) {
            return sendJson(response, 406, {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
              details: "Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row",
            });
          }
          return sendJson(response, 200, page[0], {
            "content-range": contentRange(1, filtered.length, offset),
          });
        }

        return sendJson(response, 200, page, {
          "content-range": contentRange(page.length, filtered.length, offset),
        });
      }
    }

    const rpcMatch = pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/u);
    if (rpcMatch && (method === "POST" || method === "GET" || method === "HEAD")) {
      const rpcName = decodeURIComponent(rpcMatch[1]);
      if (Object.hasOwn(rpcResults, rpcName)) {
        log(`rest: rpc ${rpcName}`);
        // Drain any request body before responding.
        request.resume();
        return sendJson(response, 200, rpcResults[rpcName]);
      }
      stats.unhandled.push(`${method} ${request.url}`);
      log(`stub 404: unhandled RPC "${rpcName}"`);
      return sendJson(response, 404, {
        code: "PGRST202",
        message: `Could not find the function public.${rpcName} in the schema cache`,
      });
    }

    stats.unhandled.push(`${method} ${request.url}`);
    log(`stub 404: ${method} ${request.url}`);
    return sendJson(response, 404, { message: `Unhandled stub route: ${method} ${request.url}` });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    stats,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
