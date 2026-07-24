"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, ListChecks, PencilLine, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetFooter,
  TooltipProvider,
} from "@brightweblabs/ui";
import type { TaskStatus } from "../contracts";
import type { ProjectTask } from "../types";
import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { sheetBodyClassName, sheetFooterClassName, sheetShellClassName } from "./constants";
import { AppSheetHeader } from "./shared/app-sheet";
import { SheetSection } from "./shared/app-sheet";
import { sheetAccentTextareaClassName, sheetEditControlClassName, sheetFieldLabelClassName } from "./shared/sheet-section";
import { TaskAssigneeMeta, TaskDueMeta, TaskMilestoneMeta, TaskPriorityTag, TaskStatusTag } from "./shared/task-tags";
import { useProjectDetailActions, useProjectDetailData } from "./project-detail-data-provider";
import { useProjectBoardMilestoneEvents } from "./hooks/use-project-board-milestone-events";
import { cn } from "./utils";

type ProjectBoardKanbanProps = { canEditItems: boolean };
type SheetMode = "view" | "edit";
type TaskFormState = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: ProjectTask["priority"];
  milestoneId: string;
  assigneeProfileId: string;
  dueDate: string;
  blockedReason: string;
};
type MilestoneFilterValue = "all" | "__none__" | string;
type PendingBlockedMove = { taskId: string; nextStatus: TaskStatus };

const sheetViewValueClassName = "mt-1.5 text-sm text-foreground";

const columnStyles: Record<TaskStatus, { surfaceClassName: string; headingClassName: string; dotClassName: string }> = {
  todo: {
    surfaceClassName: "border-[color:var(--border)] bg-[color:var(--project-board-todo-surface)]",
    headingClassName: "text-[color:var(--muted-foreground)]",
    dotClassName: "bg-foreground/30",
  },
  in_progress: {
    surfaceClassName: "border-[color:var(--project-board-progress-border)] bg-[color:var(--project-board-progress-surface)]",
    headingClassName: "text-[color:var(--semantic-info-strong)]",
    dotClassName: "bg-[color:var(--semantic-info)]",
  },
  blocked: {
    surfaceClassName: "border-[color:var(--project-board-blocked-border)] bg-[color:var(--project-board-blocked-surface)]",
    headingClassName: "text-[color:var(--project-risk-overdue-strong)]",
    dotClassName: "bg-[color:var(--project-risk-overdue)]",
  },
  done: {
    surfaceClassName: "border-[color:var(--project-board-done-border)] bg-[color:var(--project-board-done-surface)]",
    headingClassName: "text-[color:var(--project-state-completed-strong)]",
    dotClassName: "bg-[color:var(--project-state-completed)]",
  },
};

