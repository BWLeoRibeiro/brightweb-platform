import { readPublicError } from "@brightweblabs/infra/robustness";
import { parseAccountProfileResponse } from "./response-parsers";
import type { AccountUiClient } from "./types";

async function readPayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readPublicError(payload, response.statusText || "Account request failed.").message);
  }
  return payload;
}

export function createAccountUiClient(
  basePath = "/api/account",
  fetcher: typeof fetch = fetch,
): AccountUiClient {
  const root = basePath.replace(/\/$/, "");

  return {
    async getProfile() {
      return parseAccountProfileResponse(await readPayload(await fetcher(root)));
    },
    async updateProfile(input) {
      return parseAccountProfileResponse(await readPayload(await fetcher(root, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })));
    },
  };
}
