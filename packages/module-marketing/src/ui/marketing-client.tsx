"use client";

import { CalendarClock, Check, Clock3, Mail, Plus, RotateCcw, Send, Trash2, Users, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@brightweblabs/ui";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import { PillTabs, useShellAction } from "@brightweblabs/app-shell";
import { useMarketingUiClient } from "./context";
import { defaultMarketingUiDictionary } from "./dictionary";
import { SegmentWorkspace } from "./segment-workspace";
import {
  AnalyticsWorkspace,
  CampaignAnalyticsPanel,
} from "./analytics-workspace";
import { WorkflowWorkspace } from "./workflow-workspace";
import { TopicWorkspace } from "./topic-workspace";
import { dispatchMarketingState, MARKETING_EVENTS, type MarketingCollectionView, type MarketingStatusFilter } from "./events";
import type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
} from "../analytics";
import type {
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingCampaignRecipient,
  MarketingCampaignStatus,
  MarketingCollectionQuery,
  MarketingCollectionResult,
  MarketingSegment,
  MarketingTopic,
  MarketingUiDictionary,
  MarketingWorkflow,
  MarketingWorkflowStatus,
} from "./types";

type CampaignForm = {
  name: string;
  subject: string;
  preheader: string;
  fromName: string;
  fromEmail: string;
  topicId: string;
  segmentId: string;
  bodyHtml: string;
};

const emptyForm: CampaignForm = {
  name: "",
  subject: "",
  preheader: "",
  fromName: "",
  fromEmail: "",
  topicId: "",
  segmentId: "",
  bodyHtml: "",
};

const statusTone: Record<MarketingCampaignStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  scheduled: "border-info/25 bg-info/10 text-info",
  sending: "border-warning/25 bg-warning/10 text-warning",
  sent: "border-success/25 bg-success/10 text-success",
  canceled: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
};

const recipientTone: Record<MarketingCampaignRecipient["status"], string> = {
  queued: "bg-muted text-muted-foreground",
  sending: "bg-warning/10 text-warning",
  sent: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  suppressed: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
};

function toForm(campaign: MarketingCampaign): CampaignForm {
  return {
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader ?? "",
    fromName: campaign.fromName ?? "",
    fromEmail: campaign.fromEmail ?? "",
    topicId: campaign.topicId,
    segmentId: campaign.segmentId ?? "",
    bodyHtml: campaign.bodyHtml ?? "",
  };
}

function toInput(form: CampaignForm): MarketingCampaignInput {
  return {
    name: form.name.trim(),
    subject: form.subject.trim(),
    preheader: form.preheader.trim() || null,
    fromName: form.fromName.trim() || null,
    fromEmail: form.fromEmail.trim() || null,
    topicId: form.topicId,
    segmentId: form.segmentId || null,
    bodyHtml: form.bodyHtml,
  };
}

function isValid(form: CampaignForm) {
  return Boolean(form.name.trim() && form.subject.trim() && form.topicId && form.bodyHtml.trim());
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function localPage<T>(
  items: T[],
  query: MarketingCollectionQuery<string>,
  text: (item: T) => string,
  status?: (item: T) => string,
): MarketingCollectionResult<T> {
  const search = query.search?.trim().toLocaleLowerCase("pt-PT") ?? "";
  const filtered = items.filter((item) => (
    (!search || text(item).toLocaleLowerCase("pt-PT").includes(search))
    && (!query.status || !status || status(item) === query.status)
  ));
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? 20);
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}

function StatusPill({ status, dictionary }: {
  status: MarketingCampaignStatus;
  dictionary: MarketingUiDictionary;
}) {
  return <Badge variant="outline" className={statusTone[status]}>{dictionary.statuses[status]}</Badge>;
}

