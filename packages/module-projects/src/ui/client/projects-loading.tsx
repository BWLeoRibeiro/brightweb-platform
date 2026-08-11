import { SkeletonCard, SkeletonLine } from "@brightweblabs/ui";

export function ClientProjectsListLoading() {
  return (
    <div className="space-y-7" aria-hidden>
      <div className="flex flex-wrap gap-2">
        <SkeletonLine w="7rem" className="h-9 rounded-full" />
        <SkeletonLine w="7rem" className="h-9 rounded-full" />
        <SkeletonLine w="5rem" className="h-9 rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard className="h-64" lines={3} />
        <SkeletonCard className="h-64" lines={3} />
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
      <SkeletonCard className="h-64 rounded-2xl border border-border/60 shadow-none" lines={4} />
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
