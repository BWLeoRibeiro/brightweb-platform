"use client";

import { ChevronDown, ChevronUp, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Input, Label } from "@brightweblabs/ui";
import { useState } from "react";
import { toast } from "sonner";
import { useMarketingUiClient } from "./context";
import type { MarketingTopic, MarketingUiDictionary } from "./types";

type TopicForm = {
  label: string;
  slug: string;
  description: string;
};

const emptyForm: TopicForm = { label: "", slug: "", description: "" };

function normalizePositions(topics: MarketingTopic[]) {
  return [...topics]
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label))
    .map((topic, index) => ({ ...topic, position: index * 10 }));
}

export function TopicWorkspace({
  dictionary,
  onTopicsChange,
  topics,
}: {
  dictionary: MarketingUiDictionary & { topics: NonNullable<MarketingUiDictionary["topics"]> };
  onTopicsChange: (topics: MarketingTopic[]) => void;
  topics: MarketingTopic[];
}) {
  const client = useMarketingUiClient();
  const [form, setForm] = useState<TopicForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const orderedTopics = normalizePositions(topics);

  const beginCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const beginEdit = (topic: MarketingTopic) => {
    setEditingId(topic.id);
    setForm({ label: topic.label, slug: topic.slug, description: topic.description ?? "" });
    setFormOpen(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  };

  const save = async () => {
    if (!form.label.trim() || (!editingId && !form.slug.trim())) {
      toast.error(dictionary.feedback.required);
      return;
    }
    setBusy("save");
    try {
      const saved = editingId
        ? await client.updateTopic(editingId, {
          label: form.label,
          description: form.description || null,
        })
        : await client.createTopic({
          label: form.label,
          slug: form.slug,
          description: form.description || null,
          position: orderedTopics.length * 10,
        });
      onTopicsChange(normalizePositions(
        topics.some((topic) => topic.id === saved.id)
          ? topics.map((topic) => topic.id === saved.id ? saved : topic)
          : [...topics, saved],
      ));
      toast.success(editingId ? dictionary.topics.saved : dictionary.topics.created);
      closeForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (topic: MarketingTopic) => {
    setBusy(topic.id);
    try {
      const saved = await client.updateTopic(topic.id, { isActive: !topic.isActive });
      onTopicsChange(topics.map((item) => item.id === saved.id ? saved : item));
      toast.success(dictionary.topics.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (topic: MarketingTopic) => {
    if (!window.confirm(`Eliminar definitivamente o tópico “${topic.label}”? Se estiver em uso, desative-o.`)) return;
    setBusy(topic.id);
    try {
      await client.deleteTopic(topic.id);
      onTopicsChange(topics.filter((item) => item.id !== topic.id));
      toast.success("Tópico eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  const move = async (index: number, offset: -1 | 1) => {
    const otherIndex = index + offset;
    const topic = orderedTopics[index];
    const other = orderedTopics[otherIndex];
    if (!topic || !other) return;
    setBusy(topic.id);
    try {
      if (!client.reorderTopics) throw new Error("Topic reordering is not supported by this client.");
      const nextOrder = [...orderedTopics];
      [nextOrder[index], nextOrder[otherIndex]] = [other, topic];
      onTopicsChange(await client.reorderTopics(nextOrder.map((item) => item.id)));
      toast.success(dictionary.topics.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="grid gap-4" aria-labelledby="marketing-topics-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="marketing-kicker">{dictionary.topics.eyebrow}</p>
          <h2 className="mt-1 text-title" id="marketing-topics-title">{dictionary.topics.title}</h2>
          <p className="mt-1 max-w-[42rem] text-body text-muted-foreground">{dictionary.topics.subtitle}</p>
        </div>
        <Button onClick={beginCreate}>
          <Plus aria-hidden="true" />
          {dictionary.topics.newTopic}
        </Button>
      </div>

      {formOpen ? (
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="topic-label">{dictionary.topics.fields.label}</Label>
              <Input
                id="topic-label"
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder={dictionary.topics.placeholders.label}
                value={form.label}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topic-slug">{dictionary.topics.fields.slug}</Label>
              <Input
                disabled={editingId !== null}
                id="topic-slug"
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder={dictionary.topics.placeholders.slug}
                value={form.slug}
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="topic-description">{dictionary.topics.fields.description}</Label>
              <Input
                id="topic-description"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={dictionary.topics.placeholders.description}
                value={form.description}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <Button onClick={closeForm} variant="ghost">{dictionary.topics.cancel}</Button>
              <Button disabled={busy === "save"} onClick={() => void save()}>
                {dictionary.topics.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {orderedTopics.length === 0 ? (
        <Card>
          <CardContent className="grid justify-items-center gap-3 p-10 text-center">
            <Tags className="size-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-title">{dictionary.topics.emptyTitle}</h3>
            <p className="text-body text-muted-foreground">{dictionary.topics.emptyDescription}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {orderedTopics.map((topic, index) => (
            <Card key={topic.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-body">{topic.label}</strong>
                    <Badge variant={topic.isActive ? "default" : "outline"}>
                      {topic.isActive ? dictionary.topics.active : dictionary.topics.inactive}
                    </Badge>
                    <code className="text-meta text-muted-foreground">{topic.slug}</code>
                  </div>
                  {topic.description ? (
                    <p className="mt-1 text-body text-muted-foreground">{topic.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    aria-label={dictionary.topics.moveUp}
                    disabled={index === 0 || busy !== null}
                    onClick={() => void move(index, -1)}
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronUp aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label={dictionary.topics.moveDown}
                    disabled={index === orderedTopics.length - 1 || busy !== null}
                    onClick={() => void move(index, 1)}
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronDown aria-hidden="true" />
                  </Button>
                  <Button onClick={() => beginEdit(topic)} size="sm" variant="outline">
                    <Pencil aria-hidden="true" />
                    {dictionary.topics.edit}
                  </Button>
                  <Button
                    disabled={busy !== null}
                    onClick={() => void toggleActive(topic)}
                    size="sm"
                    variant="outline"
                  >
                    {topic.isActive ? dictionary.topics.deactivate : dictionary.topics.activate}
                  </Button>
                  <Button
                    aria-label={`Eliminar ${topic.label}`}
                    disabled={busy !== null}
                    onClick={() => void remove(topic)}
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