function RecipientPanel({ recipients, loadState, dictionary, onRemove }: {
  recipients: MarketingCampaignRecipient[];
  loadState: "pending" | "fulfilled" | "rejected";
  dictionary: MarketingUiDictionary;
  onRemove?: (recipient: MarketingCampaignRecipient) => void;
}) {
  const counts = useMemo(() => {
    const next = { queued: 0, sending: 0, sent: 0, failed: 0, suppressed: 0, skipped: 0 };
    for (const recipient of recipients) next[recipient.status] += 1;
    return next;
  }, [recipients]);

  return (
    <section className="marketing-recipient-panel" aria-labelledby="marketing-recipients-title">
      <div>
        <p className="marketing-kicker" id="marketing-recipients-title">{dictionary.recipients.title}</p>
        <p className="mt-1 text-body text-muted-foreground">{dictionary.recipients.subtitle}</p>
      </div>
      {loadState === "pending" ? (
        <div className="marketing-count-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
        </div>
      ) : loadState === "fulfilled" ? (
        <div className="marketing-count-grid">
          {(Object.keys(counts) as Array<keyof typeof counts>).map((status) => (
            <div className="marketing-count" key={status}>
              <strong className="text-data text-[length:var(--text-heading-3)] font-semibold">{counts[status]}</strong>
              <span className="text-label">{dictionary.recipients.statuses[status]}</span>
            </div>
          ))}
        </div>
      ) : null}
      {loadState === "pending" ? (
        <div className="space-y-2" aria-busy="true" aria-label={dictionary.recipients.title}>
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : loadState === "rejected" ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-body text-destructive">
          {dictionary.feedback.genericError}
        </p>
      ) : recipients.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-body text-muted-foreground">
          {dictionary.recipients.empty}
        </p>
      ) : (
        <div className="marketing-recipient-list">
          {recipients.map((recipient) => (
            <div className="marketing-recipient-row" key={recipient.id}>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">{recipient.email}</p>
                {recipient.error ? <p className="truncate text-meta text-destructive">{recipient.error}</p> : null}
              </div>
              <Badge className={recipientTone[recipient.status]}>
                {dictionary.recipients.statuses[recipient.status]}
              </Badge>
              {["queued", "suppressed", "skipped"].includes(recipient.status) && onRemove ? (
                <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Remover ${recipient.email}`} onClick={() => onRemove(recipient)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export type MarketingClientProps = {
  initialCampaigns: MarketingCampaign[];
  initialTopics: MarketingTopic[];
  initialSegments: MarketingSegment[];
  initialWorkflows: MarketingWorkflow[];
  initialOverview: MarketingOverviewMetrics;
  initialCampaignAnalytics: Record<string, MarketingCampaignAnalytics>;
  initialCollectionPages?: Record<MarketingCollectionView, { total: number; totalPages: number }>;
  initialCollectionsLoaded?: boolean;
  dictionary?: MarketingUiDictionary;
};

export function MarketingClient({
  initialCampaigns,
  initialTopics,
  initialSegments,
  initialWorkflows,
  initialOverview,
  initialCampaignAnalytics,
  dictionary: dictionaryOverride = defaultMarketingUiDictionary,
  initialCollectionPages,
  initialCollectionsLoaded = true,
}: MarketingClientProps) {
  const dictionary = {
    ...dictionaryOverride,
    page: {
      ...defaultMarketingUiDictionary.page,
      ...dictionaryOverride.page,
    },
    topics: {
      ...defaultMarketingUiDictionary.topics!,
      ...dictionaryOverride.topics,
      fields: {
        ...defaultMarketingUiDictionary.topics!.fields,
        ...dictionaryOverride.topics?.fields,
      },
      placeholders: {
        ...defaultMarketingUiDictionary.topics!.placeholders,
        ...dictionaryOverride.topics?.placeholders,
      },
    },
  } as MarketingUiDictionary & {
    page: MarketingUiDictionary["page"] & { topicsTab: string };
    topics: NonNullable<MarketingUiDictionary["topics"]>;
  };
  const client = useMarketingUiClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [topics, setTopics] = useState(initialTopics);
  const [segments, setSegments] = useState(initialSegments);
  const [segmentOptions, setSegmentOptions] = useState<MarketingSegment[]>([]);
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [overview, setOverview] = useState(initialOverview);
  const [campaignAnalytics, setCampaignAnalytics] = useState(initialCampaignAnalytics);
  const [activeView, setActiveView] = useState<"campaigns" | "segments" | "topics" | "analytics" | "workflows">("campaigns");
  const [activeCampaign, setActiveCampaign] = useState<MarketingCampaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [recipients, setRecipients] = useState<MarketingCampaignRecipient[]>([]);
  const [recipientsLoadState, setRecipientsLoadState] = useState<"pending" | "fulfilled" | "rejected">("fulfilled");
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const campaignDetailRequestRef = useRef(createLatestRequestController());
  const campaignEditorGenerationRef = useRef(0);
  const collectionRequestRef = useRef(createLatestRequestController());
  const analyticsRequestRef = useRef(createLatestRequestController());
  const segmentOptionsControllerRef = useRef(createLatestRequestController());
  const segmentOptionsRequestRef = useRef<Promise<MarketingSegment[]> | null>(null);
  const segmentOptionsLoadedRef = useRef(false);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionFailed, setCollectionFailed] = useState(false);
  const [collectionRefreshNonce, setCollectionRefreshNonce] = useState(0);
  const [analyticsCampaigns, setAnalyticsCampaigns] = useState<MarketingCampaign[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsFailed, setAnalyticsFailed] = useState(false);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const [analyticsTotalPages, setAnalyticsTotalPages] = useState(1);
  const [segmentOptionsLoading, setSegmentOptionsLoading] = useState(false);
  const [segmentOptionsFailed, setSegmentOptionsFailed] = useState(false);
  const [createRequest, setCreateRequest] = useState(0);
  const [queries, setQueries] = useState<Record<MarketingCollectionView, { search: string; debouncedSearch: string; status: MarketingStatusFilter; page: number }>>({
    campaigns: { search: "", debouncedSearch: "", status: "all", page: 1 },
    segments: { search: "", debouncedSearch: "", status: "all", page: 1 },
    workflows: { search: "", debouncedSearch: "", status: "all", page: 1 },
  });
  const [collectionPages, setCollectionPages] = useState<Record<MarketingCollectionView, { total: number; totalPages: number }>>(initialCollectionPages ?? {
    campaigns: { total: initialCampaigns.length, totalPages: 1 },
    segments: { total: initialSegments.length, totalPages: 1 },
    workflows: { total: initialWorkflows.length, totalPages: 1 },
  });
  const initialLoadedViewsRef = useRef(new Set<MarketingCollectionView>(
    initialCollectionsLoaded ? ["campaigns", "segments", "workflows"] : [],
  ));
  const campaignLoadGeneration = useRef(0);

  const ensureSegmentOptions = useCallback((selectedId?: string | null) => {
    if (segmentOptionsLoadedRef.current && (!selectedId || segmentOptions.some((item) => item.id === selectedId))) return Promise.resolve(segmentOptions);
    if (segmentOptionsRequestRef.current) return segmentOptionsRequestRef.current;
    const latest = segmentOptionsControllerRef.current.begin();
    setSegmentOptionsLoading(true);
    setSegmentOptionsFailed(false);
    const optionsRequest = client.querySegments?.({ page: 1, pageSize: 100 }, { signal: latest.signal })
      .then((result) => result.items)
      ?? client.listSegments({ signal: latest.signal }).then((items) => items.slice(0, 100));
    const request = Promise.all([
      optionsRequest,
      selectedId ? client.getSegment(selectedId, { signal: latest.signal }).catch((error) => isAbortError(error) ? null : null) : Promise.resolve(null),
    ])
      .then(([items, selected]) => {
        if (!latest.isCurrent()) return items;
        const next = selected && !items.some((item) => item.id === selected.id) ? [selected, ...items] : items;
        setSegmentOptions(next);
        segmentOptionsLoadedRef.current = true;
        return next;
      })
      .catch((error) => {
        if (latest.isCurrent() && !isAbortError(error)) setSegmentOptionsFailed(true);
        return [];
      })
      .finally(() => {
        const current = latest.isCurrent();
        latest.finish();
        if (current) setSegmentOptionsLoading(false);
        if (segmentOptionsRequestRef.current === request) segmentOptionsRequestRef.current = null;
      });
    segmentOptionsRequestRef.current = request;
    return request;
  }, [client, segmentOptions]);

  const topicMap = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic])),
    [topics],
  );

  const replaceCampaign = (campaign: MarketingCampaign) => {
    setCampaigns((current) => {
      const exists = current.some((item) => item.id === campaign.id);
      return exists
        ? current.map((item) => item.id === campaign.id ? campaign : item)
        : [campaign, ...current];
    });
    setActiveCampaign(campaign);
    setForm(toForm(campaign));
  };

  const beginCreate = () => {
    campaignEditorGenerationRef.current += 1;
    campaignDetailRequestRef.current.abort();
    campaignLoadGeneration.current += 1;
    setActiveCampaign(null);
    setForm(emptyForm);
    setRecipients([]);
    setRecipientsLoadState("fulfilled");
    setBusy(null);
    setScheduledAt("");
    setTestEmail("");
    setEditorOpen(true);
    void ensureSegmentOptions();
  };

  const openCampaign = async (campaign: MarketingCampaign) => {
    campaignEditorGenerationRef.current += 1;
    const latest = campaignDetailRequestRef.current.begin();
    const generation = ++campaignLoadGeneration.current;
    setActiveCampaign(campaign);
    setForm(toForm(campaign));
    setRecipients([]);
    setRecipientsLoadState("pending");
    setScheduledAt(campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : "");
    setEditorOpen(true);
    void ensureSegmentOptions(campaign.segmentId);
    setBusy("load");
    try {
      const [detail, nextRecipients, analytics] = await Promise.all([
        client.getCampaign(campaign.id, { signal: latest.signal }),
        client.listRecipients(campaign.id, { signal: latest.signal }),
        client.getCampaignAnalytics(campaign.id, { signal: latest.signal }),
      ]);
      if (!latest.isCurrent()) return;
      if (generation !== campaignLoadGeneration.current) return;
      replaceCampaign(detail);
      setRecipients(nextRecipients);
      setRecipientsLoadState("fulfilled");
      setCampaignAnalytics((current) => ({ ...current, [campaign.id]: analytics }));
    } catch (error) {
      if (isAbortError(error) || !latest.isCurrent() || generation !== campaignLoadGeneration.current) return;
      setRecipientsLoadState("rejected");
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      const current = latest.isCurrent();
      latest.finish();
      if (current && generation === campaignLoadGeneration.current) setBusy(null);
    }
  };

  const persist = async (successMessage?: string) => {
    if (!isValid(form)) {
      toast.error(dictionary.feedback.required);
      return null;
    }
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy("save");
    try {
      const saved = activeCampaign
        ? await client.updateCampaign(activeCampaign.id, toInput(form))
        : await client.createCampaign(toInput(form));
      if (editorGeneration !== campaignEditorGenerationRef.current) return null;
      replaceCampaign(saved);
      setCollectionRefreshNonce((current) => current + 1);
      toast.success(successMessage ?? (activeCampaign ? dictionary.feedback.saved : dictionary.feedback.created));
      return saved;
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
      return null;
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  const runAction = async (
    action: string,
    operation: (campaign: MarketingCampaign) => Promise<MarketingCampaign>,
    message: string,
  ) => {
    const campaign = activeCampaign ?? await persist();
    if (!campaign) return;
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy(action);
    try {
      const updated = await operation(campaign);
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      replaceCampaign(updated);
      const [nextRecipients, analytics, nextOverview] = await Promise.all([
        client.listRecipients(updated.id),
        client.getCampaignAnalytics(updated.id),
        client.getOverview(),
      ]);
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      setRecipients(nextRecipients);
      setCampaignAnalytics((current) => ({ ...current, [updated.id]: analytics }));
      setOverview(nextOverview);
      setCollectionRefreshNonce((current) => current + 1);
      toast.success(message);
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  const removeCampaign = async () => {
    if (!activeCampaign || !["draft", "canceled"].includes(activeCampaign.status)) return;
    if (!window.confirm(`Eliminar definitivamente a campanha “${activeCampaign.name}”?`)) return;
    const campaignId = activeCampaign.id;
    setBusy("delete");
    try {
      await client.deleteCampaign(campaignId);
      setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId));
      setEditorOpen(false);
      setActiveCampaign(null);
      toast.success("Campanha eliminada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  const removeRecipient = async (recipient: MarketingCampaignRecipient) => {
    if (!activeCampaign || !window.confirm(`Remover ${recipient.email} desta campanha?`)) return;
    try {
      await client.deleteRecipient(activeCampaign.id, recipient.id);
      setRecipients((current) => current.filter((item) => item.id !== recipient.id));
      replaceCampaign({ ...activeCampaign, totalRecipients: Math.max(0, activeCampaign.totalRecipients - 1) });
      toast.success("Destinatário removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    }
  };

  useEffect(() => () => {
    campaignDetailRequestRef.current.abort();
    collectionRequestRef.current.abort();
    analyticsRequestRef.current.abort();
    segmentOptionsControllerRef.current.abort();
  }, []);

  const collectionView = activeView === "analytics" || activeView === "topics" ? null : activeView;
  const activeQuery = collectionView ? queries[collectionView] : null;

  useShellAction<{ query?: string } | undefined>(MARKETING_EVENTS.setSearch, (detail) => {
    if (!collectionView) return;
    collectionRequestRef.current.abort();
    setCollectionLoading(true);
    setQueries((current) => ({ ...current, [collectionView]: { ...current[collectionView], search: detail?.query ?? "", page: 1 } }));
  });
  useShellAction<{ status?: MarketingStatusFilter } | undefined>(MARKETING_EVENTS.setStatusFilter, (detail) => {
    if (!collectionView) return;
    setQueries((current) => ({
      ...current,
      [collectionView]: {
        ...current[collectionView],
        debouncedSearch: current[collectionView].search.trim(),
        status: detail?.status ?? "all",
        page: 1,
      },
    }));
  });
  useShellAction(MARKETING_EVENTS.create, () => {
    if (activeView === "campaigns") beginCreate();
    else if (activeView === "segments" || activeView === "workflows") setCreateRequest((current) => current + 1);
  });

  useEffect(() => {
    if (!collectionView || !activeQuery) {
      collectionRequestRef.current.abort();
      setCollectionLoading(false);
      return;
    }
    if (!activeQuery.search.trim()) {
      if (activeQuery.debouncedSearch) setQueries((current) => ({ ...current, [collectionView]: { ...current[collectionView], debouncedSearch: "", page: 1 } }));
      return;
    }
    const timer = window.setTimeout(() => setQueries((current) => ({
      ...current,
      [collectionView]: { ...current[collectionView], debouncedSearch: current[collectionView].search.trim(), page: 1 },
    })), 180);
    return () => window.clearTimeout(timer);
  }, [activeQuery?.debouncedSearch, activeQuery?.search, collectionView]);

  useEffect(() => {
    if (!collectionView || !activeQuery) return;
    if (
      initialLoadedViewsRef.current.delete(collectionView)
      && activeQuery.page === 1
      && !activeQuery.debouncedSearch
      && activeQuery.status === "all"
    ) {
      setCollectionLoading(false);
      return;
    }
    const latest = collectionRequestRef.current.begin();
    setCollectionLoading(true);
    setCollectionFailed(false);
    const requestOptions = { signal: latest.signal };
    const query = { page: activeQuery.page, pageSize: 20, search: activeQuery.debouncedSearch || undefined };
    const request = collectionView === "campaigns"
      ? client.queryCampaigns?.({ ...query, status: activeQuery.status === "all" ? null : activeQuery.status as MarketingCampaignStatus }, requestOptions)
        ?? client.listCampaigns(requestOptions).then((items) => localPage(items, { ...query, status: activeQuery.status === "all" ? null : activeQuery.status }, (item) => `${item.name} ${item.subject}`, (item) => item.status))
      : collectionView === "segments"
        ? client.querySegments?.(query, requestOptions)
          ?? client.listSegments(requestOptions).then((items) => localPage(items, query, (item) => `${item.name} ${item.description ?? ""}`))
        : client.queryWorkflows?.({ ...query, status: activeQuery.status === "all" ? null : activeQuery.status as MarketingWorkflowStatus }, requestOptions)
          ?? client.listWorkflows(requestOptions).then((items) => localPage(items, { ...query, status: activeQuery.status === "all" ? null : activeQuery.status }, (item) => `${item.name} ${item.description ?? ""}`, (item) => item.status));
    void request.then((result) => {
      if (!latest.isCurrent()) return;
      if (collectionView === "campaigns") setCampaigns(result.items as MarketingCampaign[]);
      else if (collectionView === "segments") setSegments(result.items as MarketingSegment[]);
      else setWorkflows(result.items as MarketingWorkflow[]);
      setCollectionPages((current) => ({ ...current, [collectionView]: { total: result.total, totalPages: result.totalPages } }));
    }).catch((error) => {
      if (!isAbortError(error) && latest.isCurrent()) {
        setCollectionFailed(true);
        toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
      }
    }).finally(() => {
      const current = latest.isCurrent();
      latest.finish();
      if (current) setCollectionLoading(false);
    });
    return () => collectionRequestRef.current.abort();
  }, [activeQuery?.debouncedSearch, activeQuery?.page, activeQuery?.status, client, collectionRefreshNonce, collectionView, dictionary.feedback.genericError]);

  useEffect(() => {
    if (activeView !== "analytics") {
      analyticsRequestRef.current.abort();
      return;
    }
    const latest = analyticsRequestRef.current.begin();
    setAnalyticsLoading(true);
    setAnalyticsFailed(false);
    setAnalyticsCampaigns([]);
    void (async () => {
      try {
        const pageQuery = { page: analyticsPage, pageSize: 10 };
        const page = await (client.queryCampaigns?.(pageQuery, { signal: latest.signal })
          ?? client.listCampaigns({ signal: latest.signal }).then((items) => localPage(items, pageQuery, (item) => `${item.name} ${item.subject}`)));
        if (!latest.isCurrent()) return;
        if (analyticsPage > page.totalPages) {
          setAnalyticsPage(page.totalPages);
          return;
        }
        const [entries, nextOverview] = await Promise.all([
          Promise.all(page.items.map(async (campaign) => [
            campaign.id,
            await client.getCampaignAnalytics(campaign.id, { signal: latest.signal }),
          ] as const)),
          client.getOverview(undefined, { signal: latest.signal }),
        ]);
        if (!latest.isCurrent()) return;
        setAnalyticsCampaigns(page.items);
        setAnalyticsTotalPages(page.totalPages);
        setCampaignAnalytics((current) => ({ ...current, ...Object.fromEntries(entries) }));
        setOverview(nextOverview);
      } catch (error) {
        if (!isAbortError(error) && latest.isCurrent()) {
          setAnalyticsFailed(true);
          toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
        }
      } finally {
        const current = latest.isCurrent();
        latest.finish();
        if (current) setAnalyticsLoading(false);
      }
    })();
    return () => analyticsRequestRef.current.abort();
  }, [activeView, analyticsPage, client, collectionRefreshNonce, dictionary.feedback.genericError]);

  useEffect(() => {
    dispatchMarketingState({
      view: activeView === "topics" ? "analytics" : activeView,
      search: activeQuery?.search ?? "",
      status: activeQuery?.status ?? "all",
    });
  }, [activeQuery?.search, activeQuery?.status, activeView]);

  const handleEditorOpenChange = (open: boolean) => {
    if (!open) {
      campaignDetailRequestRef.current.abort();
      campaignEditorGenerationRef.current += 1;
    }
    setEditorOpen(open);
  };

  const insertToken = (token: string) => {
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? form.bodyHtml.length;
    const end = textarea?.selectionEnd ?? start;
    setForm((current) => ({
      ...current,
      bodyHtml: `${current.bodyHtml.slice(0, start)}${token}${current.bodyHtml.slice(end)}`,
    }));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const sendTest = async () => {
    const email = testEmail.trim();
    if (!email) {
      toast.error(dictionary.feedback.required);
      return;
    }
    const campaign = activeCampaign ?? await persist();
    if (!campaign) return;
    const editorGeneration = campaignEditorGenerationRef.current;
    setBusy("test");
    try {
      await client.sendTest(campaign.id, email);
      if (editorGeneration !== campaignEditorGenerationRef.current) return;
      toast.success(dictionary.feedback.testSent);
    } catch (error) {
      if (editorGeneration === campaignEditorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === campaignEditorGenerationRef.current) setBusy(null);
    }
  };

  return (
    <main className="marketing-workspace" aria-busy={collectionLoading}>
      <div className="marketing-view-nav">
        <PillTabs
          ariaLabel="Marketing"
          items={[
            { value: "campaigns", label: dictionary.page.campaignsTab },
            { value: "segments", label: dictionary.page.segmentsTab },
            { value: "topics", label: dictionary.page.topicsTab },
            { value: "analytics", label: dictionary.page.analyticsTab },
            { value: "workflows", label: dictionary.workflows.tab },
          ]}
          value={activeView}
          onValueChange={setActiveView}
        />
      </div>

      {activeView === "campaigns" ? (
      <Card className="marketing-ledger">
        <CardContent className="p-0">
          <div className="marketing-ledger-heading">
            <div>
              <p className="marketing-kicker">{dictionary.page.eyebrow}</p>
              <h1 className="text-heading-3">{dictionary.list.title}</h1>
              <p className="text-meta text-muted-foreground">
                {dictionary.list.campaignCount(collectionPages.campaigns.total)}
              </p>
            </div>
            <Mail className="text-muted-foreground" aria-hidden="true" />
          </div>
          {collectionLoading && campaigns.length === 0 ? (
            <div className="marketing-collection-state" aria-label="A carregar campanhas">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : collectionFailed && campaigns.length === 0 ? (
            <div className="marketing-empty" role="alert">
              <div className="marketing-empty-icon"><RotateCcw aria-hidden="true" /></div>
              <h2>{dictionary.page.loadError}</h2>
              <p>{dictionary.feedback.genericError}</p>
              <Button onClick={() => setCollectionRefreshNonce((current) => current + 1)} variant="outline">
                <RotateCcw aria-hidden="true" />Tentar novamente
              </Button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="marketing-empty">
              <div className="marketing-empty-icon"><Mail aria-hidden="true" /></div>
              <h2>{dictionary.page.emptyTitle}</h2>
              <p>{dictionary.page.emptyDescription}</p>
            </div>
          ) : (
            <div className="marketing-campaign-list">
              <div className="marketing-campaign-columns" aria-hidden="true">
                <span>{dictionary.list.subject}</span>
                <span>{dictionary.list.topic}</span>
                <span>{dictionary.list.recipients}</span>
                <span>{dictionary.list.created}</span>
                <span>Estado</span>
              </div>
              {campaigns.map((campaign) => (
                <button
                  className="marketing-campaign-row"
                  key={campaign.id}
                  onClick={() => void openCampaign(campaign)}
                  type="button"
                >
                  <span className="marketing-campaign-primary">
                    <span className="marketing-campaign-mark" aria-hidden="true">
                      {campaign.status === "sent" ? <Check /> : <Mail />}
                    </span>
                    <span className="min-w-0">
                      <strong className="text-title">{campaign.name}</strong>
                      <small>{campaign.subject || dictionary.list.noSubject}</small>
                    </span>
                  </span>
                  <span className="marketing-row-topic">{topicMap.get(campaign.topicId)?.label ?? "—"}</span>
                  <span className="marketing-row-count text-data">
                    <Users aria-hidden="true" />
                    {campaign.totalRecipients === 0 ? "—" : `${campaign.sentCount}/${campaign.totalRecipients}`}
                  </span>
                  <span className="marketing-row-date text-data">{formatDate(campaign.createdAt, dictionary.locale)}</span>
                  <StatusPill status={campaign.status} dictionary={dictionary} />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      ) : activeView === "segments" ? (
        <SegmentWorkspace
          dictionary={dictionary}
          onSegmentsChange={setSegments}
          segments={segments}
          topics={topics}
          createRequest={createRequest}
          onMutated={() => {
            segmentOptionsControllerRef.current.abort();
            segmentOptionsRequestRef.current = null;
            segmentOptionsLoadedRef.current = false;
            setCollectionRefreshNonce((current) => current + 1);
          }}
        />
      ) : activeView === "topics" ? (
        <TopicWorkspace
          dictionary={dictionary}
          onTopicsChange={setTopics}
          topics={topics}
        />
      ) : activeView === "analytics" ? (
        <div aria-busy={analyticsLoading} className="space-y-4">
          {analyticsLoading ? (
            <div className="grid gap-4" aria-label="A carregar análise">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          ) : analyticsFailed ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-body text-destructive">{dictionary.feedback.genericError}</p>
          ) : (
            <AnalyticsWorkspace
              campaignAnalytics={campaignAnalytics}
              campaigns={analyticsCampaigns}
              dictionary={dictionary}
              onOpenCampaign={(campaign) => void openCampaign(campaign)}
              overview={overview}
            />
          )}
          {analyticsTotalPages > 1 ? (
            <nav className="flex items-center justify-end gap-2" aria-label="Paginação da análise">
              <Button type="button" variant="outline" disabled={analyticsLoading || analyticsPage <= 1} onClick={() => setAnalyticsPage((page) => page - 1)}>Anterior</Button>
              <span className="text-data text-meta text-muted-foreground">{analyticsPage} / {analyticsTotalPages}</span>
              <Button type="button" variant="outline" disabled={analyticsLoading || analyticsPage >= analyticsTotalPages} onClick={() => setAnalyticsPage((page) => page + 1)}>Seguinte</Button>
            </nav>
          ) : null}
        </div>
      ) : (
        <WorkflowWorkspace
          dictionary={dictionary}
          initialWorkflows={workflows}
          createRequest={createRequest}
          onMutated={() => setCollectionRefreshNonce((current) => current + 1)}
        />
      )}

      {collectionView && collectionPages[collectionView].totalPages > 1 ? (
        <nav className="flex items-center justify-end gap-2" aria-label="Paginação">
          <Button
            type="button"
            variant="outline"
            disabled={collectionLoading || queries[collectionView].page <= 1}
            onClick={() => setQueries((current) => ({
              ...current,
              [collectionView]: { ...current[collectionView], page: current[collectionView].page - 1 },
            }))}
          >
            Anterior
          </Button>
          <span className="text-data text-meta text-muted-foreground">
            {queries[collectionView].page} / {collectionPages[collectionView].totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={collectionLoading || queries[collectionView].page >= collectionPages[collectionView].totalPages}
            onClick={() => setQueries((current) => ({
              ...current,
              [collectionView]: { ...current[collectionView], page: current[collectionView].page + 1 },
            }))}
          >
            Seguinte
          </Button>
        </nav>
      ) : null}

      <Sheet open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <SheetContent className="marketing-editor" side="right">
          <SheetHeader className="marketing-editor-header">
            <div>
              <p className="marketing-kicker">
                {activeCampaign ? dictionary.editor.editEyebrow : dictionary.editor.createEyebrow}
              </p>
              <SheetTitle>{form.name || dictionary.editor.newTitle}</SheetTitle>
              <SheetDescription>
                {activeCampaign ? dictionary.statuses[activeCampaign.status] : dictionary.statuses.draft}
              </SheetDescription>
            </div>
            {activeCampaign ? <StatusPill status={activeCampaign.status} dictionary={dictionary} /> : null}
          </SheetHeader>

          <div className="marketing-editor-scroll">
            <section className="marketing-form-grid">
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="campaign-name">{dictionary.editor.fields.name}</Label>
                <Input id="campaign-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={dictionary.editor.placeholders.name} />
              </div>
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="campaign-subject">{dictionary.editor.fields.subject}</Label>
                <Input id="campaign-subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder={dictionary.editor.placeholders.subject} />
              </div>
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="campaign-preheader">{dictionary.editor.fields.preheader}</Label>
                <Input id="campaign-preheader" value={form.preheader} onChange={(event) => setForm((current) => ({ ...current, preheader: event.target.value }))} placeholder={dictionary.editor.placeholders.preheader} />
              </div>
              <div className="marketing-field">
                <Label htmlFor="campaign-from-name">{dictionary.editor.fields.fromName}</Label>
                <Input id="campaign-from-name" value={form.fromName} onChange={(event) => setForm((current) => ({ ...current, fromName: event.target.value }))} placeholder={dictionary.editor.placeholders.fromName} />
              </div>
              <div className="marketing-field">
                <Label htmlFor="campaign-from-email">{dictionary.editor.fields.fromEmail}</Label>
                <Input id="campaign-from-email" type="email" value={form.fromEmail} onChange={(event) => setForm((current) => ({ ...current, fromEmail: event.target.value }))} placeholder={dictionary.editor.placeholders.fromEmail} />
              </div>
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="campaign-topic">{dictionary.editor.fields.topic}</Label>
                <select className="marketing-select" id="campaign-topic" value={form.topicId} onChange={(event) => setForm((current) => ({ ...current, topicId: event.target.value }))}>
                  <option value="">{dictionary.editor.placeholders.topic}</option>
                  {topics.filter((topic) => topic.isActive || topic.id === form.topicId).map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
                </select>
              </div>
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="campaign-segment">
                  {dictionary.editor.fields.segment}
                </Label>
                <select
                  className="marketing-select"
                  id="campaign-segment"
                  value={form.segmentId}
                  disabled={segmentOptionsLoading}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    segmentId: event.target.value,
                  }))}
                >
                  <option value="">{dictionary.editor.placeholders.segment}</option>
                  {segmentOptions.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
                {segmentOptionsFailed ? <p role="alert" className="mt-2 text-meta text-destructive">{dictionary.feedback.genericError}</p> : null}
                <p className="mt-2 text-meta text-muted-foreground">
                  {dictionary.editor.effectiveAudience}
                </p>
              </div>
            </section>

            <Separator />

            <section className="marketing-composer">
              <div className="marketing-composer-heading">
                <div>
                  <Label htmlFor="campaign-body">{dictionary.editor.fields.body}</Label>
                  <p>{dictionary.editor.personalizationHint}</p>
                </div>
                <div className="marketing-token-list" aria-label={dictionary.editor.personalization}>
                  {Object.entries(dictionary.editor.tokens).map(([token, label]) => (
                    <button key={token} onClick={() => insertToken(token)} type="button" title={token}>+ {label}</button>
                  ))}
                </div>
              </div>
              <textarea
                className="marketing-body"
                id="campaign-body"
                ref={bodyRef}
                value={form.bodyHtml}
                onChange={(event) => setForm((current) => ({ ...current, bodyHtml: event.target.value }))}
                placeholder={dictionary.editor.placeholders.body}
                spellCheck="true"
              />
            </section>

            <Separator />

            <section className="marketing-action-deck" aria-label="Ações de envio">
              <div className="marketing-action-card marketing-action-primary">
                <div className="marketing-action-title"><Send aria-hidden="true" /><span>{dictionary.editor.sendNow}</span></div>
                <Button disabled={busy !== null} onClick={() => void runAction("send", (campaign) => client.sendCampaign(campaign.id), dictionary.feedback.sent)}>
                  {dictionary.editor.sendNow}
                </Button>
              </div>
              <div className="marketing-action-alternatives">
                <div className="marketing-action-row">
                  <div className="marketing-action-title"><CalendarClock aria-hidden="true" /><Label htmlFor="campaign-schedule">{dictionary.editor.schedule}</Label></div>
                  <Input id="campaign-schedule" min={new Date().toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} />
                  <Button disabled={busy !== null || !scheduledAt} onClick={() => void runAction("schedule", (campaign) => client.scheduleCampaign(campaign.id, new Date(scheduledAt).toISOString()), dictionary.feedback.scheduled)} variant="outline">
                    {dictionary.editor.schedule}
                  </Button>
                </div>
                <div className="marketing-action-row">
                  <div className="marketing-action-title"><Mail aria-hidden="true" /><Label htmlFor="campaign-test">{dictionary.editor.sendTest}</Label></div>
                  <Input id="campaign-test" onChange={(event) => setTestEmail(event.target.value)} placeholder={dictionary.editor.placeholders.testEmail} type="email" value={testEmail} />
                  <Button disabled={busy !== null} onClick={() => void sendTest()} variant="outline">{dictionary.editor.sendTest}</Button>
                </div>
              </div>
            </section>

            {activeCampaign ? (
              <>
                <div className="marketing-secondary-actions">
                  {["draft", "canceled"].includes(activeCampaign.status) ? (
                    <Button disabled={busy !== null} onClick={() => void removeCampaign()} variant="destructive">
                      <Trash2 aria-hidden="true" />Eliminar campanha
                    </Button>
                  ) : null}
                  {["draft", "scheduled", "sending"].includes(activeCampaign.status) ? (
                    <Button disabled={busy !== null} onClick={() => void runAction("cancel", (campaign) => client.cancelCampaign(campaign.id), dictionary.feedback.canceled)} variant="outline">
                      <X aria-hidden="true" />{dictionary.editor.cancel}
                    </Button>
                  ) : null}
                  {activeCampaign.failedCount > 0 || activeCampaign.status === "failed" ? (
                    <Button disabled={busy !== null} onClick={() => void runAction("retry", (campaign) => client.retryCampaign(campaign.id), dictionary.feedback.retried)} variant="outline">
                      <RotateCcw aria-hidden="true" />{dictionary.editor.retry}
                    </Button>
                  ) : null}
                </div>
                <CampaignAnalyticsPanel
                  analytics={campaignAnalytics[activeCampaign.id] ?? null}
                  dictionary={dictionary}
                />
                <RecipientPanel
                  recipients={recipients}
                  loadState={recipientsLoadState}
                  dictionary={dictionary}
                  onRemove={["draft", "scheduled", "canceled"].includes(activeCampaign.status) ? removeRecipient : undefined}
                />
              </>
            ) : null}
          </div>

          <footer className="marketing-editor-footer">
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
              <Clock3 className={busy ? "size-3.5 animate-pulse" : "size-3.5"} />
              {busy ? dictionary.editor.saving : dictionary.editor.safeHtml}
            </div>
            <Button disabled={busy !== null} onClick={() => void persist()} variant="outline">
              {busy === "save" ? dictionary.editor.saving : dictionary.editor.save}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
    </main>
  );
}
