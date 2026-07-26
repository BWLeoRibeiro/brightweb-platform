"use client";

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
} from "@brightweblabs/ui";
import { useEffect, useState } from "react";
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
}: {
  segments: MarketingSegment[];
  topics: MarketingTopic[];
  dictionary: MarketingUiDictionary;
  onSegmentsChange: (segments: MarketingSegment[]) => void;
}) {
  const client = useMarketingUiClient();
  const [active, setActive] = useState<MarketingSegment | null>(null);
  const [form, setForm] = useState<SegmentForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<MarketingSegmentPreview>({
    count: 0,
    sample: [],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewing(true);
      void client.previewSegment(form.rule, 8, active?.id)
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error ? error.message : dictionary.feedback.genericError,
            );
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active?.id, client, dictionary.feedback.genericError, form.rule, open]);

  const beginCreate = () => {
    setActive(null);
    setForm(emptyForm);
    setPreview({ count: 0, sample: [] });
    setOpen(true);
  };

  const beginEdit = (segment: MarketingSegment) => {
    setActive(segment);
    setForm(formFromSegment(segment));
    setPreview({ count: 0, sample: [] });
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
      onSegmentsChange(
        active
          ? segments.map((segment) => segment.id === saved.id ? saved : segment)
          : [saved, ...segments],
      );
      setActive(saved);
      setForm(formFromSegment(saved));
      toast.success(
        active ? dictionary.segments.saved : dictionary.segments.created,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.feedback.genericError,
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await client.deleteSegment(active.id);
      onSegmentsChange(segments.filter((segment) => segment.id !== active.id));
      setOpen(false);
      toast.success(dictionary.segments.deleted);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : dictionary.feedback.genericError,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="marketing-ledger">
        <CardContent className="p-0">
          <div className="marketing-ledger-heading">
            <div>
              <p className="marketing-kicker">{dictionary.segments.eyebrow}</p>
              <h2 className="text-xl font-semibold">{dictionary.segments.title}</h2>
              <p className="text-sm text-muted-foreground">
                {dictionary.segments.subtitle}
              </p>
            </div>
            <Button onClick={beginCreate}>
              <Plus aria-hidden="true" />
              {dictionary.segments.newSegment}
            </Button>
          </div>
          {segments.length === 0 ? (
            <div className="marketing-empty">
              <div className="marketing-empty-icon"><Filter aria-hidden="true" /></div>
              <h2>{dictionary.segments.emptyTitle}</h2>
              <p>{dictionary.segments.emptyDescription}</p>
              <Button onClick={beginCreate} variant="outline">
                <Plus aria-hidden="true" />
                {dictionary.segments.newSegment}
              </Button>
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
                      <strong>{segment.name}</strong>
                      <small>{segment.description || dictionary.segments.anyTopicHint}</small>
                    </span>
                  </span>
                  <span className="marketing-row-topic">
                    {segment.rule.topicIds?.length
                      ? `${segment.rule.topicIds.length} tópico(s)`
                      : dictionary.segments.engagementTypes.any}
                  </span>
                  <span className="marketing-row-date">
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

      <Sheet open={open} onOpenChange={setOpen}>
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
                <legend className="text-sm font-medium">
                  {dictionary.segments.fields.topics}
                </legend>
                <p className="mb-3 text-xs text-muted-foreground">
                  {dictionary.segments.anyTopicHint}
                </p>
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => {
                    const selected = form.rule.topicIds?.includes(topic.id) ?? false;
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
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
                <select
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
                </select>
              </div>
              <label className="marketing-field flex-row items-center gap-3 self-end rounded-lg border p-3">
                <Checkbox
                  checked={form.rule.excludeSuppressed !== false}
                  onChange={(event) => updateRule({
                    excludeSuppressed: event.target.checked,
                  })}
                />
                <span className="text-sm">
                  {dictionary.segments.fields.excludeSuppressed}
                </span>
              </label>
            </section>

            <section className="marketing-recipient-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="marketing-kicker">{dictionary.segments.previewTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {previewing
                      ? dictionary.segments.previewLoading
                      : `${preview.count} ${dictionary.segments.previewCount}`}
                  </p>
                </div>
                <Badge variant="outline">
                  <Users aria-hidden="true" className="mr-1 size-3.5" />
                  {preview.count}
                </Badge>
              </div>
              {preview.sample.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {dictionary.segments.previewEmpty}
                </p>
              ) : (
                <div className="marketing-recipient-list">
                  {preview.sample.map((contact) => (
                    <div className="marketing-recipient-row" key={contact.id}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {contact.name || contact.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
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
