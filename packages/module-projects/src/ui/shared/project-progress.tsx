import { cn } from "../utils";

export function getCompletionPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

type ProjectProgressBarProps = {
  completed: number;
  total: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
};

export function ProjectProgressBar({
  completed,
  total,
  className,
  trackClassName,
  fillClassName,
}: ProjectProgressBarProps) {
  const percent = getCompletionPercent(completed, total);

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full", className, trackClassName)}>
      <div className={cn("h-full rounded-full transition-all duration-500", fillClassName)} style={{ width: `${percent}%` }} />
    </div>
  );
}
