"use client";

import { StyledSelect } from "@brightweblabs/ui";

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
} from "@brightweblabs/ui";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createLatestRequestController, isAbortError } from "@brightweblabs/infra/request-observability";
import { toast } from "sonner";
import { useWorkflowCommand } from "./use-workflow-command";
import { WorkflowRunViewer } from "./workflow-run-viewer";
import { emptyForm, toForm, createDraftNode, toDraftNode, toWorkflowInput, toNodeInput, isNodeValid, type DraftNode, type WorkflowForm } from "./workflow-editor-model";
import { useMarketingUiClient } from "./context";
import type {
  MarketingUiDictionary,
  MarketingWorkflow,
  MarketingWorkflowNodeType,
  MarketingWorkflowRun,
  MarketingWorkflowTriggerType,
} from "./types";

const workflowStatusTone: Record<MarketingWorkflow["status"], string> = {
  draft: "border-border bg-muted text-muted-foreground",
  active: "border-success/25 bg-success/10 text-success",
  paused: "border-warning/25 bg-warning/10 text-warning",
};

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
  const [form, setFormState] = useState<WorkflowForm>(emptyForm);
  const [nodes, setNodesState] = useState<DraftNode[]>([]);
  const draftRevisionRef = useRef(0);
  const setForm: Dispatch<SetStateAction<WorkflowForm>> = (update) => {
    draftRevisionRef.current += 1;
    setFormState(update);
  };
  const setNodes: Dispatch<SetStateAction<DraftNode[]>> = (update) => {
    draftRevisionRef.current += 1;
    setNodesState(update);
  };
  const [runs, setRuns] = useState<MarketingWorkflowRun[]>([]);
  const [runsLoadState, setRunsLoadState] = useState<"pending" | "fulfilled" | "rejected">("fulfilled");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addType, setAddType] = useState<MarketingWorkflowNodeType>("send_email");
  const workflowLoadGeneration = useRef(0);
  const editorGenerationRef = useRef(0);
  const command = useWorkflowCommand(client, editorGenerationRef, dictionary.feedback.genericError);
  const busy = command.busy ?? (loading ? "load" : null);
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
    setLoading(false);
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
    const revision = draftRevisionRef.current;
    setRuns([]);
    setRunsLoadState("pending");
    setOpen(true);
    setLoading(true);
    try {
      const [detail, recentRuns] = await Promise.all([
        client.getWorkflow(workflow.id, { signal: latest.signal }),
        client.listWorkflowRuns(workflow.id, { signal: latest.signal }),
      ]);
      if (!latest.isCurrent() || generation !== workflowLoadGeneration.current) return;
      const complete = { ...detail, runCount: recentRuns.length, countsKnown: true };
      replaceWorkflow(complete);
      setActive(complete);
      if (revision === draftRevisionRef.current) {
        setForm(toForm(detail));
        setNodes(detail.nodes.map(toDraftNode));
      }
      setRuns(recentRuns);
      setRunsLoadState("fulfilled");
    } catch (error) {
      if (isAbortError(error) || !latest.isCurrent() || generation !== workflowLoadGeneration.current) return;
      setRunsLoadState("rejected");
      toast.error(error instanceof Error ? error.message : dictionary.feedback.genericError);
    } finally {
      const current = latest.isCurrent();
      latest.finish();
      if (current && generation === workflowLoadGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    setOpen(false);
    setActive(null);
    setFormState(emptyForm);
    setNodesState([]);
    setRuns([]);
    setRunsLoadState("fulfilled");
    setLoading(false);
    return () => {
      workflowRequestRef.current.abort();
      editorGenerationRef.current += 1;
    };
  }, [client]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      workflowRequestRef.current.abort();
      editorGenerationRef.current += 1;
      setLoading(false);
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
    if (loading) return;
    const revision = draftRevisionRef.current;
    if (!form.name.trim() || !form.triggerValue.trim() || nodes.some((node) => !isNodeValid(node))) {
      toast.error(dictionary.feedback.workflowRequired ?? dictionary.feedback.required);
      return;
    }
    await command.run("save", async (owner) => {
      const saved = active
        ? await client.updateWorkflow(active.id, toWorkflowInput(form))
        : await client.createWorkflow(toWorkflowInput(form));
      // Metadata has already persisted: retain a new workflow's identity even if nodes fail.
      if (owner.ownsCollection()) {
        replaceWorkflow(saved);
        onMutated?.();
      }
      if (owner.ownsEditor()) setActive(saved);
      const savedNodes = await client.saveWorkflowNodes(
        saved.id,
        nodes.map((node, index) => toNodeInput(node, index)),
      );
      const complete = { ...saved, nodes: savedNodes, nodeCount: savedNodes.length };
      if (owner.ownsCollection()) {
        replaceWorkflow(complete);
        onMutated?.();
      }
      if (!owner.ownsEditor()) return;
      setActive(complete);
      if (revision === draftRevisionRef.current) setNodes(savedNodes.map(toDraftNode));
      else {
        const savedIds = new Map(nodes.map((node, position) => [node.key, savedNodes.find((savedNode) => savedNode.position === position)?.id]));
        setNodes((current) => current.map((node) => {
          const id = savedIds.get(node.key);
          return id ? { ...node, id } : node;
        }));
      }
    }, active ? dictionary.workflows.saved : dictionary.workflows.created);
  };

  const runStatusAction = async (action: "activate" | "pause") => {
    if (loading || !active) return;
    await command.run(action, async (owner) => {
      const updated = action === "activate"
        ? await client.activateWorkflow(active.id)
        : await client.pauseWorkflow(active.id);
      const complete = { ...updated, nodes: updated.nodes.length ? updated.nodes : active.nodes };
      if (owner.ownsCollection()) {
        replaceWorkflow(complete);
        onMutated?.();
      }
      if (owner.ownsEditor()) setActive(complete);
    }, action === "activate" ? dictionary.workflows.activated : dictionary.workflows.paused);
  };

  const removeWorkflow = async () => {
    if (loading || command.busy || !active || active.status !== "draft") return;
    if (!window.confirm(`Eliminar definitivamente o fluxo “${active.name}”?`)) return;
    await command.run("delete", async (owner) => {
      await client.deleteWorkflow(active.id);
      if (owner.ownsCollection()) {
        setWorkflows((current) => current.filter((item) => item.id !== active.id));
        onMutated?.();
      }
      if (owner.ownsEditor()) setOpen(false);
    }, dictionary.workflows.deleted);
  };

  return (
    <>
      <section className="space-y-6" aria-labelledby="marketing-workflows-title">
        <div>
          <p className="marketing-kicker">{dictionary.workflows.eyebrow}</p>
          <h2 id="marketing-workflows-title" className="text-heading-3 font-semibold">
            {dictionary.workflows.title}
          </h2>
          <p className="mt-1 text-body text-muted-foreground">{dictionary.workflows.subtitle}</p>
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
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {workflows.map((workflow) => (
              <Card key={workflow.id} asChild variant="interactive" density="default">
                <button type="button" onClick={() => void openWorkflow(workflow)} className="p-5 text-left">
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
              </Card>
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
                <StyledSelect
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
                </StyledSelect>
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
                  <StyledSelect
                    value={addType}
                    onChange={(event) => setAddType(event.target.value as MarketingWorkflowNodeType)}
                    aria-label={dictionary.workflows.steps.add}
                    className="h-9 rounded-md border border-input bg-background px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {(Object.keys(dictionary.workflows.steps.types) as MarketingWorkflowNodeType[]).map((type) => (
                      <option value={type} key={type}>{dictionary.workflows.steps.types[type]}</option>
                    ))}
                  </StyledSelect>
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
                              <StyledSelect
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
                              </StyledSelect>
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
                <WorkflowRunViewer runs={runs} runsLoadState={runsLoadState} dictionary={dictionary} />
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
