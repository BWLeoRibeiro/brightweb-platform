"use client";

import { StyledSelect } from "@brightweblabs/ui";

import { Filter, Plus, Trash2, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@brightweblabs/ui";
import { useEffect, useRef, useState } from "react";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import { toast } from "sonner";
import { useMarketingUiClient } from "./context";
import type {
  MarketingSegment,
  MarketingSegmentPreview,
  MarketingTopic,
  MarketingUiDictionary,
} from "./types";
import type { MarketingSegmentRule } from "../segments";

type SegmentForm = {
  name: string;
  description: string;
  rule: MarketingSegmentRule;
};

const emptyForm: SegmentForm = {
  name: "",
  description: "",
  rule: { excludeSuppressed: true },
};

function formFromSegment(segment: MarketingSegment): SegmentForm {
  return {
    name: segment.name,
    description: segment.description ?? "",
    rule: { excludeSuppressed: true, ...segment.rule },
  };
}

export function SegmentWorkspace({
  segments,
  topics,
  dictionary,
  onSegmentsChange,
  createRequest = 0,
  onMutated,
}: {
  segments: MarketingSegment[];
  topics: MarketingTopic[];
  dictionary: MarketingUiDictionary;
  onSegmentsChange: (segments: MarketingSegment[]) => void;
  createRequest?: number;
  onMutated?: () => void;
}) {
  const client = useMarketingUiClient();
  const [active, setActive] = useState<MarketingSegment | null>(null);
  const [form, setForm] = useState<SegmentForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewLoadState, setPreviewLoadState] = useState<"pending" | "fulfilled" | "rejected">("pending");
  const [previewHasData, setPreviewHasData] = useState(false);
  const [preview, setPreview] = useState<MarketingSegmentPreview>({
    count: 0,
    sample: [],
  });
  const previewRequestRef = useRef(createLatestRequestController());
  const editorGenerationRef = useRef(0);
  const handledCreateRequestRef = useRef(createRequest);

  useEffect(() => {
    if (!open) return;
    previewRequestRef.current.abort();
    setPreviewLoadState("pending");
    const timer = window.setTimeout(() => {
      const latest = previewRequestRef.current.begin();
      void client.previewSegment(form.rule, 8, active?.id, { signal: latest.signal })
        .then((result) => {
          if (latest.isCurrent()) {
            setPreview(result);
            setPreviewHasData(true);
            setPreviewLoadState("fulfilled");
          }
        })
        .catch((error) => {
          if (latest.isCurrent() && !isAbortError(error)) {
            setPreviewLoadState("rejected");
            toast.error(
              error instanceof Error ? error.message : dictionary.feedback.genericError,
            );
          }
        })
        .finally(() => latest.finish());
    }, 300);
    return () => {
      window.clearTimeout(timer);
      previewRequestRef.current.abort();
    };
  }, [active?.id, client, dictionary.feedback.genericError, form.rule, open]);

  const beginCreate = () => {
    editorGenerationRef.current += 1;
    setActive(null);
    setForm(emptyForm);
    setPreview({ count: 0, sample: [] });
    setPreviewHasData(false);
    setPreviewLoadState("pending");
    setOpen(true);
  };

  useEffect(() => {
    if (createRequest === handledCreateRequestRef.current) return;
    handledCreateRequestRef.current = createRequest;
    beginCreate();
  }, [createRequest]);

  const beginEdit = (segment: MarketingSegment) => {
    editorGenerationRef.current += 1;
    setActive(segment);
    setForm(formFromSegment(segment));
    setPreview({ count: 0, sample: [] });
    setPreviewHasData(false);
    setPreviewLoadState("pending");
    setOpen(true);
  };

  const updateRule = (patch: Partial<MarketingSegmentRule>) => {
    setForm((current) => ({
      ...current,
      rule: { ...current.rule, ...patch },
    }));
  };

  const toggleTopic = (topicId: string) => {
    const current = form.rule.topicIds ?? [];
    updateRule({
      topicIds: current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(dictionary.segments.fields.name);
      return;
    }
    const editorGeneration = editorGenerationRef.current;
    setBusy(true);
    try {
      const input = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        rule: form.rule,
      };
      const saved = active
        ? await client.updateSegment(active.id, input)
        : await client.createSegment(input);
      if (editorGeneration !== editorGenerationRef.current) return;
      onSegmentsChange(
        active
          ? segments.map((segment) => segment.id === saved.id ? saved : segment)
          : [saved, ...segments],
      );
      setActive(saved);
      setForm(formFromSegment(saved));
      onMutated?.();
      toast.success(
        active ? dictionary.segments.saved : dictionary.segments.created,
      );
    } catch (error) {
      if (editorGeneration === editorGenerationRef.current) toast.error(
        error instanceof Error ? error.message : dictionary.feedback.genericError,
      );
    } finally {
      if (editorGeneration === editorGenerationRef.current) setBusy(false);
    }
  };

  const remove = async () => {
    if (!active) return;
    if (!window.confirm(`Eliminar definitivamente o segmento “${active.name}”?`)) return;
    const editorGeneration = editorGenerationRef.current;
    setBusy(true);
    try {
      await client.deleteSegment(active.id);
      if (editorGeneration !== editorGenerationRef.current) return;
      onSegmentsChange(segments.filter((segment) => segment.id !== active.id));
      setOpen(false);
      onMutated?.();
      toast.success(dictionary.segments.deleted);
    } catch (error) {
      if (editorGeneration === editorGenerationRef.current) toast.error(
        error instanceof Error ? error.message : dictionary.feedback.genericError,
      );
    } finally {
      if (editorGeneration === editorGenerationRef.current) setBusy(false);
    }
  };

  return (
    <>
      <Card className="marketing-ledger">
        <CardContent className="p-0">
          <div className="marketing-ledger-heading">
            <div>
              <p className="marketing-kicker">{dictionary.segments.eyebrow}</p>
              <h2 className="text-heading-3 font-semibold">{dictionary.segments.title}</h2>
              <p className="text-body text-muted-foreground">
                {dictionary.segments.subtitle}
              </p>
            </div>
          </div>
          {segments.length === 0 ? (
            <div className="marketing-empty">
              <div className="marketing-empty-icon"><Filter aria-hidden="true" /></div>
              <h2>{dictionary.segments.emptyTitle}</h2>
              <p>{dictionary.segments.emptyDescription}</p>
            </div>
          ) : (
            <div className="marketing-campaign-list">
              {segments.map((segment) => (
                <button
                  className="marketing-campaign-row"
                  key={segment.id}
                  onClick={() => beginEdit(segment)}
                  type="button"
                >
                  <span className="marketing-campaign-primary">
                    <span className="marketing-campaign-mark" aria-hidden="true">
                      <Filter />
                    </span>
                    <span className="min-w-0">
                      <strong className="text-title">{segment.name}</strong>
                      <small>{segment.description || dictionary.segments.anyTopicHint}</small>
                    </span>
                  </span>
                  <span className="marketing-row-topic text-data">
                    {segment.rule.topicIds?.length
                      ? dictionary.segments.topicCount(segment.rule.topicIds.length)
                      : dictionary.segments.engagementTypes.any}
                  </span>
                  <span className="marketing-row-date text-data">
                    {new Intl.DateTimeFormat(dictionary.locale).format(
                      new Date(segment.updatedAt),
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          previewRequestRef.current.abort();
          editorGenerationRef.current += 1;
        }
        setOpen(nextOpen);
      }}>
        <SheetContent className="marketing-editor" side="right">
          <SheetHeader className="marketing-editor-header">
            <div>
              <p className="marketing-kicker">
                {active
                  ? dictionary.segments.editorEdit
                  : dictionary.segments.editorCreate}
              </p>
              <SheetTitle>{form.name || dictionary.segments.newSegment}</SheetTitle>
              <SheetDescription>{dictionary.segments.anyTopicHint}</SheetDescription>
            </div>
          </SheetHeader>

          <div className="marketing-editor-scroll">
            <section className="marketing-form-grid">
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="segment-name">{dictionary.segments.fields.name}</Label>
                <Input
                  id="segment-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))}
                  placeholder={dictionary.segments.placeholders.name}
                />
              </div>
              <div className="marketing-field marketing-field-wide">
                <Label htmlFor="segment-description">
                  {dictionary.segments.fields.description}
                </Label>
                <Input
                  id="segment-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))}
                  placeholder={dictionary.segments.placeholders.description}
                />
              </div>

              <fieldset className="marketing-field marketing-field-wide">
                <legend className="text-body font-semibold">
                  {dictionary.segments.fields.topics}
                </legend>
                <p className="mb-3 text-meta text-muted-foreground">
                  {dictionary.segments.anyTopicHint}
                </p>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => {
                    const selected = form.rule.topicIds?.includes(topic.id) ?? false;
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-body"
                        key={topic.id}
                      >
                        <Checkbox
                          checked={selected}
                          onChange={() => toggleTopic(topic.id)}
                        />
                        {topic.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="marketing-field">
                <Label htmlFor="segment-language">
                  {dictionary.segments.fields.preferredLanguage}
                </Label>
                <Input
                  id="segment-language"
                  value={form.rule.preferredLanguage ?? ""}
                  onChange={(event) => updateRule({
                    preferredLanguage: event.target.value || undefined,
                  })}
                  placeholder={dictionary.segments.placeholders.preferredLanguage}
                />
              </div>
              <div className="marketing-field">
                <Label htmlFor="segment-engagement-days">
                  {dictionary.segments.fields.engagedWithinDays}
                </Label>
                <Input
                  id="segment-engagement-days"
                  min="1"
                  type="number"
                  value={form.rule.engagedWithinDays ?? ""}
                  onChange={(event) => updateRule({
                    engagedWithinDays: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })}
                  placeholder={dictionary.segments.placeholders.engagedWithinDays}
                />
              </div>
              <div className="marketing-field">
                <Label htmlFor="segment-created-after">
                  {dictionary.segments.fields.createdAfter}
                </Label>
                <Input
                  id="segment-created-after"
                  type="date"
                  value={form.rule.createdAfter?.slice(0, 10) ?? ""}
                  onChange={(event) => updateRule({
                    createdAfter: event.target.value || undefined,
                  })}
                />
              </div>
              <div className="marketing-field">
                <Label htmlFor="segment-created-before">
                  {dictionary.segments.fields.createdBefore}
                </Label>
                <Input
                  id="segment-created-before"
                  type="date"
                  value={form.rule.createdBefore?.slice(0, 10) ?? ""}
                  onChange={(event) => updateRule({
                    createdBefore: event.target.value || undefined,
                  })}
                />
              </div>
              <div className="marketing-field">
                <Label htmlFor="segment-engagement-type">
                  {dictionary.segments.fields.engagementType}
                </Label>
                <StyledSelect
                  className="marketing-select"
                  id="segment-engagement-type"
                  value={form.rule.engagementType ?? ""}
                  onChange={(event) => updateRule({
                    engagementType: event.target.value
                      ? event.target.value as "opened" | "clicked"
                      : undefined,
                  })}
                >
                  <option value="">{dictionary.segments.engagementTypes.any}</option>
                  <option value="opened">{dictionary.segments.engagementTypes.opened}</option>
                  <option value="clicked">{dictionary.segments.engagementTypes.clicked}</option>
                </StyledSelect>
              </div>
              <label className="marketing-field flex-row items-center gap-3 self-end rounded-lg border p-3">
                <Checkbox
                  checked={form.rule.excludeSuppressed !== false}
                  onChange={(event) => updateRule({
                    excludeSuppressed: event.target.checked,
                  })}
                />
                <span className="text-body">
                  {dictionary.segments.fields.excludeSuppressed}
                </span>
              </label>
            </section>

            <section className="marketing-recipient-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="marketing-kicker">{dictionary.segments.previewTitle}</p>
                  <p className="text-body text-muted-foreground">
                    {previewLoadState === "pending"
                      ? dictionary.segments.previewLoading
                      : previewLoadState === "rejected" && !previewHasData
                        ? dictionary.feedback.genericError
                        : `${preview.count} ${dictionary.segments.previewCount}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-data-sm">
                  <Users aria-hidden="true" className="mr-1 size-3.5" />
                  {(previewLoadState === "pending" || previewLoadState === "rejected") && !previewHasData ? "—" : preview.count}
                </Badge>
              </div>
              {previewLoadState === "pending" && !previewHasData ? (
                <div className="space-y-2" aria-busy="true" aria-label={dictionary.segments.previewLoading}>
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : previewLoadState === "rejected" && !previewHasData ? (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-body text-destructive">
                  {dictionary.feedback.genericError}
                </p>
              ) : preview.sample.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-body text-muted-foreground">
                  {dictionary.segments.previewEmpty}
                </p>
              ) : (
                <div className="marketing-recipient-list">
                  {preview.sample.map((contact) => (
                    <div className="marketing-recipient-row" key={contact.id}>
                      <div className="min-w-0">
                        <p className="truncate text-body font-semibold">
                          {contact.name || contact.email}
                        </p>
                        <p className="truncate text-meta text-muted-foreground">
                          {contact.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <footer className="marketing-editor-footer">
            <div>
              {active ? (
                <Button
                  disabled={busy}
                  onClick={() => void remove()}
                  variant="outline"
                >
                  <Trash2 aria-hidden="true" />
                  {dictionary.segments.delete}
                </Button>
              ) : null}
            </div>
            <Button disabled={busy} onClick={() => void save()}>
              {dictionary.segments.save}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}
