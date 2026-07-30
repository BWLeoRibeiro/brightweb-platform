"use client";

import { BarChart3, CalendarClock, Check, Clock3, Filter, Mail, Plus, RotateCcw, Send, Users, Workflow, X } from "lucide-react";
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
} from "@brightweblabs/ui";
import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";
import { useMarketingUiClient } from "./context";
import { defaultMarketingUiDictionary } from "./dictionary";
import { SegmentWorkspace } from "./segment-workspace";
import {
  AnalyticsWorkspace,
  CampaignAnalyticsPanel,
} from "./analytics-workspace";
import { WorkflowWorkspace } from "./workflow-workspace";
import type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
} from "../analytics";
import type {
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingCampaignRecipient,
  MarketingCampaignStatus,
  MarketingSegment,
  MarketingTopic,
  MarketingUiDictionary,
  MarketingWorkflow,
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

function StatusPill({ status, dictionary }: {
  status: MarketingCampaignStatus;
  dictionary: MarketingUiDictionary;
}) {
  return <Badge variant="outline" className={statusTone[status]}>{dictionary.statuses[status]}</Badge>;
}

function RecipientPanel({ recipients, dictionary }: {
  recipients: MarketingCampaignRecipient[];
  dictionary: MarketingUiDictionary;
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
      <div className="marketing-count-grid">
        {(Object.keys(counts) as Array<keyof typeof counts>).map((status) => (
          <div className="marketing-count" key={status}>
            <strong>{counts[status]}</strong>
            <span>{dictionary.recipients.statuses[status]}</span>
          </div>
        ))}
      </div>
      {recipients.length === 0 ? (
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
  dictionary?: MarketingUiDictionary;
};

export function MarketingClient({
  initialCampaigns,
  initialTopics,
  initialSegments,
  initialWorkflows,
  initialOverview,
  initialCampaignAnalytics,
  dictionary = defaultMarketingUiDictionary,
}: MarketingClientProps) {
  const client = useMarketingUiClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [segments, setSegments] = useState(initialSegments);
  const [overview, setOverview] = useState(initialOverview);
  const [campaignAnalytics, setCampaignAnalytics] = useState(initialCampaignAnalytics);
  const [activeView, setActiveView] = useState<"campaigns" | "segments" | "analytics" | "workflows">("campaigns");
  const [activeCampaign, setActiveCampaign] = useState<MarketingCampaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [recipients, setRecipients] = useState<MarketingCampaignRecipient[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [testEmail, setTestEmail] = useState("");

  const topicMap = useMemo(
    () => new Map(initialTopics.map((topic) => [topic.id, topic])),
    [initialTopics],
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
    setActiveCampaign(null);
    setForm(emptyForm);
    setRecipients([]);
    setScheduledAt("");
    setTestEmail("");
    setEditorOpen(true);
  };

  const openCampaign = async (campaign: MarketingCampaign) => {
    setActiveCampaign(campaign);
    setForm(toForm(campaign));
    setRecipients([]);
    setScheduledAt(campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : "");
    setEditorOpen(true);
    setBusy("load");
    try {
      const [detail, nextRecipients, analytics] = await Promise.all([
        client.getCampaign(campaign.id),
        client.listRecipients(campaign.id),
        client.getCampaignAnalytics(campaign.id),
      ]);
      replaceCampaign(detail);
      setRecipients(nextRecipients);
      setCampaignAnalytics((current) => ({ ...current, [campaign.id]: analytics }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  const persist = async (successMessage?: string) => {
    if (!isValid(form)) {
      toast.error(dictionary.feedback.required);
      return null;
    }
    setBusy("save");
    try {
      const saved = activeCampaign
        ? await client.updateCampaign(activeCampaign.id, toInput(form))
        : await client.createCampaign(toInput(form));
      replaceCampaign(saved);
      toast.success(successMessage ?? (activeCampaign ? dictionary.feedback.saved : dictionary.feedback.created));
      return saved;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const runAction = async (
    action: string,
    operation: (campaign: MarketingCampaign) => Promise<MarketingCampaign>,
    message: string,
  ) => {
    const campaign = activeCampaign ?? await persist();
    if (!campaign) return;
    setBusy(action);
    try {
      const updated = await operation(campaign);
      replaceCampaign(updated);
      const [nextRecipients, analytics, nextOverview] = await Promise.all([
        client.listRecipients(updated.id),
        client.getCampaignAnalytics(updated.id),
        client.getOverview(),
      ]);
      setRecipients(nextRecipients);
      setCampaignAnalytics((current) => ({ ...current, [updated.id]: analytics }));
      setOverview(nextOverview);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
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
    setBusy("test");
    try {
      await client.sendTest(campaign.id, email);
      toast.success(dictionary.feedback.testSent);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="marketing-workspace">
      <header className="marketing-hero">
        <div>
          <p className="marketing-kicker">{dictionary.page.eyebrow}</p>
          <h1>
            {activeView === "campaigns"
              ? dictionary.page.title
              : activeView === "segments"
                ? dictionary.segments.title
                : activeView === "analytics"
                  ? dictionary.analytics.title
                  : dictionary.workflows.title}
          </h1>
          <p>
            {activeView === "campaigns"
              ? dictionary.page.subtitle
              : activeView === "segments"
                ? dictionary.segments.subtitle
                : activeView === "analytics"
                  ? dictionary.analytics.subtitle
                  : dictionary.workflows.subtitle}
          </p>
        </div>
        {activeView === "campaigns" ? (
          <Button onClick={beginCreate} size="lg">
            <Plus aria-hidden="true" />{dictionary.page.newCampaign}
          </Button>
        ) : null}
      </header>

      <nav className="flex w-fit gap-1 rounded-xl border bg-muted p-1" aria-label="Marketing">
        <Button
          onClick={() => setActiveView("campaigns")}
          size="sm"
          variant={activeView === "campaigns" ? "default" : "ghost"}
        >
          <Mail aria-hidden="true" />
          {dictionary.page.campaignsTab}
        </Button>
        <Button
          onClick={() => setActiveView("segments")}
          size="sm"
          variant={activeView === "segments" ? "default" : "ghost"}
        >
          <Filter aria-hidden="true" />
          {dictionary.page.segmentsTab}
        </Button>
        <Button
          onClick={() => setActiveView("analytics")}
          size="sm"
          variant={activeView === "analytics" ? "default" : "ghost"}
        >
          <BarChart3 aria-hidden="true" />
          {dictionary.page.analyticsTab}
        </Button>
        <Button
          onClick={() => setActiveView("workflows")}
          size="sm"
          variant={activeView === "workflows" ? "default" : "ghost"}
        >
          <Workflow aria-hidden="true" />
          {dictionary.workflows.tab}
        </Button>
      </nav>

      {activeView === "campaigns" ? (
      <Card className="marketing-ledger">
        <CardContent className="p-0">
          <div className="marketing-ledger-heading">
            <div>
              <p className="marketing-kicker">{dictionary.list.title}</p>
              <p className="text-body text-muted-foreground">
                {dictionary.list.campaignCount(campaigns.length)}
              </p>
            </div>
            <Mail className="text-muted-foreground" aria-hidden="true" />
          </div>
          {campaigns.length === 0 ? (
            <div className="marketing-empty">
              <div className="marketing-empty-icon"><Mail aria-hidden="true" /></div>
              <h2>{dictionary.page.emptyTitle}</h2>
              <p>{dictionary.page.emptyDescription}</p>
              <Button onClick={beginCreate} variant="outline">
                <Plus aria-hidden="true" />{dictionary.page.newCampaign}
              </Button>
            </div>
          ) : (
            <div className="marketing-campaign-list">
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
                      <strong>{campaign.name}</strong>
                      <small>{campaign.subject || dictionary.list.noSubject}</small>
                    </span>
                  </span>
                  <span className="marketing-row-topic">{topicMap.get(campaign.topicId)?.label ?? "—"}</span>
                  <span className="marketing-row-count">
                    <Users aria-hidden="true" />
                    {campaign.totalRecipients === 0 ? "—" : `${campaign.sentCount}/${campaign.totalRecipients}`}
                  </span>
                  <span className="marketing-row-date">{formatDate(campaign.createdAt, dictionary.locale)}</span>
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
          topics={initialTopics}
        />
      ) : activeView === "analytics" ? (
        <AnalyticsWorkspace
          campaignAnalytics={campaignAnalytics}
          campaigns={campaigns}
          dictionary={dictionary}
          onOpenCampaign={(campaign) => void openCampaign(campaign)}
          overview={overview}
        />
      ) : (
        <WorkflowWorkspace
          dictionary={dictionary}
          initialWorkflows={initialWorkflows}
        />
      )}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
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
                  {initialTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
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
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    segmentId: event.target.value,
                  }))}
                >
                  <option value="">{dictionary.editor.placeholders.segment}</option>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
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

            <section className="marketing-action-deck">
              <div className="marketing-action-card">
                <div className="marketing-action-title"><Send aria-hidden="true" /><span>{dictionary.editor.sendNow}</span></div>
                <Button disabled={busy !== null} onClick={() => void runAction("send", (campaign) => client.sendCampaign(campaign.id), dictionary.feedback.sent)}>
                  {dictionary.editor.sendNow}
                </Button>
              </div>
              <div className="marketing-action-card">
                <div className="marketing-action-title"><CalendarClock aria-hidden="true" /><Label htmlFor="campaign-schedule">{dictionary.editor.schedule}</Label></div>
                <Input id="campaign-schedule" min={new Date().toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} />
                <Button disabled={busy !== null || !scheduledAt} onClick={() => void runAction("schedule", (campaign) => client.scheduleCampaign(campaign.id, new Date(scheduledAt).toISOString()), dictionary.feedback.scheduled)} variant="outline">
                  {dictionary.editor.schedule}
                </Button>
              </div>
              <div className="marketing-action-card">
                <div className="marketing-action-title"><Mail aria-hidden="true" /><Label htmlFor="campaign-test">{dictionary.editor.sendTest}</Label></div>
                <Input id="campaign-test" onChange={(event) => setTestEmail(event.target.value)} placeholder={dictionary.editor.placeholders.testEmail} type="email" value={testEmail} />
                <Button disabled={busy !== null} onClick={() => void sendTest()} variant="outline">{dictionary.editor.sendTest}</Button>
              </div>
            </section>

            {activeCampaign ? (
              <>
                <div className="marketing-secondary-actions">
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
                <RecipientPanel recipients={recipients} dictionary={dictionary} />
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
