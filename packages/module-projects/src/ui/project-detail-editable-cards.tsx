"use client";

import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, Flag, ListChecks, PencilLine, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "./constants";
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import {
  sheetAccentTextareaClassName,
  sheetEditControlClassName,
  sheetFieldLabelClassName,
} from "./shared/sheet-section";
import { cn } from "./utils";
import {
  deleteMilestone as deleteMilestoneAction,
  deleteTask as deleteTaskAction,
  updateMilestone,
  updateTask,
} from "./project-ui-actions";
import { useProjectDetailData } from "./project-detail-data-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@brightweblabs/ui";
import { Button } from "@brightweblabs/ui";
import { Calendar } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@brightweblabs/ui";
import { ProjectMilestonesAndTasksLists } from "./project-milestone-task-lists";
import { TaskPriorityTag, TaskStatusTag } from "./shared/task-tags";
import type { ProjectMilestone, ProjectTask } from "../types";
import { defaultProjectsUiDictionary } from "./dictionary";

type ProjectMilestonesAndTasksCardsProps = {
  projectId: string;
  canEditItems: boolean;
};
type SheetMode = "view" | "edit";

const sheetViewValueClassName = "mt-1.5 text-sm text-foreground";

const milestoneStatusLabels: Record<string, string> = {
  pending: defaultProjectsUiDictionary.status.pending,
  in_progress: defaultProjectsUiDictionary.status.in_progress,
  achieved: defaultProjectsUiDictionary.status.achieved,
  delayed: defaultProjectsUiDictionary.status.delayed,
};

type MilestoneFormState = {
  title: string;
  status: string;
  targetDate: string;
};

type TaskFormState = {
  title: string;
  description: string;
  status: string;
  priority: string;
  milestoneId: string;
  assigneeProfileId: string;
  dueDate: string;
  blockedReason: string;
};

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

function normalizeMilestoneForm(form: MilestoneFormState) {
  return {
    title: form.title.trim(),
    status: form.status,
    targetDate: form.targetDate,
  };
}

function normalizeTaskForm(form: TaskFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    milestoneId: form.milestoneId,
    assigneeProfileId: form.assigneeProfileId,
    dueDate: form.dueDate,
    blockedReason: form.blockedReason.trim(),
  };
}

