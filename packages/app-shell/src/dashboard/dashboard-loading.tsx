import { Skeleton, SkeletonCard, SkeletonLine } from "@brightweblabs/ui";

export function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1480px] pb-6 pt-0 md:pb-8">
      <div className="mb-6 flex flex-col gap-3">
        <SkeletonLine w="16rem" />
        <SkeletonLine w="20rem" className="h-[1.1rem]" />
        <SkeletonLine w="14rem" />
      </div>
      <Skeleton rounded="var(--radius-card)" className="mb-6 h-10 w-full" />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SkeletonCard className="h-52" lines={3} />
        <SkeletonCard className="h-52" lines={3} />
      </section>
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SkeletonCard className="h-80" lines={5} />
        <SkeletonCard className="h-80" lines={4} />
      </section>
    </div>
  );
}

export default DashboardLoading;
