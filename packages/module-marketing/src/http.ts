import {
  publicError,
  sanitizePublicError,
} from "@brightweblabs/infra/robustness";
import type {
  resolveByUnsubscribeToken,
  unsubscribeAll,
  unsubscribeTopic,
} from "./server";
import type {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaignRecipients,
  listCampaigns,
  retryCampaignFailures,
  scheduleCampaign,
  sendCampaignNow,
  sendTestEmail,
  updateCampaign,
} from "./campaigns";
import type { MarketingEmailSender } from "./email/types";
import type { runMarketingWorker } from "./worker";
import type { processResendWebhook } from "./webhooks";

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
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("required")
    || message.includes("must be")
    || message.startsWith("Only ")
    || message.startsWith("This campaign")
    || message.startsWith("A valid email")
  ) {
    return json(publicError("INVALID_INPUT", message), { status: 400 });
  }
  if (message === "Campaign not found.") {
    return json(publicError("CAMPAIGN_NOT_FOUND", message), { status: 404 });
  }
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

type ServerUserAccess =
  | {
    ok: true;
    supabase: unknown;
    profileId?: string;
    role?: string | null;
  }
  | { ok: false; status: number; error: string };

type CampaignRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export type MarketingCampaignHttpDependencies = {
  getAccess: () => Promise<ServerUserAccess>;
  createServiceClient: () => unknown;
  sender: MarketingEmailSender;
  workerSecret: string;
  webhookSecret: string;
  publicAppUrl?: string | null;
  listCampaigns: typeof listCampaigns;
  getCampaign: typeof getCampaign;
  createCampaign: typeof createCampaign;
  updateCampaign: typeof updateCampaign;
  deleteCampaign: typeof deleteCampaign;
  listRecipients: typeof listCampaignRecipients;
  scheduleCampaign: typeof scheduleCampaign;
  cancelCampaign: typeof cancelCampaign;
  sendCampaignNow: typeof sendCampaignNow;
  retryCampaignFailures: typeof retryCampaignFailures;
  sendTestEmail: typeof sendTestEmail;
  runWorker: typeof runMarketingWorker;
  processWebhook: typeof processResendWebhook;
  logger?: Pick<Console, "error">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJsonObject(request: Request) {
  try {
    const value = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

async function campaignId(context?: CampaignRouteContext) {
  return context ? (await context.params).id : "";
}

async function requireStaff(
  dependencies: MarketingCampaignHttpDependencies,
): Promise<Response | Extract<ServerUserAccess, { ok: true }>> {
  const access = await dependencies.getAccess();
  if (!access.ok) {
    return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
  }
  if (access.role !== "staff" && access.role !== "admin") {
    return json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
  }
  return access;
}

function isResponse(value: Response | object): value is Response {
  return value instanceof Response;
}

function withStaff(
  dependencies: MarketingCampaignHttpDependencies,
  contextName: string,
  action: (
    serviceClient: unknown,
    access: Extract<ServerUserAccess, { ok: true }>,
    request: Request,
    context?: CampaignRouteContext,
  ) => Promise<Response>,
) {
  return async (request: Request, context?: CampaignRouteContext) => {
    const access = await requireStaff(dependencies);
    if (isResponse(access)) return access;
    try {
      return await action(
        dependencies.createServiceClient(),
        access,
        request,
        context,
      );
    } catch (error) {
      return marketingErrorResponse(error, contextName);
    }
  };
}

function campaignInput(payload: Record<string, unknown>) {
  return {
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.subject === "string" ? { subject: payload.subject } : {}),
    ...(typeof payload.topicId === "string" ? { topicId: payload.topicId } : {}),
    ...("preheader" in payload ? {
      preheader: typeof payload.preheader === "string" ? payload.preheader : null,
    } : {}),
    ...("fromName" in payload ? {
      fromName: typeof payload.fromName === "string" ? payload.fromName : null,
    } : {}),
    ...("fromEmail" in payload ? {
      fromEmail: typeof payload.fromEmail === "string" ? payload.fromEmail : null,
    } : {}),
    ...("bodyHtml" in payload ? {
      bodyHtml: typeof payload.bodyHtml === "string" ? payload.bodyHtml : null,
    } : {}),
    ...("bodyText" in payload ? {
      bodyText: typeof payload.bodyText === "string" ? payload.bodyText : null,
    } : {}),
    ...("bodyJson" in payload ? { bodyJson: payload.bodyJson } : {}),
    ...(typeof payload.batchSize === "number" ? { batchSize: payload.batchSize } : {}),
    ...("ratePerMinute" in payload ? {
      ratePerMinute: typeof payload.ratePerMinute === "number"
        ? payload.ratePerMinute
        : null,
    } : {}),
  };
}

export function createMarketingCampaignHttpHandlers(
  dependencies: MarketingCampaignHttpDependencies,
) {
  const campaignsGet = withStaff(
    dependencies,
    "marketing.campaigns.list",
    async (supabase) => json(await dependencies.listCampaigns(supabase as never)),
  );
  const campaignsPost = withStaff(
    dependencies,
    "marketing.campaigns.create",
    async (supabase, access, request) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      const input = {
        ...campaignInput(payload),
        createdByProfileId: access.profileId ?? null,
      };
      if (!("name" in input) || !("subject" in input) || !("topicId" in input)) {
        return json(
          publicError("INVALID_INPUT", "Campaign name, subject, and topic are required."),
          { status: 400 },
        );
      }
      return json(await dependencies.createCampaign(supabase as never, input as never), {
        status: 201,
      });
    },
  );
  const campaignGet = withStaff(
    dependencies,
    "marketing.campaigns.get",
    async (supabase, _access, _request, context) => {
      const result = await dependencies.getCampaign(
        supabase as never,
        await campaignId(context),
      );
      return result
        ? json(result)
        : json(publicError("CAMPAIGN_NOT_FOUND", "Campaign not found."), { status: 404 });
    },
  );
  const campaignPatch = withStaff(
    dependencies,
    "marketing.campaigns.update",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      return json(await dependencies.updateCampaign(
        supabase as never,
        await campaignId(context),
        campaignInput(payload),
      ));
    },
  );
  const campaignDelete = withStaff(
    dependencies,
    "marketing.campaigns.delete",
    async (supabase, _access, _request, context) => {
      await dependencies.deleteCampaign(supabase as never, await campaignId(context));
      return new Response(null, { status: 204 });
    },
  );
  const recipientsGet = withStaff(
    dependencies,
    "marketing.campaigns.recipients",
    async (supabase, _access, _request, context) => json(
      await dependencies.listRecipients(supabase as never, await campaignId(context)),
    ),
  );
  const schedulePost = withStaff(
    dependencies,
    "marketing.campaigns.schedule",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload || typeof payload.scheduledAt !== "string") {
        return json(
          publicError("INVALID_INPUT", "scheduledAt is required."),
          { status: 400 },
        );
      }
      return json(await dependencies.scheduleCampaign(
        supabase as never,
        await campaignId(context),
        payload.scheduledAt,
      ));
    },
  );
  const cancelPost = withStaff(
    dependencies,
    "marketing.campaigns.cancel",
    async (supabase, _access, _request, context) => json(
      await dependencies.cancelCampaign(supabase as never, await campaignId(context)),
    ),
  );
  const sendPost = withStaff(
    dependencies,
    "marketing.campaigns.send",
    async (supabase, _access, _request, context) => {
      const campaign = await dependencies.sendCampaignNow(
        supabase as never,
        await campaignId(context),
      );
      void dependencies.runWorker({
        supabase,
        sender: dependencies.sender,
        publicAppUrl: dependencies.publicAppUrl,
      }).catch((error) => {
        (dependencies.logger ?? console).error(
          "[marketing] Inline worker failed.",
          error,
        );
      });
      return json(campaign, { status: 202 });
    },
  );
  const retryPost = withStaff(
    dependencies,
    "marketing.campaigns.retry",
    async (supabase, _access, _request, context) => {
      const campaign = await dependencies.retryCampaignFailures(
        supabase as never,
        await campaignId(context),
      );
      void dependencies.runWorker({
        supabase,
        sender: dependencies.sender,
        publicAppUrl: dependencies.publicAppUrl,
      }).catch((error) => {
        (dependencies.logger ?? console).error(
          "[marketing] Inline retry worker failed.",
          error,
        );
      });
      return json(campaign, { status: 202 });
    },
  );
  const testPost = withStaff(
    dependencies,
    "marketing.campaigns.test",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload || typeof payload.toEmail !== "string") {
        return json(publicError("INVALID_INPUT", "toEmail is required."), {
          status: 400,
        });
      }
      const result = await dependencies.sendTestEmail(
        supabase as never,
        await campaignId(context),
        payload.toEmail,
        dependencies.sender,
      );
      return json(result, { status: result.ok ? 200 : 502 });
    },
  );

  const workerPost = async (request: Request) => {
    const authorization = request.headers.get("authorization") ?? "";
    if (
      !dependencies.workerSecret
      || authorization !== `Bearer ${dependencies.workerSecret}`
    ) {
      return json(publicError("UNAUTHORIZED", "Unauthorized."), { status: 401 });
    }
    try {
      return json(await dependencies.runWorker({
        supabase: dependencies.createServiceClient(),
        sender: dependencies.sender,
        publicAppUrl: dependencies.publicAppUrl,
      }));
    } catch (error) {
      return marketingErrorResponse(error, "marketing.worker");
    }
  };

  const webhookPost = async (request: Request) => {
    try {
      const result = await dependencies.processWebhook(
        dependencies.createServiceClient() as never,
        await request.text(),
        request.headers,
        dependencies.webhookSecret,
      );
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.toLowerCase().includes("signature")
        || message.toLowerCase().includes("secret")
      ) {
        return json(publicError("INVALID_WEBHOOK", "Invalid webhook signature."), {
          status: 400,
        });
      }
      return marketingErrorResponse(error, "marketing.webhooks.resend");
    }
  };

  return {
    campaignsGet,
    campaignsPost,
    campaignGet,
    campaignPatch,
    campaignDelete,
    recipientsGet,
    schedulePost,
    cancelPost,
    sendPost,
    retryPost,
    testPost,
    workerPost,
    webhookPost,
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
