import { SkeletonCard, SkeletonLine } from "@brightweblabs/ui";

export function ClientProjectsListLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-hidden>
      <SkeletonCard className="h-72 shadow-none" lines={4} />
      <SkeletonCard className="h-72 shadow-none" lines={4} />
    </div>
  );
}

function ProjectOverviewSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-border/70 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]">
      <div className="flex min-h-80 flex-col p-6 sm:p-8">
        <SkeletonLine w="8rem" className="h-7" />
        <SkeletonLine w="18rem" className="mt-5 h-9" />
        <SkeletonLine w="8rem" className="mt-4" />
        <div className="mt-7 space-y-3">
          <SkeletonLine w="90%" />
          <SkeletonLine w="72%" />
        </div>
        <SkeletonLine w="10rem" className="mt-auto h-11 rounded-[var(--radius-control)]" />
      </div>
      <div className="border-t border-border/65 bg-muted/20 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <SkeletonLine w="7rem" />
        <SkeletonLine w="4rem" className="mt-2 h-8" />
        <SkeletonLine w="100%" className="mt-4 h-1.5" />
        <div className="mt-8 space-y-5 border-t border-border/60 pt-6">
          <SkeletonLine w="8rem" />
          <SkeletonLine w="80%" className="h-7" />
          <SkeletonLine w="70%" className="h-7" />
        </div>
      </div>
    </div>
  );
}

export function ClientPortalHomeLoading() {
  return (
    <div className="space-y-10" aria-hidden>
      <header className="space-y-4">
        <SkeletonLine w="18rem" className="h-10" />
        <SkeletonLine w="31rem" />
        <div className="flex items-center gap-3 pt-2">
          <SkeletonLine w="2.25rem" className="h-9 rounded-lg" />
          <SkeletonLine w="12rem" />
        </div>
      </header>
      <ProjectOverviewSkeleton />
    </div>
  );
}

export function ClientProjectDetailLoading() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-4">
        <SkeletonLine w="9rem" />
        <SkeletonLine w="7rem" className="h-6 rounded-full" />
        <SkeletonLine w="25rem" className="h-10" />
        <SkeletonLine w="14rem" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-5">
          <SkeletonCard className="h-44" lines={4} />
          <SkeletonCard className="h-72" lines={5} />
          <SkeletonCard className="h-44" lines={3} />
        </div>
        <div className="space-y-4">
          <SkeletonCard className="h-44" lines={3} />
          <SkeletonCard className="h-36" lines={3} />
          <SkeletonCard className="h-32" lines={2} />
        </div>
      </div>
    </div>
  );
}
