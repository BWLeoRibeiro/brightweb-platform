import { SkeletonCard, SkeletonLine } from "@brightweblabs/ui";

export function ClientProjectsListLoading() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-hidden>
      <SkeletonCard className="h-72 shadow-none" lines={4} />
      <SkeletonCard className="h-72 shadow-none" lines={4} />
    </div>
  );
}

export function ClientPortalHomeLoading() {
  return (
    <div className="space-y-10" aria-hidden>
      <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-4">
          <SkeletonLine w="18rem" className="h-12" />
          <SkeletonLine w="31rem" />
        </div>
        <div className="space-y-2 lg:w-80">
          <SkeletonLine w="7rem" className="lg:ml-auto" />
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border/60 bg-[color:var(--project-surface-secondary)] p-4">
            <SkeletonLine w="2.5rem" className="h-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <SkeletonLine w="12rem" className="h-6" />
              <SkeletonLine w="6rem" />
            </div>
          </div>
        </div>
      </header>
      <section className="space-y-5">
        <SkeletonLine w="12rem" className="h-8" />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard className="h-72 shadow-none" lines={4} />
          <SkeletonCard className="h-72 shadow-none" lines={4} />
        </div>
      </section>
    </div>
  );
}

export function ClientProjectDetailLoading() {
  return (
    <div className="space-y-8 sm:space-y-10" aria-hidden>
      <SkeletonLine w="6rem" className="h-6" />
      <div className="brand-panel space-y-4 rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] p-6 sm:p-8 lg:p-10">
        <SkeletonLine w="7rem" className="h-6 rounded-full bg-[color:var(--project-hero-surface-raised)]" />
        <SkeletonLine w="25rem" className="h-12 bg-[color:var(--project-hero-surface-raised)]" />
        <SkeletonLine w="14rem" className="bg-[color:var(--project-hero-surface-raised)]" />
        <div className="flex flex-wrap gap-x-12 gap-y-4 border-t border-[color:var(--project-hero-border)] pt-5">
          <SkeletonLine w="7rem" className="h-9 bg-[color:var(--project-hero-surface-raised)]" />
          <SkeletonLine w="7rem" className="h-9 bg-[color:var(--project-hero-surface-raised)]" />
          <SkeletonLine w="7rem" className="h-9 bg-[color:var(--project-hero-surface-raised)]" />
        </div>
      </div>
      <div className="max-w-[52rem] space-y-8 sm:space-y-10">
        <SkeletonCard className="h-36 shadow-none" lines={3} />
        <SkeletonCard className="h-72 shadow-none" lines={5} />
        <SkeletonCard className="h-40 shadow-none" lines={3} />
      </div>
    </div>
  );
}
