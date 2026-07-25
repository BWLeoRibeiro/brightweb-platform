import {
  publicError,
  sanitizePublicError,
} from "@brightweblabs/infra/robustness";
import type {
  resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
} from "./server";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

type MarketingHttpDependencies = {
  createServiceClient: () => unknown;
  resolveToken: typeof resolveByUnsubscribeToken;
  unsubscribeAll: typeof unsubscribeAll;
  unsubscribeTopic: typeof unsubscribeTopic;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function tokenFromRequest(request: Request, context?: RouteContext) {
  const contextToken = context ? (await context.params).token : null;
  if (contextToken) return contextToken.trim();
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "").trim();
}

function publicResult(
  result: NonNullable<Awaited<ReturnType<typeof resolveByUnsubscribeToken>>>,
) {
  return {
    email: result.email,
    subscriptions: result.subscriptions,
  };
}

function marketingErrorResponse(error: unknown, context: string) {
  return json(
    sanitizePublicError(
      error,
      {},
      "The marketing preference request could not be completed.",
      context,
    ),
    { status: 500 },
  );
}

export function createMarketingUnsubscribeGetHandler(
  dependencies: MarketingHttpDependencies,
) {
  return async (request: Request, context?: RouteContext) => {
    const token = await tokenFromRequest(request, context);
    if (!UUID_PATTERN.test(token)) {
      return json(publicError("INVALID_TOKEN", "The unsubscribe token is invalid."), {
        status: 400,
      });
    }
    try {
      const result = await dependencies.resolveToken(
        dependencies.createServiceClient() as never,
        token,
      );
      return result
        ? json(publicResult(result))
        : json(publicError("TOKEN_NOT_FOUND", "The unsubscribe token was not found."), {
          status: 404,
        });
    } catch (error) {
      return marketingErrorResponse(error, "marketing.unsubscribe.get");
    }
  };
}

export function createMarketingUnsubscribePostHandler(
  dependencies: MarketingHttpDependencies,
) {
  return async (request: Request, context?: RouteContext) => {
    const token = await tokenFromRequest(request, context);
    if (!UUID_PATTERN.test(token)) {
      return json(publicError("INVALID_TOKEN", "The unsubscribe token is invalid."), {
        status: 400,
      });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
    if (
      typeof payload !== "object"
      || payload === null
      || Array.isArray(payload)
    ) {
      return json(publicError("INVALID_INPUT", "The request body must be a JSON object."), {
        status: 400,
      });
    }
    const topicId = (payload as { topicId?: unknown }).topicId;
    if (topicId != null && (typeof topicId !== "string" || !UUID_PATTERN.test(topicId))) {
      return json(publicError("INVALID_TOPIC", "The topic ID is invalid."), {
        status: 400,
      });
    }

    try {
      const serviceClient = dependencies.createServiceClient();
      const result = typeof topicId === "string"
        ? await dependencies.unsubscribeTopic(serviceClient as never, token, topicId)
        : await dependencies.unsubscribeAll(serviceClient as never, token);
      return result
        ? json(publicResult(result))
        : json(publicError("TOKEN_NOT_FOUND", "The unsubscribe token was not found."), {
          status: 404,
        });
    } catch (error) {
      return marketingErrorResponse(error, "marketing.unsubscribe.post");
    }
  };
}
