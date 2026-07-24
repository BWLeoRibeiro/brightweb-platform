import { Skeleton, SkeletonLine } from "@brightweblabs/ui";

const SURFACE =
  "rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_1px_2px_var(--project-ui-color-67)]";

/**
 * Loading ghost for {@link ProjectSummaryCard}. Mirrors that card's real
 * frame and slots (org · title · status+risk · owner+progress · footer) so the
 * skeleton previews the layout instead of being a solid slab. Keep the two in
 * sync when the card changes.
 */
export function ProjectSummaryCardSkeleton() {
  return (
    <article className={`${SURFACE} flex flex-col px-[17px] pb-4 pt-[14px]`}>
      {/* org */}
      <SkeletonLine w="42%" className="h-[0.5rem]" />
      {/* title — two lines, fixed height like the real line-clamp-2 */}
      <div className="mt-2 flex min-h-[2.6em] flex-col gap-1.5">
        <SkeletonLine w="92%" />
        <SkeletonLine w="64%" />
      </div>
      {/* status + risk */}
      <div className="mt-3 flex min-h-[24px] items-center gap-x-2">
        <SkeletonLine w="4.5rem" />
        <Skeleton rounded="999px" className="h-[1.25rem] w-14" />
      </div>
      {/* owner + progress */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Skeleton rounded="50%" className="h-5 w-5" />
            <SkeletonLine w="5.5rem" />
          </span>
          <SkeletonLine w="2.25rem" />
        </div>
        <Skeleton rounded="999px" className="mt-[7px] h-1.5 w-full" />
      </div>
      {/* footer */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
        <SkeletonLine w="3.5rem" className="h-[0.5rem]" />
        <SkeletonLine w="2.5rem" className="h-[0.5rem]" />
        <SkeletonLine w="3rem" className="h-[0.5rem]" />
      </div>
    </article>
  );
}
