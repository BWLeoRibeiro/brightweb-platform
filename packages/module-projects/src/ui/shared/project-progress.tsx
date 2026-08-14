import { cn } from "../utils";

export function getCompletionPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

type ProjectProgressBarStyleProps = {
  ariaLabel?: string;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
};

type ProjectProgressBarProps = ProjectProgressBarStyleProps & (
  | { percent: number | null; completed?: never; total?: never }
  | { percent?: never; completed: number; total: number }
);

export function ProjectProgressBar({
  completed,
  total,
  percent: percentOverride,
  ariaLabel,
  className,
  trackClassName,
  fillClassName,
}: ProjectProgressBarProps) {
  const percent = percentOverride ?? getCompletionPercent(completed ?? 0, total ?? 0);

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      aria-label={ariaLabel}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", className, trackClassName)}
      role="progressbar"
    >
      <div className={cn("h-full rounded-full transition-all duration-500", fillClassName)} style={{ width: `${percent}%` }} />
    </div>
  );
}
