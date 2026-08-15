import { Skeleton, SkeletonCard } from "@brightweblabs/ui";
import { CompactCollectionCardSkeleton } from "./shared/compact-collection-skeleton";

export function ProjectDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-6 pb-6 pt-0 md:pb-8">
      {/* hero */}
      <SkeletonCard className="h-56" lines={4} />
      <section className="flex items-center gap-3 border-b border-border-hairline-soft px-0.5 pb-4">
        <Skeleton className="size-8 shrink-0" rounded="8px" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-36" rounded="6px" />
          <Skeleton className="h-3 w-20" rounded="6px" />
        </div>
        <Skeleton className="ml-auto h-7 w-36" rounded="999px" />
      </section>
      <section className="grid items-start gap-6 xl:grid-cols-3">
        <SkeletonCard className="h-72 xl:col-span-3" lines={5} />
      </section>
      <section className="grid items-start gap-6 xl:grid-cols-2">
        <CompactCollectionCardSkeleton />
        <CompactCollectionCardSkeleton />
      </section>
      <SkeletonCard className="h-20" lines={1} meta={false} />
    </div>
  );
}

export default ProjectDetailLoading;
