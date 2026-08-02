"use client";

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Mail,
  Pause,
  Play,
  Plus,
  Tag,
  Trash2,
  Workflow,
} from "lucide-react";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import { toast } from "sonner";
import { useMarketingUiClient } from "./context";
import type {
  MarketingUiDictionary,
  MarketingWorkflow,
  MarketingWorkflowInput,
  MarketingWorkflowNode,
  MarketingWorkflowNodeInput,
  MarketingWorkflowNodeType,
  MarketingWorkflowRun,
  MarketingWorkflowTriggerType,
} from "./types";

type WorkflowForm = {
  name: string;
  description: string;
  triggerType: MarketingWorkflowTriggerType;
  triggerValue: string;
};

type DraftNode = {
  key: string;
  id?: string;
  type: MarketingWorkflowNodeType;
  subject: string;
  body: string;
  topic: string;
  duration: string;
  durationUnit: "minutes" | "hours" | "days";
  tag: string;
};

const emptyForm: WorkflowForm = {
  name: "",
  description: "",
  triggerType: "contact_subscribed",
  triggerValue: "",
};

const workflowStatusTone: Record<MarketingWorkflow["status"], string> = {
  draft: "border-border bg-muted text-muted-foreground",
  active: "border-success/25 bg-success/10 text-success",
  paused: "border-warning/25 bg-warning/10 text-warning",
};

const runStatusTone: Record<MarketingWorkflowRun["status"], string> = {
  active: "border-info/25 bg-info/10 text-info",
  completed: "border-success/25 bg-success/10 text-success",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
  canceled: "border-border bg-muted text-muted-foreground",
};

function triggerValue(workflow: MarketingWorkflow) {
  const config = workflow.triggerConfig;
  if (workflow.triggerType === "contact_subscribed") {
    return String(config.topicId ?? config.topic ?? "");
  }
  if (workflow.triggerType === "form_submitted") {
    return String(config.formId ?? config.form ?? "");
  }
  return String(config.toStatus ?? config.targetStatus ?? "");
}

function toForm(workflow: MarketingWorkflow): WorkflowForm {
  return {
    name: workflow.name,
    description: workflow.description ?? "",
    triggerType: workflow.triggerType,
    triggerValue: triggerValue(workflow),
  };
}

function createDraftNode(type: MarketingWorkflowNodeType, index: number): DraftNode {
  return {
    key: `new-${Date.now()}-${index}`,
    type,
    subject: "",
    body: "",
    topic: "",
    duration: "1",
    durationUnit: "hours",
    tag: "",
  };
}

function toDraftNode(node: MarketingWorkflowNode): DraftNode {
  const durationMinutes = Number(node.config.durationMinutes ?? node.config.duration_minutes ?? 60);
  const durationUnit = durationMinutes > 0 && durationMinutes % 1440 === 0
    ? "days"
    : durationMinutes > 0 && durationMinutes % 60 === 0 ? "hours" : "minutes";
  const divisor = durationUnit === "days" ? 1440 : durationUnit === "hours" ? 60 : 1;
  return {
    key: node.id,
    id: node.id,
    type: node.type,
    subject: String(node.config.subject ?? ""),
    body: String(node.config.bodyHtml ?? node.config.body ?? ""),
    topic: String(node.config.topicId ?? node.config.topic ?? ""),
    duration: String(Math.max(1, durationMinutes / divisor)),
    durationUnit,
    tag: String(node.config.tag ?? ""),
  };
}

function toWorkflowInput(form: WorkflowForm): MarketingWorkflowInput {
  const value = form.triggerValue.trim();
  const triggerConfig = form.triggerType === "contact_subscribed"
    ? { topicId: value }
    : form.triggerType === "form_submitted"
      ? { formId: value }
      : { toStatus: value };
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    triggerType: form.triggerType,
    triggerConfig,
  };
}

