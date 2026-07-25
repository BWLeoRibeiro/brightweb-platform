import { SkeletonCard, SkeletonLine } from "@brightweblabs/ui";

export function ClientProjectsListLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <SkeletonLine w="18rem" className="h-[1.2rem]" />
        <SkeletonLine w="24rem" />
      </div>
      <div className="grid gap-4">
        <SkeletonCard className="h-32" lines={2} />
        <SkeletonCard className="h-32" lines={2} />
        <SkeletonCard className="h-32" lines={2} />
      </div>
    </div>
  );
}

export function ClientProjectDetailLoading() {
  return (
    <div className="space-y-5">
      <SkeletonCard className="h-48" lines={3} />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard className="h-52" lines={4} />
        <SkeletonCard className="h-52" lines={4} />
      </div>
      <SkeletonCard className="h-32" lines={2} />
    </div>
  );
}