function isTaskOverdue(task: ProjectTask) {
  if (!task.dueDate || task.status === "done") return false;
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function toIsoDate(value?: Date): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeTaskForm(form: TaskFormState) {
  return { ...form, title: form.title.trim(), description: form.description.trim(), blockedReason: form.blockedReason.trim() };
}

export function ProjectBoardKanban({ canEditItems }: ProjectBoardKanbanProps) {
  const dictionary = useProjectsUiDictionary();
  const client = useProjectsUiClient();
  const data = useProjectDetailData();
  const { replaceDashboard } = useProjectDetailActions();
  const { project, tasks, milestones, members } = data;
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilterValue>("all");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskMode, setTaskMode] = useState<SheetMode>("view");
  const [taskEditBaseline, setTaskEditBaseline] = useState<TaskFormState | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isTaskDeleteDialogOpen, setTaskDeleteDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("todo");
  const [taskPriority, setTaskPriority] = useState<ProjectTask["priority"]>("medium");
  const [taskMilestoneId, setTaskMilestoneId] = useState("");
  const [taskAssigneeProfileId, setTaskAssigneeProfileId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskBlockedReason, setTaskBlockedReason] = useState("");
  const [isBlockReasonDialogOpen, setBlockReasonDialogOpen] = useState(false);
  const [pendingBlockedMove, setPendingBlockedMove] = useState<PendingBlockedMove | null>(null);
  const [blockedMoveReason, setBlockedMoveReason] = useState("");

  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [selectedTaskId, tasks]);
  const taskDueDateValue = useMemo(() => parseIsoDate(taskDueDate), [taskDueDate]);
  const milestoneById = useMemo(() => new Map(milestones.map((milestone) => [milestone.id, milestone])), [milestones]);
  const filteredTasks = useMemo(() => tasks.filter((task) => milestoneFilter === "all" ? true : milestoneFilter === "__none__" ? !task.milestoneId : task.milestoneId === milestoneFilter), [milestoneFilter, tasks]);
  const columns = (["todo", "in_progress", "blocked", "done"] as const).map((key) => ({ key, label: dictionary.board.columns[key], ...columnStyles[key] }));

  useProjectBoardMilestoneEvents({ milestones, milestoneFilter, onSetMilestoneFilter: setMilestoneFilter });

  useEffect(() => {
    if (!selectedTaskId) return;
    if (!selectedTask) {
      setSelectedTaskId(null);
      setTaskMode("view");
      setTaskEditBaseline(null);
      setTaskDeleteDialogOpen(false);
      return;
    }
    if (taskMode === "view") {
      setTaskTitle(selectedTask.title);
      setTaskDescription(selectedTask.description ?? "");
      setTaskStatus(selectedTask.status);
      setTaskPriority(selectedTask.priority);
      setTaskMilestoneId(selectedTask.milestoneId ?? "");
      setTaskAssigneeProfileId(selectedTask.assigneeProfileId ?? "");
      setTaskDueDate(selectedTask.dueDate ?? "");
      setTaskBlockedReason(selectedTask.blockedReason ?? "");
    }
  }, [selectedTask, selectedTaskId, taskMode]);

  useEffect(() => {
    if (taskStatus !== "blocked") setTaskBlockedReason("");
  }, [taskStatus]);

  const isTaskEditDirty = useMemo(() => {
    if (taskMode !== "edit" || !taskEditBaseline) return false;
    return JSON.stringify(normalizeTaskForm({ title: taskTitle, description: taskDescription, status: taskStatus, priority: taskPriority, milestoneId: taskMilestoneId, assigneeProfileId: taskAssigneeProfileId, dueDate: taskDueDate, blockedReason: taskBlockedReason })) !== JSON.stringify(normalizeTaskForm(taskEditBaseline));
  }, [taskAssigneeProfileId, taskBlockedReason, taskDescription, taskDueDate, taskEditBaseline, taskMilestoneId, taskMode, taskPriority, taskStatus, taskTitle]);

  function openTaskSheet(task: ProjectTask) {
    setSelectedTaskId(task.id);
    setTaskMode("view");
    setTaskEditBaseline(null);
    setTaskDeleteDialogOpen(false);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskMilestoneId(task.milestoneId ?? "");
    setTaskAssigneeProfileId(task.assigneeProfileId ?? "");
    setTaskDueDate(task.dueDate ?? "");
    setTaskBlockedReason(task.blockedReason ?? "");
  }

  function closeTaskSheet() {
    setSelectedTaskId(null);
    setTaskMode("view");
    setTaskEditBaseline(null);
    setTaskDeleteDialogOpen(false);
  }

  async function performMoveTask(taskId: string, nextStatus: TaskStatus, blockedReason?: string) {
    const originalTask = tasks.find((task) => task.id === taskId);
    if (!originalTask || originalTask.status === nextStatus || movingTaskId || !canEditItems) return;
    const nextPosition = tasks.reduce((highest, task) => task.id === taskId || task.status !== nextStatus ? highest : Math.max(highest, task.position), 0) + 1;
    const previousDashboard = data;
    replaceDashboard({ ...data, tasks: tasks.map((task) => task.id === taskId ? { ...task, status: nextStatus, position: nextPosition, blockedReason: nextStatus === "blocked" ? blockedReason ?? task.blockedReason : task.blockedReason } : task) });
    setMovingTaskId(taskId);
    try {
      replaceDashboard(await client.updateTask(project.id, taskId, { status: nextStatus, position: nextPosition, blockedReason: blockedReason ?? null }));
    } catch (error) {
      replaceDashboard(previousDashboard);
      toast.error(error instanceof Error ? error.message : dictionary.board.moveFallbackError);
    } finally {
      setMovingTaskId(null);
      setDragTaskId(null);
    }
  }

  async function moveTaskToStatus(nextStatus: TaskStatus) {
    if (!dragTaskId) return;
    const task = tasks.find((item) => item.id === dragTaskId);
    if (!task || task.status === nextStatus) return;
    if (nextStatus === "blocked") {
      setPendingBlockedMove({ taskId: task.id, nextStatus });
      setBlockedMoveReason(task.blockedReason ?? "");
      setBlockReasonDialogOpen(true);
      setDropTarget(null);
      setDragTaskId(null);
      return;
    }
    await performMoveTask(task.id, nextStatus);
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || taskMode !== "edit" || !canEditItems || isSavingTask || !taskTitle.trim() || !isTaskEditDirty) return;
    if (taskStatus === "blocked" && !taskBlockedReason.trim()) {
      toast.error(dictionary.board.blockedReasonRequired);
      return;
    }
    setIsSavingTask(true);
    try {
      replaceDashboard(await client.updateTask(project.id, selectedTask.id, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        status: taskStatus,
        priority: taskPriority,
        milestoneId: taskMilestoneId || null,
        assigneeProfileId: taskAssigneeProfileId || null,
        dueDate: taskDueDate || null,
        blockedReason: taskStatus === "blocked" ? taskBlockedReason.trim() : null,
      }));
      setTaskMode("view");
      setTaskEditBaseline(null);
      toast.success(dictionary.board.updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.board.updateFallbackError);
    } finally {
      setIsSavingTask(false);
    }
  }

  async function deleteTask() {
    if (!selectedTask || !canEditItems || isDeletingTask) return;
    setIsDeletingTask(true);
    try {
      replaceDashboard(await client.deleteTask(project.id, selectedTask.id));
      toast.success(dictionary.board.deleted);
      closeTaskSheet();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.board.deleteFallbackError);
    } finally {
      setIsDeletingTask(false);
    }
  }

  return (
    <TooltipProvider>
      <>
        <section className="dashboard-reveal grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = filteredTasks.filter((task) => task.status === column.key).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
            return (
              <article
                key={column.key}
                className={cn("flex flex-col rounded-[var(--radius-panel)] border p-3 transition", column.surfaceClassName, dropTarget === column.key && "ring-2 ring-[color:var(--project-board-drop-ring)] ring-offset-2 ring-offset-transparent")}
                onDragOver={(event) => { if (canEditItems) { event.preventDefault(); if (dragTaskId) event.dataTransfer.dropEffect = "move"; } }}
                onDragEnter={() => { if (canEditItems) setDropTarget(column.key); }}
                onDragLeave={(event) => { const nextTarget = event.relatedTarget; if (!(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))) setDropTarget((current) => current === column.key ? null : current); }}
                onDrop={(event) => { event.preventDefault(); setDropTarget(null); void moveTaskToStatus(column.key); }}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2"><span className={cn("size-2 shrink-0 rounded-full", column.dotClassName)} /><h2 className={cn("text-[length:var(--text-ui-label)] font-semibold uppercase tracking-[var(--type-tracking-080)]", column.headingClassName)}>{column.label}</h2></div>
                  <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-1.5 text-[length:var(--text-ui-label)] font-semibold tabular-nums text-[color:var(--muted-foreground)]">{columnTasks.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {columnTasks.length === 0 ? <p className="portal-micro px-1 py-6 text-center text-foreground/35">{dictionary.board.noTasks}</p> : null}
                  {columnTasks.map((task) => {
                    const milestone = task.milestoneId ? milestoneById.get(task.milestoneId) : null;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        draggable={canEditItems && movingTaskId !== task.id}
                        title={canEditItems ? dictionary.board.openAndDragHint : task.title}
                        onDragStart={(event) => { setDragTaskId(task.id); event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDropTarget(null); setDragTaskId(null); }}
                        onClick={() => { if (!dragTaskId) openTaskSheet(task); }}
                        className={cn("w-full rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--card)] p-2.5 text-left shadow-[var(--project-board-card-shadow)] transition hover:border-[color:var(--project-board-card-hover-border)] hover:shadow-[var(--project-board-card-hover-shadow)]", movingTaskId === task.id ? "cursor-wait opacity-70" : canEditItems ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}
                        data-status={column.key}
                      >
                        <div className="flex items-start justify-between gap-2"><p className="portal-body min-w-0 flex-1 font-semibold leading-snug line-clamp-2" title={task.title}>{task.title}</p><TaskPriorityTag task={task} /></div>
                        {task.description?.trim() ? <p className="portal-meta mt-1 line-clamp-2 text-[color:var(--muted-foreground)]" title={task.description}>{task.description}</p> : null}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"><TaskDueMeta dueDate={task.dueDate} isOverdue={isTaskOverdue(task)} /><TaskMilestoneMeta title={milestone?.title ?? null} /></div>
                        <div className="mt-1.5"><TaskAssigneeMeta label={task.assigneeLabel} /></div>
                        {task.status === "blocked" && task.blockedReason ? <p className="portal-micro mt-2 line-clamp-2 rounded-md border border-[color:var(--project-board-reason-border)] bg-[color:var(--project-board-reason-surface)] px-1.5 py-1 text-[color:var(--project-risk-overdue-strong)]" title={task.blockedReason}>{task.blockedReason}</p> : null}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        <Sheet open={Boolean(selectedTask)} onOpenChange={(next) => { if (!next) closeTaskSheet(); }}>
          <SheetContent className={sheetShellClassName}>
            <AppSheetHeader icon={ListChecks} editing={taskMode === "edit"} eyebrow={taskMode === "view" ? dictionary.board.viewEyebrow : dictionary.board.editEyebrow} title={<>{taskMode === "view" ? taskTitle.trim() || dictionary.board.task : dictionary.forms.editTask}</>} description={<>{taskMode === "view" ? selectedTask?.createdAt ? dictionary.board.createdAt(format(new Date(selectedTask.createdAt), "dd/MM/yyyy")) : dictionary.board.task : dictionary.board.editDescription}</>} />
            <form onSubmit={submitTask} className="flex min-h-0 flex-1 flex-col">
              <div className={`${sheetBodyClassName} space-y-4`}>
                <SheetSection title={dictionary.board.task} editing={taskMode === "edit"} bodyClassName="space-y-3 px-4 py-3">
                  {taskMode === "edit" ? <div><label className={sheetFieldLabelClassName} htmlFor="board-task-title">{dictionary.forms.title}</label><Input id="board-task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required className={cn(sheetEditControlClassName, "mt-1.5")} /></div> : null}
                  <div><label className={sheetFieldLabelClassName} htmlFor="board-task-description">{dictionary.board.optionalDescription}</label>{taskMode === "view" ? <p className={cn(sheetViewValueClassName, "whitespace-pre-wrap")}>{taskDescription.trim() || dictionary.board.noDescription}</p> : <textarea id="board-task-description" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={3} className={cn(sheetAccentTextareaClassName, "mt-1.5 min-h-[72px]")} />}</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className={sheetFieldLabelClassName} htmlFor="board-task-status">{dictionary.forms.status}</label>{taskMode === "view" ? <div className="mt-1.5"><TaskStatusTag task={{ status: taskStatus, blockedReason: taskBlockedReason }} /></div> : <select id="board-task-status" value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as TaskStatus)} className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}>{columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select>}</div>
                    <div><label className={sheetFieldLabelClassName} htmlFor="board-task-priority">{dictionary.forms.priority}</label>{taskMode === "view" ? <div className="mt-1.5"><TaskPriorityTag task={{ priority: taskPriority, status: taskStatus }} /></div> : <select id="board-task-priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as ProjectTask["priority"])} className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}>{Object.entries(dictionary.board.priority).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className={sheetFieldLabelClassName} htmlFor="board-task-milestone">{dictionary.board.optionalMilestone}</label>{taskMode === "view" ? <p className={sheetViewValueClassName}>{milestones.find((item) => item.id === taskMilestoneId)?.title ?? dictionary.board.noMilestone}</p> : <select id="board-task-milestone" value={taskMilestoneId} onChange={(event) => setTaskMilestoneId(event.target.value)} className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}><option value="">{dictionary.board.noMilestone}</option>{milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}</div>
                    <div><label className={sheetFieldLabelClassName} htmlFor="board-task-assignee">{dictionary.board.optionalAssignee}</label>{taskMode === "view" ? <p className={sheetViewValueClassName}>{members.find((item) => item.profileId === taskAssigneeProfileId)?.label ?? dictionary.board.noAssignee}</p> : <select id="board-task-assignee" value={taskAssigneeProfileId} onChange={(event) => setTaskAssigneeProfileId(event.target.value)} className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}><option value="">{dictionary.board.noAssignee}</option>{members.map((item) => <option key={item.profileId} value={item.profileId}>{item.label}</option>)}</select>}</div>
                  </div>
                  <div>
                    <label className={sheetFieldLabelClassName} htmlFor="board-task-due">{dictionary.board.optionalDueDate}</label>
                    {taskMode === "view" ? (
                      <p className={sheetViewValueClassName}>{taskDueDateValue ? format(taskDueDateValue, "dd/MM/yyyy") : dictionary.board.noDate}</p>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button id="board-task-due" type="button" variant="ghost" className={cn(sheetEditControlClassName, "mt-1.5 h-9 w-full justify-start px-2.5 text-sm", taskDueDateValue ? "text-foreground" : "text-foreground/45")}>
                            <CalendarIcon className="mr-2 size-4" />
                            {taskDueDateValue ? format(taskDueDateValue, "dd/MM/yyyy") : dictionary.board.selectDate}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" captionLayout="dropdown" className="rounded-lg border" selected={taskDueDateValue} onSelect={(date) => setTaskDueDate(toIsoDate(date))} initialFocus />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {taskStatus === "blocked" ? <div><label className={sheetFieldLabelClassName} htmlFor="board-task-blocked">{dictionary.forms.blockedReason}</label>{taskMode === "view" ? <p className="mt-1.5 rounded-md border border-[color:var(--project-board-blocked-reason-border)] bg-[color:var(--project-board-blocked-reason-surface)] px-3 py-2 text-sm text-[color:var(--project-risk-at-risk-strong)]">{taskBlockedReason.trim() || dictionary.board.noBlockedReason}</p> : <Input id="board-task-blocked" value={taskBlockedReason} onChange={(event) => setTaskBlockedReason(event.target.value)} required className={cn(sheetEditControlClassName, "mt-1.5")} />}</div> : null}
                </SheetSection>
                {taskMode === "edit" && canEditItems ? <Button type="button" variant="link" size="link" className="w-fit p-0 text-sm text-[color:var(--destructive)]" onClick={() => setTaskDeleteDialogOpen(true)} disabled={isDeletingTask || isSavingTask}><Trash2 className="mr-1.5 size-3.5" />{dictionary.board.deleteTask}</Button> : null}
              </div>
              <SheetFooter className={`${sheetFooterClassName} gap-2`}>
                {taskMode === "view" ? canEditItems ? (
                  <Button type="button" className="w-full" onClick={() => {
                    setTaskEditBaseline({ title: taskTitle, description: taskDescription, status: taskStatus, priority: taskPriority, milestoneId: taskMilestoneId, assigneeProfileId: taskAssigneeProfileId, dueDate: taskDueDate, blockedReason: taskBlockedReason });
                    setTaskMode("edit");
                  }}><PencilLine className="mr-2 size-4" />{dictionary.board.editTask}</Button>
                ) : null : (
                  <Button type="submit" className="w-full" disabled={isSavingTask || !taskTitle.trim() || !isTaskEditDirty || (taskStatus === "blocked" && !taskBlockedReason.trim())}><Save className="mr-2 size-4" />{isSavingTask ? dictionary.board.saving : dictionary.board.saveTask}</Button>
                )}
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

        <AlertDialog open={isTaskDeleteDialogOpen} onOpenChange={setTaskDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{dictionary.board.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{dictionary.board.deleteDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{dictionary.actions.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void deleteTask()} disabled={isDeletingTask}>{isDeletingTask ? dictionary.board.deleting : dictionary.board.confirmDelete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <AlertDialog open={isBlockReasonDialogOpen} onOpenChange={(next) => { setBlockReasonDialogOpen(next); if (!next) setPendingBlockedMove(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{dictionary.board.blockedDialogTitle}</AlertDialogTitle><AlertDialogDescription>{dictionary.board.blockedDialogDescription}</AlertDialogDescription></AlertDialogHeader><Input value={blockedMoveReason} onChange={(event) => setBlockedMoveReason(event.target.value)} placeholder={dictionary.board.blockedPlaceholder} /><AlertDialogFooter><AlertDialogCancel>{dictionary.board.closeBlockedDialog}</AlertDialogCancel><AlertDialogAction onClick={() => { const pending = pendingBlockedMove; if (!pending || !blockedMoveReason.trim()) { toast.error(dictionary.board.blockedReasonRequired); return; } setBlockReasonDialogOpen(false); setPendingBlockedMove(null); void performMoveTask(pending.taskId, pending.nextStatus, blockedMoveReason.trim()); }}>{dictionary.board.confirmBlock}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </>
    </TooltipProvider>
  );
}