function toNodeInput(node: DraftNode, position: number): MarketingWorkflowNodeInput {
  if (node.type === "send_email") {
    return {
      id: node.id,
      nodeType: node.type,
      position,
      config: {
        subject: node.subject.trim(),
        bodyHtml: node.body,
        ...(node.topic.trim() ? { topicId: node.topic.trim() } : {}),
      },
    };
  }
  if (node.type === "wait") {
    const multiplier = node.durationUnit === "days" ? 1440 : node.durationUnit === "hours" ? 60 : 1;
    return {
      id: node.id,
      nodeType: node.type,
      position,
      config: { durationMinutes: Math.max(1, Number(node.duration) || 1) * multiplier },
    };
  }
  return {
    id: node.id,
    nodeType: node.type,
    position,
    config: { tag: node.tag.trim() },
  };
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function isNodeValid(node: DraftNode) {
  if (node.type === "send_email") return Boolean(node.subject.trim() && node.body.trim());
  if (node.type === "wait") return Number(node.duration) > 0;
  return Boolean(node.tag.trim());
}

export type WorkflowWorkspaceProps = {
  initialWorkflows: MarketingWorkflow[];
  dictionary: MarketingUiDictionary;
  createRequest?: number;
  onMutated?: () => void;
};

export function WorkflowWorkspace({
  initialWorkflows,
  dictionary,
  createRequest = 0,
  onMutated,
}: WorkflowWorkspaceProps) {
  const client = useMarketingUiClient();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [active, setActive] = useState<MarketingWorkflow | null>(null);
  const [form, setForm] = useState<WorkflowForm>(emptyForm);
  const [nodes, setNodes] = useState<DraftNode[]>([]);
  const [runs, setRuns] = useState<MarketingWorkflowRun[]>([]);
  const [runsLoadState, setRunsLoadState] = useState<"pending" | "fulfilled" | "rejected">("fulfilled");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [addType, setAddType] = useState<MarketingWorkflowNodeType>("send_email");
  const workflowLoadGeneration = useRef(0);
  const editorGenerationRef = useRef(0);
  const workflowRequestRef = useRef(createLatestRequestController());
  const handledCreateRequestRef = useRef(createRequest);

  useEffect(() => setWorkflows(initialWorkflows), [initialWorkflows]);

  const triggerLabel = useMemo(() => {
    if (form.triggerType === "contact_subscribed") {
      return {
        label: dictionary.workflows.triggerConfig.topic,
        placeholder: dictionary.workflows.triggerConfig.topicPlaceholder,
      };
    }
    if (form.triggerType === "form_submitted") {
      return {
        label: dictionary.workflows.triggerConfig.form,
        placeholder: dictionary.workflows.triggerConfig.formPlaceholder,
      };
    }
    return {
      label: dictionary.workflows.triggerConfig.targetStatus,
      placeholder: dictionary.workflows.triggerConfig.statusPlaceholder,
    };
  }, [dictionary.workflows.triggerConfig, form.triggerType]);

  const replaceWorkflow = (workflow: MarketingWorkflow) => {
    setWorkflows((current) => {
      const exists = current.some((item) => item.id === workflow.id);
      return exists
        ? current.map((item) => item.id === workflow.id ? workflow : item)
        : [workflow, ...current];
    });
    setActive(workflow);
  };

  const beginCreate = () => {
    editorGenerationRef.current += 1;
    workflowRequestRef.current.abort();
    workflowLoadGeneration.current += 1;
    setActive(null);
    setForm(emptyForm);
    setNodes([]);
    setRuns([]);
    setRunsLoadState("fulfilled");
    setBusy(null);
    setOpen(true);
  };

  useEffect(() => {
    if (createRequest === handledCreateRequestRef.current) return;
    handledCreateRequestRef.current = createRequest;
    beginCreate();
  }, [createRequest]);

  const openWorkflow = async (workflow: MarketingWorkflow) => {
    editorGenerationRef.current += 1;
    const latest = workflowRequestRef.current.begin();
    const generation = ++workflowLoadGeneration.current;
    setActive(workflow);
    setForm(toForm(workflow));
    setNodes(workflow.nodes.map(toDraftNode));
    setRuns([]);
    setRunsLoadState("pending");
    setOpen(true);
    setBusy("load");
    try {
      const [detail, recentRuns] = await Promise.all([
        client.getWorkflow(workflow.id, { signal: latest.signal }),
        client.listWorkflowRuns(workflow.id, { signal: latest.signal }),
      ]);
      if (!latest.isCurrent() || generation !== workflowLoadGeneration.current) return;
      replaceWorkflow({ ...detail, runCount: recentRuns.length, countsKnown: true });
      setForm(toForm(detail));
      setNodes(detail.nodes.map(toDraftNode));
      setRuns(recentRuns);
      setRunsLoadState("fulfilled");
    } catch (error) {
      if (isAbortError(error) || !latest.isCurrent() || generation !== workflowLoadGeneration.current) return;
      setRunsLoadState("rejected");
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      const current = latest.isCurrent();
      latest.finish();
      if (current && generation === workflowLoadGeneration.current) setBusy(null);
    }
  };

  useEffect(() => () => workflowRequestRef.current.abort(), []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      workflowRequestRef.current.abort();
      editorGenerationRef.current += 1;
    }
    setOpen(nextOpen);
  };

  const updateNode = (key: string, patch: Partial<DraftNode>) => {
    setNodes((current) => current.map((node) => node.key === key ? { ...node, ...patch } : node));
  };

  const moveNode = (index: number, direction: -1 | 1) => {
    setNodes((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.triggerValue.trim() || nodes.some((node) => !isNodeValid(node))) {
      toast.error(dictionary.feedback.required);
      return;
    }
    const editorGeneration = editorGenerationRef.current;
    setBusy("save");
    try {
      const saved = active
        ? await client.updateWorkflow(active.id, toWorkflowInput(form))
        : await client.createWorkflow(toWorkflowInput(form));
      const savedNodes = await client.saveWorkflowNodes(
        saved.id,
        nodes.map((node, index) => toNodeInput(node, index)),
      );
      if (editorGeneration !== editorGenerationRef.current) return;
      const complete = { ...saved, nodes: savedNodes, nodeCount: savedNodes.length };
      replaceWorkflow(complete);
      setNodes(savedNodes.map(toDraftNode));
      onMutated?.();
      toast.success(active ? dictionary.workflows.saved : dictionary.workflows.created);
    } catch (error) {
      if (editorGeneration === editorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === editorGenerationRef.current) setBusy(null);
    }
  };

  const runStatusAction = async (action: "activate" | "pause") => {
    if (!active) return;
    const editorGeneration = editorGenerationRef.current;
    setBusy(action);
    try {
      const updated = action === "activate"
        ? await client.activateWorkflow(active.id)
        : await client.pauseWorkflow(active.id);
      if (editorGeneration !== editorGenerationRef.current) return;
      replaceWorkflow({ ...updated, nodes: updated.nodes.length ? updated.nodes : active.nodes });
      onMutated?.();
      toast.success(
        action === "activate" ? dictionary.workflows.activated : dictionary.workflows.paused,
      );
    } catch (error) {
      if (editorGeneration === editorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === editorGenerationRef.current) setBusy(null);
    }
  };

  const removeWorkflow = async () => {
    if (!active) return;
    if (active.status !== "draft") return;
    if (!window.confirm(`Eliminar definitivamente o fluxo “${active.name}”?`)) return;
    const editorGeneration = editorGenerationRef.current;
    setBusy("delete");
    try {
      await client.deleteWorkflow(active.id);
      if (editorGeneration !== editorGenerationRef.current) return;
      setWorkflows((current) => current.filter((item) => item.id !== active.id));
      setOpen(false);
      onMutated?.();
      toast.success(dictionary.workflows.deleted);
    } catch (error) {
      if (editorGeneration === editorGenerationRef.current) toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      if (editorGeneration === editorGenerationRef.current) setBusy(null);
    }
  };

  return (
    <>
      <section className="space-y-6" aria-labelledby="marketing-workflows-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="marketing-kicker">{dictionary.workflows.eyebrow}</p>
            <h2 id="marketing-workflows-title" className="text-heading-3 font-semibold">
              {dictionary.workflows.title}
            </h2>
            <p className="mt-1 text-body text-muted-foreground">{dictionary.workflows.subtitle}</p>
          </div>
          <Button type="button" onClick={beginCreate}>
            <Plus className="size-4" />
            {dictionary.workflows.newWorkflow}
          </Button>
        </div>

        {workflows.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Workflow className="size-5" />
              </div>
              <div>
                <h3 className="text-title">{dictionary.workflows.emptyTitle}</h3>
                <p className="mt-1 max-w-[28rem] text-body text-muted-foreground">
                  {dictionary.workflows.emptyDescription}
                </p>
              </div>
              <Button type="button" onClick={beginCreate}>
                <Plus className="size-4" />
                {dictionary.workflows.newWorkflow}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {workflows.map((workflow) => (
              <button
                type="button"
                key={workflow.id}
                onClick={() => void openWorkflow(workflow)}
                className="rounded-xl border bg-card p-5 text-left text-card-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-title">{workflow.name}</h3>
                    <p className="mt-1 truncate text-body text-muted-foreground">
                      {dictionary.workflows.triggers[workflow.triggerType]}
                    </p>
                  </div>
                  <Badge variant="outline" className={workflowStatusTone[workflow.status]}>
                    {dictionary.workflows.statuses[workflow.status]}
                  </Badge>
                </div>
                <div className="text-data mt-5 flex gap-4 text-meta text-muted-foreground">
                  <span>{workflow.countsKnown === false ? "—" : dictionary.workflows.nodeCount(workflow.nodeCount)}</span>
                  <span>{workflow.countsKnown === false ? "—" : dictionary.workflows.runCount(workflow.runCount)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[56rem]">
          <SheetHeader>
            <SheetDescription>
              {active ? dictionary.workflows.editorEdit : dictionary.workflows.editorCreate}
            </SheetDescription>
            <SheetTitle>{form.name || dictionary.workflows.newWorkflow}</SheetTitle>
          </SheetHeader>

          <div className="space-y-8 px-4 pb-8">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="workflow-name">{dictionary.workflows.fields.name}</Label>
                <Input
                  id="workflow-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={dictionary.workflows.placeholders.name}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="workflow-description">{dictionary.workflows.fields.description}</Label>
                <textarea
                  id="workflow-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder={dictionary.workflows.placeholders.description}
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workflow-trigger">{dictionary.workflows.fields.triggerType}</Label>
                <select
                  id="workflow-trigger"
                  value={form.triggerType}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    triggerType: event.target.value as MarketingWorkflowTriggerType,
                    triggerValue: "",
                  }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(Object.keys(dictionary.workflows.triggers) as MarketingWorkflowTriggerType[]).map((type) => (
                    <option value={type} key={type}>{dictionary.workflows.triggers[type]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="workflow-trigger-value">{triggerLabel.label}</Label>
                <Input
                  id="workflow-trigger-value"
                  value={form.triggerValue}
                  onChange={(event) => setForm((current) => ({ ...current, triggerValue: event.target.value }))}
                  placeholder={triggerLabel.placeholder}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-heading-4">{dictionary.workflows.steps.title}</h3>
                  <p className="text-body text-muted-foreground">{dictionary.workflows.steps.subtitle}</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={addType}
                    onChange={(event) => setAddType(event.target.value as MarketingWorkflowNodeType)}
                    aria-label={dictionary.workflows.steps.add}
                    className="h-9 rounded-md border border-input bg-background px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {(Object.keys(dictionary.workflows.steps.types) as MarketingWorkflowNodeType[]).map((type) => (
                      <option value={type} key={type}>{dictionary.workflows.steps.types[type]}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNodes((current) => [...current, createDraftNode(addType, current.length)])}
                  >
                    <Plus className="size-4" />
                    {dictionary.workflows.steps.add}
                  </Button>
                </div>
              </div>

              {nodes.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-body text-muted-foreground">
                  {dictionary.workflows.steps.empty}
                </div>
              ) : (
                <div className="space-y-3">
                  {nodes.map((node, index) => (
                    <Card key={node.key}>
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                            {node.type === "send_email"
                              ? <Mail className="size-4" />
                              : node.type === "wait"
                                ? <Clock3 className="size-4" />
                                : <Tag className="size-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-label font-semibold text-muted-foreground">
                              {dictionary.workflows.steps.step(index + 1)}
                            </p>
                            <p className="text-title">{dictionary.workflows.steps.types[node.type]}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            onClick={() => moveNode(index, -1)}
                            aria-label={dictionary.workflows.steps.moveUp}
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === nodes.length - 1}
                            onClick={() => moveNode(index, 1)}
                            aria-label={dictionary.workflows.steps.moveDown}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (node.id && !window.confirm("Remover este passo guardado do fluxo?")) return;
                              setNodes((current) => current.filter((item) => item.key !== node.key));
                            }}
                            aria-label={dictionary.workflows.steps.remove}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {node.type === "send_email" ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`workflow-subject-${node.key}`}>
                                {dictionary.workflows.steps.subject}
                              </Label>
                              <Input
                                id={`workflow-subject-${node.key}`}
                                value={node.subject}
                                onChange={(event) => updateNode(node.key, { subject: event.target.value })}
                                placeholder={dictionary.workflows.steps.placeholders.subject}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`workflow-topic-${node.key}`}>
                                {dictionary.workflows.steps.topic}
                              </Label>
                              <Input
                                id={`workflow-topic-${node.key}`}
                                value={node.topic}
                                onChange={(event) => updateNode(node.key, { topic: event.target.value })}
                                placeholder={dictionary.workflows.steps.placeholders.topic}
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor={`workflow-body-${node.key}`}>
                                {dictionary.workflows.steps.body}
                              </Label>
                              <textarea
                                id={`workflow-body-${node.key}`}
                                value={node.body}
                                onChange={(event) => updateNode(node.key, { body: event.target.value })}
                                placeholder={dictionary.workflows.steps.placeholders.body}
                                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          </div>
                        ) : node.type === "wait" ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`workflow-duration-${node.key}`}>
                                {dictionary.workflows.steps.duration}
                              </Label>
                              <Input
                                id={`workflow-duration-${node.key}`}
                                type="number"
                                min="1"
                                value={node.duration}
                                onChange={(event) => updateNode(node.key, { duration: event.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`workflow-unit-${node.key}`}>
                                {dictionary.workflows.steps.unit}
                              </Label>
                              <select
                                id={`workflow-unit-${node.key}`}
                                value={node.durationUnit}
                                onChange={(event) => updateNode(node.key, {
                                  durationUnit: event.target.value as DraftNode["durationUnit"],
                                })}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="minutes">{dictionary.workflows.steps.units.minutes}</option>
                                <option value="hours">{dictionary.workflows.steps.units.hours}</option>
                                <option value="days">{dictionary.workflows.steps.units.days}</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor={`workflow-tag-${node.key}`}>
                              {dictionary.workflows.steps.tag}
                            </Label>
                            <Input
                              id={`workflow-tag-${node.key}`}
                              value={node.tag}
                              onChange={(event) => updateNode(node.key, { tag: event.target.value })}
                              placeholder={dictionary.workflows.steps.placeholders.tag}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {active ? (
              <>
                <Separator />
                <section className="space-y-4">
                  <div>
                    <h3 className="text-heading-4">{dictionary.workflows.runs.title}</h3>
                    <p className="text-body text-muted-foreground">{dictionary.workflows.runs.subtitle}</p>
                  </div>
                  {runsLoadState === "pending" ? (
                    <div className="space-y-2" aria-busy="true" aria-label={dictionary.workflows.runs.title}>
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : runsLoadState === "rejected" ? (
                    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-body text-destructive">
                      {dictionary.feedback.genericError}
                    </div>
                  ) : runs.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-body text-muted-foreground">
                      {dictionary.workflows.runs.empty}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-left text-body">
                        <thead className="border-b bg-muted/40 text-meta text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.contact}</th>
                            <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.status}</th>
                            <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.currentStep}</th>
                            <th className="px-4 py-3 font-semibold">{dictionary.workflows.runs.nextRun}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {runs.map((run) => (
                            <tr key={run.id}>
                              <td className="px-4 py-3">
                                <p className="text-body font-semibold">{run.contactName || run.contactEmail || "—"}</p>
                                {run.contactName && run.contactEmail ? (
                                  <p className="text-meta text-muted-foreground">{run.contactEmail}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={runStatusTone[run.status]}>
                                  {dictionary.workflows.runs.statuses[run.status]}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-data">
                                {run.currentStep === null ? "—" : run.currentStep + 1}
                              </td>
                              <td className="px-4 py-3 text-data">{formatDateTime(run.nextRunAt, dictionary.locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            ) : null}

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {active ? (
                  <>
                    {active.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void runStatusAction("pause")}
                      >
                        <Pause className="size-4" />
                        {dictionary.workflows.pause}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void runStatusAction("activate")}
                      >
                        <Play className="size-4" />
                        {dictionary.workflows.activate}
                      </Button>
                    )}
                    {active.status === "draft" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => void removeWorkflow()}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        {dictionary.workflows.delete}
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Button type="button" disabled={busy !== null} onClick={() => void save()}>
                {busy === "save" ? dictionary.workflows.saving : dictionary.workflows.save}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
