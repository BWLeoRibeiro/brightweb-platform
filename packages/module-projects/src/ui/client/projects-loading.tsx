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
    <div className="space-y-10 sm:space-y-14" aria-hidden>
      <header className="brand-panel rounded-[var(--radius-panel)] p-6 md:p-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <SkeletonLine w="18rem" className="h-12 bg-[color:var(--project-hero-surface-raised)]" />
            <SkeletonLine w="31rem" className="bg-[color:var(--project-hero-surface-raised)]" />
          </div>
          <div className="space-y-2 lg:w-80">
            <SkeletonLine w="7rem" className="bg-[color:var(--project-hero-surface-raised)] lg:ml-auto" />
            <div className="flex h-20 items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] p-4">
              <SkeletonLine w="2.5rem" className="h-10 rounded-full bg-[color:var(--project-hero-muted)]" />
              <div className="flex-1 space-y-1.5">
                <SkeletonLine w="12rem" className="h-6 bg-[color:var(--project-hero-muted)]" />
                <SkeletonLine w="6rem" className="bg-[color:var(--project-hero-muted)]" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 border-t border-[color:var(--project-hero-border)] pt-5 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`space-y-2 ${item === 0 ? "col-span-2 border-b border-[color:var(--project-hero-border)] pb-4 sm:col-span-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5" : item === 1 ? "border-r border-[color:var(--project-hero-border)] pr-4 pt-4 sm:px-5 sm:pt-0" : "pl-4 pt-4 sm:pl-5 sm:pt-0"}`}>
              <SkeletonLine w="7rem" className="bg-[color:var(--project-hero-surface-raised)]" />
              <SkeletonLine w="11rem" className="h-6 bg-[color:var(--project-hero-surface-raised)]" />
              <SkeletonLine w="8rem" className="bg-[color:var(--project-hero-surface-raised)]" />
            </div>
          ))}
        </div>
      </header>
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <SkeletonLine w="12rem" className="h-8" />
          <SkeletonLine w="9rem" />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-border/55 bg-[color:var(--project-surface-secondary)] p-5 lg:col-start-2 lg:row-start-1">
            <SkeletonLine w="5rem" />
            <SkeletonLine w="7rem" className="h-7" />
            <SkeletonLine w="12rem" />
            <div className="portal-scroll -mx-1 flex min-w-0 gap-3 overflow-hidden px-1 pt-2 lg:mx-0 lg:block lg:space-y-4 lg:px-0">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="min-w-[13rem] space-y-2 rounded-xl border border-border/55 bg-background/65 p-3 lg:min-w-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
                  <SkeletonLine w="6rem" />
                  <SkeletonLine w="11rem" className="h-6" />
                  <SkeletonLine w="8rem" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:col-start-1 lg:row-start-1">
            <SkeletonCard className="h-72 shadow-none" lines={4} />
            <SkeletonCard className="h-72 shadow-none" lines={4} />
          </div>
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
