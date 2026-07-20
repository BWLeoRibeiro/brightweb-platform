import type { CSSProperties } from "react";

export function Skeleton({ className = "", rounded = "var(--radius)", style }: {
  className?: string;
  rounded?: string;
  style?: CSSProperties;
}) {
  return <span aria-hidden className={`skeleton-ghost block ${className}`} style={{ borderRadius: rounded, ...style }} />;
}

export function SkeletonLine({ w = "100%", className = "" }: { w?: string; className?: string }) {
  return <Skeleton rounded="999px" className={`h-[0.6rem] ${className}`} style={{ width: w }} />;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["100%", "92%", "84%", "96%", "70%"];
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine key={index} w={index === lines - 1 ? "55%" : widths[index % widths.length]} />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3, meta = true, className = "", bodyClassName = "" }: {
  lines?: number;
  meta?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-[0_1px_2px_var(--hairline)] ${className}`}>
      <div className="flex flex-col gap-2">
        <SkeletonLine w="45%" className="h-[0.7rem]" />
        {meta ? <SkeletonLine w="28%" /> : null}
      </div>
      <SkeletonText lines={lines} className={bodyClassName} />
    </div>
  );
}

export function SkeletonCircle({ size = "2.25rem", className = "" }: { size?: string; className?: string }) {
  return <Skeleton rounded="50%" className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}
