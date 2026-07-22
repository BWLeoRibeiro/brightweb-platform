import { SkeletonCard } from "@brightweblabs/ui";

export default function ProjectDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-6 pb-6 pt-0 md:pb-8">
      {/* hero */}
      <SkeletonCard className="h-56" lines={4} />
      <section className="grid items-start gap-6 xl:grid-cols-3">
        <SkeletonCard className="h-72 xl:col-span-3" lines={5} />
      </section>
      <section className="grid items-start gap-6 xl:grid-cols-3">
        <SkeletonCard className="h-64" lines={4} />
        <SkeletonCard className="h-64" lines={4} />
        <SkeletonCard className="h-64" lines={4} />
      </section>
      <SkeletonCard className="h-20" lines={1} meta={false} />
    </div>
  );
}
