import { Skeleton, SkeletonLine } from "@brightweblabs/ui";

const columns = [
  {
    key: "todo",
    surfaceClassName: "border-[color:var(--border)] bg-[color:var(--project-board-todo-surface)]",
    dotClassName: "bg-foreground/30",
  },
  {
    key: "in_progress",
    surfaceClassName: "border-[color:var(--project-board-progress-border)] bg-[color:var(--project-board-progress-surface)]",
    dotClassName: "bg-[color:var(--semantic-info)]",
  },
  {
    key: "blocked",
    surfaceClassName: "border-[color:var(--project-board-blocked-border)] bg-[color:var(--project-board-blocked-surface)]",
    dotClassName: "bg-[color:var(--project-risk-overdue)]",
  },
  {
    key: "done",
    surfaceClassName: "border-[color:var(--project-board-done-border)] bg-[color:var(--project-board-done-surface)]",
    dotClassName: "bg-[color:var(--project-state-completed)]",
  },
] as const;

function BoardColumn({ surfaceClassName, dotClassName }: { surfaceClassName: string; dotClassName: string }) {
  return (
    <article className={`flex flex-col rounded-[var(--radius-panel)] border p-3 ${surfaceClassName}`}>
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${dotClassName} opacity-40`} />
          <SkeletonLine w="44%" />
        </div>
        <Skeleton rounded="999px" className="h-5 w-6" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            rounded="var(--radius-card)"
            className="h-20 w-full border border-[color:var(--border)] bg-[color:var(--card)]"
          />
        ))}
      </div>
    </article>
  );
}

export default function ProjectBoardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <BoardColumn key={column.key} surfaceClassName={column.surfaceClassName} dotClassName={column.dotClassName} />
        ))}
      </section>
    </div>
  );
}
