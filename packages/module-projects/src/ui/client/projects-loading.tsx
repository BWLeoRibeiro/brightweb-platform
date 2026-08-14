import { CoverHeader, SkeletonCard, SkeletonLine } from "@brightweblabs/ui";

export function ClientProjectsListLoading() {
  return (
    <div className="space-y-6 sm:space-y-8" aria-hidden>
      <CoverHeader>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div className="space-y-3">
            <SkeletonLine w="4rem" className="-mt-8 h-16 rounded-full" />
            <SkeletonLine w="7rem" />
            <SkeletonLine w="26rem" className="h-12" />
            <SkeletonLine w="34rem" />
          </div>
          <div className="space-y-2">
            <SkeletonLine w="8rem" className="lg:ml-auto" />
            <SkeletonLine w="20rem" className="h-20" />
            <SkeletonLine w="13rem" className="lg:ml-auto" />
          </div>
        </div>
      </CoverHeader>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-border/60 bg-background/70 p-3 shadow-[var(--dashboard-shadow-sm)] sm:p-4">
          <div className="flex items-center justify-between gap-4 px-1">
            <SkeletonLine w="7rem" />
            <SkeletonLine w="5rem" />
          </div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SkeletonLine w="18rem" className="h-12 rounded-full" />
            <SkeletonLine w="15rem" className="h-11" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard className="h-80 shadow-none" lines={4} />
          <SkeletonCard className="h-80 shadow-none" lines={4} />
        </div>
      </div>
    </div>
  );
}

export function ClientPortalHomeLoading() {
  return (
    <div className="space-y-5 sm:space-y-7" aria-hidden>
      <CoverHeader>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <SkeletonLine w="4rem" className="-mt-10 h-20 rounded-full" />
            <SkeletonLine w="18rem" className="h-12" />
            <SkeletonLine w="31rem" />
          </div>
          <div className="space-y-2 lg:w-80">
            <SkeletonLine w="7rem" className="lg:ml-auto" />
            <div className="flex h-20 items-center gap-3 rounded-[var(--radius-card)] border border-border/60 bg-background/75 p-4">
              <SkeletonLine w="2.5rem" className="h-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <SkeletonLine w="12rem" className="h-6" />
                <SkeletonLine w="6rem" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 border-t border-border/60 pt-5 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`space-y-2 ${item === 0 ? "col-span-2 border-b border-border/60 pb-4 sm:col-span-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5" : item === 1 ? "border-r border-border/60 pr-4 pt-4 sm:px-5 sm:pt-0" : "pl-4 pt-4 sm:pl-5 sm:pt-0"}`}>
              <SkeletonLine w="7rem" />
              <SkeletonLine w="11rem" className="h-6" />
              <SkeletonLine w="8rem" />
            </div>
          ))}
        </div>
      </CoverHeader>
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <SkeletonLine w="12rem" className="h-8" />
          <SkeletonLine w="9rem" />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-border/55 bg-[color:var(--project-surface-secondary)] p-5 lg:col-start-2 lg:row-start-1">
            <SkeletonLine w="5rem" />
            <SkeletonLine w="7rem" className="h-7" />
            <SkeletonLine w="10rem" />
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
      <CoverHeader>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div className="space-y-4">
            <SkeletonLine w="4rem" className="-mt-8 h-16 rounded-full" />
            <SkeletonLine w="7rem" className="h-6 rounded-full" />
            <SkeletonLine w="25rem" className="h-12" />
            <SkeletonLine w="14rem" />
            <div className="space-y-2 border-l-2 border-border/60 pl-5">
              <SkeletonLine w="7rem" />
              <SkeletonLine w="30rem" className="h-6" />
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-4 border-t border-border/60 pt-5">
              <SkeletonLine w="7rem" className="h-9" />
              <SkeletonLine w="7rem" className="h-9" />
              <SkeletonLine w="7rem" className="h-9" />
            </div>
          </div>
          <SkeletonCard className="brand-panel h-56 border-[color:var(--project-hero-border)] shadow-none" lines={4} />
        </div>
      </CoverHeader>
      <SkeletonCard className="h-40 shadow-none" lines={3} />
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border/55 bg-background/55 p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <SkeletonLine w="5rem" />
            <SkeletonLine w="14rem" className="mt-2 h-8" />
            <SkeletonLine w="26rem" className="mt-2" />
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <SkeletonLine w="5rem" />
            <SkeletonLine w="2.75rem" className="h-11 rounded-full" />
            <SkeletonLine w="2.75rem" className="h-11 rounded-full" />
          </div>
        </div>
        <div className="portal-scroll mt-8 grid grid-flow-col auto-cols-[15rem] overflow-hidden border-y border-border/65">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex min-h-56 flex-col border-r border-border/55 p-5 last:border-r-0">
              <div className="flex items-center justify-between gap-3">
                <SkeletonLine w="2rem" />
                <SkeletonLine w="6rem" />
              </div>
              <SkeletonLine w="11rem" className="mt-8 h-7" />
              <SkeletonLine w="9rem" className="mt-auto" />
            </div>
          ))}
        </div>
      </section>
      <SkeletonCard className="h-40 shadow-none" lines={3} />
    </div>
  );
}
