export type UiRequestOutcome = "completed" | "aborted" | "failed";

export type UiRequestMetric = {
  domain: string;
  operation: string;
  outcome: UiRequestOutcome;
  durationMs: number;
  status: number | null;
  responseBytes: number | null;
};

export type UiRequestMetricObserver = (metric: UiRequestMetric) => void;

export type ObservedRequest = {
  domain: string;
  operation: string;
  observer?: UiRequestMetricObserver;
};

export type ServerTimingMetric = {
  name: string;
  durationMs: number;
  description?: string;
};

export type LatestRequest = {
  signal: AbortSignal;
  isCurrent: () => boolean;
  finish: () => void;
};

export type LatestRequestController = {
  begin: () => LatestRequest;
  abort: () => void;
  hasActiveRequest: () => boolean;
};

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Owns a single replaceable request. Starting the next request aborts the
 * previous one, and the guard prevents stale state commits when a custom
 * fetcher does not honor AbortSignal.
 */
export function createLatestRequestController(): LatestRequestController {
  let current: AbortController | null = null;
  return {
    begin() {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      return {
        signal: controller.signal,
        isCurrent: () => current === controller && !controller.signal.aborted,
        finish: () => {
          if (current === controller) current = null;
        },
      };
    },
    abort() {
      current?.abort();
      current = null;
    },
    hasActiveRequest: () => current !== null,
  };
}

function now() {
  return typeof globalThis.performance === "undefined" ? Date.now() : globalThis.performance.now();
}

function responseBytes(response: Response) {
  const value = response.headers.get("content-length");
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function emitMetric(request: ObservedRequest, metric: Omit<UiRequestMetric, "domain" | "operation">) {
  const complete = { domain: request.domain, operation: request.operation, ...metric };
  try {
    request.observer?.(complete);
  } catch {
    // Telemetry is best-effort and must never change the request outcome.
  }
  if (typeof globalThis.performance?.measure !== "function") return;
  try {
    const endedAt = globalThis.performance.now();
    const measureName = `brightweb:${request.domain}:${request.operation}:${metric.outcome}`;
    globalThis.performance.clearMeasures(measureName);
    globalThis.performance.measure(measureName, {
      start: endedAt - metric.durationMs,
      end: endedAt,
      detail: complete,
    });
  } catch {
    // Older browsers may not support PerformanceMeasureOptions.detail.
  }
}

export async function observedFetch(
  fetcher: typeof fetch,
  input: URL | RequestInfo,
  init: RequestInit | undefined,
  request: ObservedRequest,
): Promise<Response> {
  const startedAt = now();
  try {
    const response = await fetcher(input, init);
    emitMetric(request, {
      outcome: response.ok ? "completed" : "failed",
      durationMs: Math.max(0, now() - startedAt),
      status: response.status,
      responseBytes: responseBytes(response),
    });
    return response;
  } catch (error) {
    emitMetric(request, {
      outcome: error instanceof Error && error.name === "AbortError" ? "aborted" : "failed",
      durationMs: Math.max(0, now() - startedAt),
      status: null,
      responseBytes: null,
    });
    throw error;
  }
}

function timingToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function appendServerTiming(response: Response, metrics: ServerTimingMetric[]) {
  const values = metrics
    .filter((metric) => Number.isFinite(metric.durationMs) && metric.durationMs >= 0)
    .map((metric) => {
      const description = metric.description?.replace(/["\\]/g, "");
      return `${timingToken(metric.name)};dur=${metric.durationMs.toFixed(1)}${description ? `;desc="${description}"` : ""}`;
    });
  if (values.length === 0) return response;
  const existing = response.headers.get("server-timing");
  response.headers.set("server-timing", [...(existing ? [existing] : []), ...values].join(", "));
  return response;
}

export function elapsedMs(startedAt: number) {
  return Math.max(0, now() - startedAt);
}

export function requestStartedAt() {
  return now();
}