export function ProjectMilestonesAndTasksCards({
  projectId,
  canEditItems,
}: ProjectMilestonesAndTasksCardsProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const router = useRouter();
  const { milestones, tasks, members } = useProjectDetailData();
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isDeletingMilestone, setIsDeletingMilestone] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isMilestoneDeleteDialogOpen, setMilestoneDeleteDialogOpen] = useState(false);
  const [isTaskDeleteDialogOpen, setTaskDeleteDialogOpen] = useState(false);
  const [milestoneMode, setMilestoneMode] = useState<SheetMode>("view");
  const [taskMode, setTaskMode] = useState<SheetMode>("view");
  const [milestoneEditBaseline, setMilestoneEditBaseline] = useState<MilestoneFormState | null>(null);
  const [taskEditBaseline, setTaskEditBaseline] = useState<TaskFormState | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneStatus, setMilestoneStatus] = useState("pending");
  const [milestoneTargetDate, setMilestoneTargetDate] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState("todo");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskMilestoneId, setTaskMilestoneId] = useState("");
  const [taskAssigneeProfileId, setTaskAssigneeProfileId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskBlockedReason, setTaskBlockedReason] = useState("");
  const milestoneTargetDateValue = useMemo(() => parseIsoDate(milestoneTargetDate), [milestoneTargetDate]);
  const taskDueDateValue = useMemo(() => parseIsoDate(taskDueDate), [taskDueDate]);
  const isTaskBlocked = taskStatus === "blocked";

  useEffect(() => {
    if (taskStatus !== "blocked") {
      setTaskBlockedReason("");
    }
  }, [taskStatus]);

  useEffect(() => {
    if (!editingMilestone) return;

    const refreshedMilestone = milestones.find((milestone) => milestone.id === editingMilestone.id);
    if (!refreshedMilestone) {
      setEditingMilestone(null);
      setMilestoneEditBaseline(null);
      setMilestoneMode("view");
      setMilestoneDeleteDialogOpen(false);
      return;
    }

    setEditingMilestone(refreshedMilestone);
    if (milestoneMode === "view") {
      setMilestoneTitle(refreshedMilestone.title);
      setMilestoneStatus(refreshedMilestone.status);
      setMilestoneTargetDate(refreshedMilestone.targetDate ?? "");
    }
  }, [editingMilestone, milestoneMode, milestones]);

  useEffect(() => {
    if (!editingTask) return;

    const refreshedTask = tasks.find((task) => task.id === editingTask.id);
    if (!refreshedTask) {
      setEditingTask(null);
      setTaskEditBaseline(null);
      setTaskMode("view");
      setTaskDeleteDialogOpen(false);
      return;
    }

    setEditingTask(refreshedTask);
    if (taskMode === "view") {
      setTaskTitle(refreshedTask.title);
      setTaskDescription(refreshedTask.description ?? "");
      setTaskStatus(refreshedTask.status);
      setTaskPriority(refreshedTask.priority);
      setTaskMilestoneId(refreshedTask.milestoneId ?? "");
      setTaskAssigneeProfileId(refreshedTask.assigneeProfileId ?? "");
      setTaskDueDate(refreshedTask.dueDate ?? "");
      setTaskBlockedReason(refreshedTask.blockedReason ?? "");
    }
  }, [editingTask, taskMode, tasks]);

  const isMilestoneEditDirty = useMemo(() => {
    if (milestoneMode !== "edit" || !milestoneEditBaseline) return false;
    return (
      JSON.stringify(
        normalizeMilestoneForm({
          title: milestoneTitle,
          status: milestoneStatus,
          targetDate: milestoneTargetDate,
        }),
      ) !== JSON.stringify(normalizeMilestoneForm(milestoneEditBaseline))
    );
  }, [milestoneEditBaseline, milestoneMode, milestoneStatus, milestoneTargetDate, milestoneTitle]);

  const isTaskEditDirty = useMemo(() => {
    if (taskMode !== "edit" || !taskEditBaseline) return false;
    return (
      JSON.stringify(
        normalizeTaskForm({
          title: taskTitle,
          description: taskDescription,
          status: taskStatus,
          priority: taskPriority,
          milestoneId: taskMilestoneId,
          assigneeProfileId: taskAssigneeProfileId,
          dueDate: taskDueDate,
          blockedReason: taskBlockedReason,
        }),
      ) !== JSON.stringify(normalizeTaskForm(taskEditBaseline))
    );
  }, [
    taskAssigneeProfileId,
    taskBlockedReason,
    taskDescription,
    taskDueDate,
    taskEditBaseline,
    taskMilestoneId,
    taskMode,
    taskPriority,
    taskStatus,
    taskTitle,
  ]);

  const memberOptions = useMemo(
    () =>
      members
        .map((member) => ({
          profileId: member.profileId,
          label: member.label.trim() || dictionary.people.noName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" })),
    [dictionary.people.noName, members],
  );

  const openEditMilestone = (milestone: ProjectMilestone) => {
    setMilestoneMode("view");
    setMilestoneEditBaseline(null);
    setEditingMilestone(milestone);
    setMilestoneTitle(milestone.title);
    setMilestoneStatus(milestone.status);
    setMilestoneTargetDate(milestone.targetDate ?? "");
  };

  const openEditTask = (task: ProjectTask) => {
    setTaskMode("view");
    setTaskEditBaseline(null);
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskMilestoneId(task.milestoneId ?? "");
    setTaskAssigneeProfileId(task.assigneeProfileId ?? "");
    setTaskDueDate(task.dueDate ?? "");
    setTaskBlockedReason(task.blockedReason ?? "");
  };

  const submitMilestone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMilestone || milestoneMode !== "edit" || isSavingMilestone || !milestoneTitle.trim() || !isMilestoneEditDirty) return;
    setIsSavingMilestone(true);

    try {
      await updateMilestone(client, projectId, editingMilestone.id, {
        title: milestoneTitle,
        status: milestoneStatus,
        targetDate: milestoneTargetDate,
      });
      toast.success(dictionary.editItems.milestoneUpdated);
      setEditingMilestone(null);
      setMilestoneEditBaseline(null);
      setMilestoneMode("view");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.editItems.milestoneUpdateFallbackError);
    } finally {
      setIsSavingMilestone(false);
    }
  };

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask || taskMode !== "edit" || isSavingTask || !taskTitle.trim() || !isTaskEditDirty) return;
    setIsSavingTask(true);

    try {
      await updateTask(client, projectId, editingTask.id, {
        title: taskTitle,
        description: taskDescription,
        status: taskStatus,
        priority: taskPriority,
        milestoneId: taskMilestoneId,
        assigneeProfileId: taskAssigneeProfileId,
        dueDate: taskDueDate,
        blockedReason: isTaskBlocked ? taskBlockedReason : "",
      });
      toast.success(dictionary.board.updated);
      setEditingTask(null);
      setTaskEditBaseline(null);
      setTaskMode("view");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.editItems.taskUpdateFallbackError);
    } finally {
      setIsSavingTask(false);
    }
  };

  const deleteMilestone = async () => {
    if (!editingMilestone || isDeletingMilestone) return;
    setIsDeletingMilestone(true);
    try {
      await deleteMilestoneAction(client, projectId, editingMilestone.id);
      toast.success(dictionary.editItems.milestoneDeleted);
      setMilestoneDeleteDialogOpen(false);
      setEditingMilestone(null);
      setMilestoneEditBaseline(null);
      setMilestoneMode("view");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.editItems.milestoneDeleteFallbackError);
    } finally {
      setIsDeletingMilestone(false);
    }
  };

  const deleteTask = async () => {
    if (!editingTask || isDeletingTask) return;
    setIsDeletingTask(true);
    try {
      await deleteTaskAction(client, projectId, editingTask.id);
      toast.success(dictionary.board.deleted);
      setTaskDeleteDialogOpen(false);
      setEditingTask(null);
      setTaskEditBaseline(null);
      setTaskMode("view");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.editItems.taskDeleteFallbackError);
    } finally {
      setIsDeletingTask(false);
    }
  };

  return (
    <>
      <ProjectMilestonesAndTasksLists
        projectId={projectId}
        canEditItems={canEditItems}
        milestones={milestones}
        tasks={tasks}
        onEditMilestone={openEditMilestone}
        onEditTask={openEditTask}
      />

      <Sheet
        open={Boolean(editingMilestone)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingMilestone(null);
            setMilestoneEditBaseline(null);
            setMilestoneMode("view");
            setMilestoneDeleteDialogOpen(false);
          }
        }}
      >
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={Flag}
            editing={milestoneMode !== "view"}
            eyebrow={milestoneMode === "view" ? dictionary.board.viewEyebrow : dictionary.board.editEyebrow}
            title={<>{milestoneMode === "view" ? (milestoneTitle.trim() || dictionary.detail.milestones.slice(0, -1)) : dictionary.forms.editMilestone}</>}
            description={
              <>
                {milestoneMode === "view"
                  ? [
                      milestoneStatusLabels[milestoneStatus] ?? null,
                      milestoneTargetDateValue ? `Data-alvo ${format(milestoneTargetDateValue, "dd/MM/yyyy")}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : dictionary.editItems.milestoneDescription}
              </>
            }
          />
          <form onSubmit={submitMilestone} className="flex min-h-0 flex-1 flex-col">
            <div className={`${sheetBodyClassName} space-y-4`}>
              <SheetSection title={dictionary.detail.milestones.slice(0, -1)} editing={milestoneMode !== "view"} bodyClassName="space-y-3 px-4 py-3">
                {milestoneMode === "edit" ? (
                  <div>
                    <label className={sheetFieldLabelClassName} htmlFor="milestone-edit-title">{dictionary.forms.title}</label>
                    <Input
                      id="milestone-edit-title"
                      value={milestoneTitle}
                      onChange={(event) => setMilestoneTitle(event.target.value)}
                      required
                      className={cn(sheetEditControlClassName, "mt-1.5")}
                    />
                  </div>
                ) : null}
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="milestone-edit-status">{dictionary.forms.status}</label>
                  {milestoneMode === "view" ? (
                    <p className={sheetViewValueClassName}>{milestoneStatusLabels[milestoneStatus] ?? "—"}</p>
                  ) : (
                  <select
                    id="milestone-edit-status"
                    value={milestoneStatus}
                    onChange={(event) => setMilestoneStatus(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}
                  >
                    <option value="pending">{dictionary.status.pending}</option>
                    <option value="in_progress">{dictionary.status.in_progress}</option>
                    <option value="achieved">{dictionary.status.achieved}</option>
                    <option value="delayed">{dictionary.status.delayed}</option>
                  </select>
                  )}
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="milestone-edit-date">{dictionary.create.targetDateOptional}</label>
                  {milestoneMode === "view" ? (
                    <p className={sheetViewValueClassName}>
                      {milestoneTargetDateValue ? format(milestoneTargetDateValue, "dd/MM/yyyy") : dictionary.detail.noDate}
                    </p>
                  ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="milestone-edit-date"
                        type="button"
                        variant="ghost"
                        className={cn(
                          "mt-1.5 h-9 w-full justify-start px-2.5 text-sm",
                          "rounded-lg border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] hover:bg-[color:var(--card)]",
                          milestoneTargetDateValue ? "text-foreground" : "text-foreground/45",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                      {milestoneTargetDateValue ? format(milestoneTargetDateValue, "dd/MM/yyyy") : dictionary.create.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        className="rounded-lg border"
                        selected={milestoneTargetDateValue}
                        onSelect={(date) => setMilestoneTargetDate(toIsoDate(date))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  )}
                </div>
              </SheetSection>
              {milestoneMode === "edit" ? (
                <Button
                  type="button"
                  variant="link"
                  size="link"
                  className="w-fit p-0 text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                  onClick={() => setMilestoneDeleteDialogOpen(true)}
                  disabled={isDeletingMilestone || isSavingMilestone}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {dictionary.editItems.deleteMilestone}
                </Button>
              ) : null}
            </div>
            <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
              {milestoneMode === "view" ? (
                canEditItems ? (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setMilestoneEditBaseline({
                        title: milestoneTitle,
                        status: milestoneStatus,
                        targetDate: milestoneTargetDate,
                      });
                      setMilestoneMode("edit");
                    }}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    {dictionary.forms.editMilestone}
                  </Button>
                ) : null
              ) : (
                <>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSavingMilestone || !milestoneTitle.trim() || !isMilestoneEditDirty}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingMilestone ? dictionary.actions.saving : dictionary.actions.save}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isSavingMilestone}
                    onClick={() => {
                      if (milestoneEditBaseline) {
                        setMilestoneTitle(milestoneEditBaseline.title);
                        setMilestoneStatus(milestoneEditBaseline.status);
                        setMilestoneTargetDate(milestoneEditBaseline.targetDate);
                      }
                      setMilestoneMode("view");
                    }}
                  >
                    {dictionary.actions.cancel}
                  </Button>
                </>
              )}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(editingTask)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingTask(null);
            setTaskEditBaseline(null);
            setTaskMode("view");
            setTaskDeleteDialogOpen(false);
          }
        }}
      >
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={ListChecks}
            editing={taskMode !== "view"}
            eyebrow={taskMode === "view" ? dictionary.board.viewEyebrow : dictionary.board.editEyebrow}
            title={<>{taskMode === "view" ? (taskTitle.trim() || dictionary.board.task) : dictionary.forms.editTask}</>}
            description={
              <>
                {taskMode === "view"
                  ? editingTask?.createdAt
                    ? dictionary.board.createdAt(format(new Date(editingTask.createdAt), "dd/MM/yyyy"))
                    : dictionary.board.task
                  : dictionary.board.editDescription}
              </>
            }
          />
          <form onSubmit={submitTask} className="flex min-h-0 flex-1 flex-col">
            <div className={`${sheetBodyClassName} space-y-4`}>
              <SheetSection title={dictionary.board.task} editing={taskMode !== "view"} bodyClassName="space-y-3 px-4 py-3">
              {taskMode === "edit" ? (
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-edit-title">{dictionary.forms.title}</label>
                  <Input
                    id="task-edit-title"
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    required
                    className={cn(sheetEditControlClassName, "mt-1.5")}
                  />
                </div>
              ) : null}
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-edit-description">{dictionary.create.optionalDescription}</label>
                {taskMode === "view" ? (
                  <p className={cn(sheetViewValueClassName, "whitespace-pre-wrap")}>
                    {taskDescription.trim() || dictionary.board.noDescription}
                  </p>
                ) : (
                  <textarea
                    id="task-edit-description"
                    value={taskDescription}
                    onChange={(event) => setTaskDescription(event.target.value)}
                    rows={3}
                    className={cn(sheetAccentTextareaClassName, "mt-1.5 min-h-[72px]")}
                  />
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-edit-status">{dictionary.forms.status}</label>
                  {taskMode === "view" ? (
                    <div className="mt-1.5">
                      <TaskStatusTag task={{ status: taskStatus as ProjectTask["status"], blockedReason: taskBlockedReason }} />
                    </div>
                  ) : (
                    <select
                      id="task-edit-status"
                      value={taskStatus}
                      onChange={(event) => setTaskStatus(event.target.value)}
                      className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}
                    >
                      <option value="todo">{dictionary.board.columns.todo}</option>
                      <option value="in_progress">{dictionary.board.columns.in_progress}</option>
                      <option value="blocked">{dictionary.board.columns.blocked}</option>
                      <option value="done">{dictionary.board.columns.done}</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-edit-priority">{dictionary.forms.priority}</label>
                  {taskMode === "view" ? (
                    <div className="mt-1.5">
                      <TaskPriorityTag task={{ priority: taskPriority as ProjectTask["priority"], status: taskStatus as ProjectTask["status"] }} />
                    </div>
                  ) : (
                    <select
                      id="task-edit-priority"
                      value={taskPriority}
                      onChange={(event) => setTaskPriority(event.target.value)}
                      className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}
                    >
                      <option value="low">{dictionary.board.priority.low}</option>
                      <option value="medium">{dictionary.board.priority.medium}</option>
                      <option value="high">{dictionary.board.priority.high}</option>
                      <option value="urgent">{dictionary.board.priority.urgent}</option>
                    </select>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-edit-milestone">{dictionary.create.milestoneOptional}</label>
                  {taskMode === "view" ? (
                    <p className={sheetViewValueClassName}>
                      {milestones.find((milestone) => milestone.id === taskMilestoneId)?.title ?? dictionary.board.noMilestone}
                    </p>
                  ) : (
                    <select
                      id="task-edit-milestone"
                      value={taskMilestoneId}
                      onChange={(event) => setTaskMilestoneId(event.target.value)}
                      className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}
                    >
                      <option value="">{dictionary.board.noMilestone}</option>
                      {milestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.id}>
                          {milestone.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-edit-assignee">{dictionary.create.assigneeOptional}</label>
                  {taskMode === "view" ? (
                    <p className={sheetViewValueClassName}>
                      {memberOptions.find((member) => member.profileId === taskAssigneeProfileId)?.label ?? dictionary.board.noAssignee}
                    </p>
                  ) : (
                    <select
                      id="task-edit-assignee"
                      value={taskAssigneeProfileId}
                      onChange={(event) => setTaskAssigneeProfileId(event.target.value)}
                      className={cn(sheetEditControlClassName, "mt-1.5 block w-full text-foreground outline-none")}
                    >
                      <option value="">{dictionary.board.noAssignee}</option>
                      {memberOptions.map((member) => (
                        <option key={member.profileId} value={member.profileId}>
                          {member.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-edit-due">{dictionary.create.dueDateOptional}</label>
                {taskMode === "view" ? (
                  <p className={sheetViewValueClassName}>
                    {taskDueDateValue ? format(taskDueDateValue, "dd/MM/yyyy") : dictionary.board.noDate}
                  </p>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="task-edit-due"
                        type="button"
                        variant="ghost"
                        className={cn(
                          "mt-1.5 h-9 w-full justify-start px-2.5 text-sm",
                          "rounded-lg border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] hover:bg-[color:var(--card)]",
                          taskDueDateValue ? "text-foreground" : "text-foreground/45",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskDueDateValue ? format(taskDueDateValue, "dd/MM/yyyy") : dictionary.create.selectDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        className="rounded-lg border"
                        selected={taskDueDateValue}
                        onSelect={(date) => setTaskDueDate(toIsoDate(date))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {isTaskBlocked ? (
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-edit-blocked">{dictionary.forms.blockedReason}</label>
                  {taskMode === "view" ? (
                    <p className="mt-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                      {taskBlockedReason.trim() || dictionary.board.noBlockedReason}
                    </p>
                  ) : (
                    <Input
                      id="task-edit-blocked"
                      value={taskBlockedReason}
                      onChange={(event) => setTaskBlockedReason(event.target.value)}
                      required
                      className={cn(sheetEditControlClassName, "mt-1.5")}
                    />
                  )}
                </div>
              ) : null}
              </SheetSection>
              {taskMode === "edit" ? (
                <Button
                  type="button"
                  variant="link"
                  size="link"
                  className="w-fit p-0 text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                  onClick={() => setTaskDeleteDialogOpen(true)}
                  disabled={isDeletingTask || isSavingTask}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {dictionary.board.deleteTask}
                </Button>
              ) : null}
            </div>
            <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
              {taskMode === "view" ? (
                canEditItems ? (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setTaskEditBaseline({
                        title: taskTitle,
                        description: taskDescription,
                        status: taskStatus,
                        priority: taskPriority,
                        milestoneId: taskMilestoneId,
                        assigneeProfileId: taskAssigneeProfileId,
                        dueDate: taskDueDate,
                        blockedReason: taskBlockedReason,
                      });
                      setTaskMode("edit");
                    }}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    {dictionary.forms.editTask}
                  </Button>
                ) : null
              ) : (
                <>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSavingTask || !taskTitle.trim() || !isTaskEditDirty || (isTaskBlocked && !taskBlockedReason.trim())}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingTask ? dictionary.actions.saving : dictionary.actions.save}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isSavingTask}
                    onClick={() => {
                      if (taskEditBaseline) {
                        setTaskTitle(taskEditBaseline.title);
                        setTaskDescription(taskEditBaseline.description);
                        setTaskStatus(taskEditBaseline.status);
                        setTaskPriority(taskEditBaseline.priority);
                        setTaskMilestoneId(taskEditBaseline.milestoneId);
                        setTaskAssigneeProfileId(taskEditBaseline.assigneeProfileId);
                        setTaskDueDate(taskEditBaseline.dueDate);
                        setTaskBlockedReason(taskEditBaseline.blockedReason);
                      }
                      setTaskMode("view");
                    }}
                  >
                    {dictionary.actions.cancel}
                  </Button>
                </>
              )}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isMilestoneDeleteDialogOpen} onOpenChange={setMilestoneDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.editItems.deleteMilestoneTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {dictionary.editItems.deleteMilestoneDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMilestone}>{dictionary.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteMilestone}
              disabled={isDeletingMilestone}
              className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/60"
            >
              {isDeletingMilestone ? dictionary.editItems.deleting : dictionary.editItems.deleteMilestone}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isTaskDeleteDialogOpen} onOpenChange={setTaskDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.board.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {dictionary.editItems.deleteTaskDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTask}>{dictionary.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTask}
              disabled={isDeletingTask}
              className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/60"
            >
              {isDeletingTask ? dictionary.editItems.deleting : dictionary.board.deleteTask}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
