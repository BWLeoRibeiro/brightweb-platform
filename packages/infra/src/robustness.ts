export type PublicError = {
  code: string;
  message: string;
};

export type PublicErrorEnvelope = {
  error: PublicError;
};

export const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";
export const MAX_BULK_OPERATION_IDS = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function publicError(code: string, message: string): PublicErrorEnvelope {
  return { error: { code, message } };
}

export function readPublicError(payload: unknown, fallback: string): PublicError {
  if (
    typeof payload === "object"
    && payload !== null
    && !Array.isArray(payload)
    && typeof (payload as { error?: unknown }).error === "object"
    && (payload as { error: unknown }).error !== null
    && !Array.isArray((payload as { error: unknown }).error)
  ) {
    const error = (payload as { error: Record<string, unknown> }).error;
    if (typeof error.code === "string" && error.code && typeof error.message === "string" && error.message) {
      return { code: error.code, message: error.message };
    }
  }

  return { code: INTERNAL_ERROR_CODE, message: fallback };
}

export function sanitizePublicError(
  error: unknown,
  knownErrors: Readonly<Record<string, PublicError>>,
  fallbackMessage: string,
  context: string,
): PublicErrorEnvelope {
  const internalMessage = error instanceof Error ? error.message : String(error);
  const known = knownErrors[internalMessage];
  if (known) return { error: known };

  console.error(`[${context}]`, error);
  return publicError(INTERNAL_ERROR_CODE, fallbackMessage);
}

export type BoundedUuidBatch =
  | { ok: true; ids: string[] }
  | { ok: false; code: "BATCH_REQUIRED" | "BATCH_TOO_LARGE" | "INVALID_UUID"; invalidIds?: string[] };

export function validateBoundedUuidBatch(value: unknown): BoundedUuidBatch {
  if (!Array.isArray(value)) return { ok: false, code: "BATCH_REQUIRED" };
  if (value.length === 0) return { ok: false, code: "BATCH_REQUIRED" };
  if (value.length > MAX_BULK_OPERATION_IDS) return { ok: false, code: "BATCH_TOO_LARGE" };

  const containsInvalidType = value.some((item) => typeof item !== "string" || item.trim().length === 0);
  const ids = Array.from(new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())));

  const invalidIds = ids.filter((id) => !UUID_PATTERN.test(id));
  return containsInvalidType || invalidIds.length > 0
    ? { ok: false, code: "INVALID_UUID", invalidIds }
    : { ok: true, ids };
}
