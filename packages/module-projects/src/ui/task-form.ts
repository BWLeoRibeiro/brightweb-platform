export type TaskDraft = {
  projectId: string;
  title: string;
  status: string;
  blockedReason: string;
  startDate: string;
  dueDate: string;
};

export function validateTaskDraft(draft: TaskDraft) {
  const title = draft.title.trim();
  const blockedReason = draft.status === "blocked" ? draft.blockedReason.trim() : "";
  const error = !draft.projectId.trim() || !title ? "missing-title-or-project"
    : draft.startDate && draft.dueDate && draft.dueDate < draft.startDate ? "invalid-date-range"
      : draft.status === "blocked" && !blockedReason ? "missing-blocked-reason" : null;
  return {
    valid: error === null,
    error,
    input: { title, blockedReason: blockedReason || undefined, startDate: draft.startDate || undefined, dueDate: draft.dueDate || undefined },
  };
}
