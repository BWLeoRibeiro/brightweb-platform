import { Skeleton, SkeletonCircle, SkeletonLine } from "@brightweblabs/ui";

function UserRow() {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5">
      <SkeletonCircle size="2.25rem" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <SkeletonLine w="32%" />
        <SkeletonLine w="48%" className="h-[0.5rem]" />
      </div>
      <Skeleton rounded="999px" className="hidden h-6 w-20 md:block" />
      <Skeleton rounded="999px" className="hidden h-6 w-16 sm:block" />
    </div>
  );
}

export function AdminUsersLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 pb-6 pt-0 md:pb-8">
      <section className="admin-dashboard-reveal">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3">
            <SkeletonLine w="12rem" />
            <SkeletonLine w="16rem" className="h-[1.1rem]" />
            <SkeletonLine w="14rem" />
          </div>
          <Skeleton rounded="var(--radius)" className="h-9 w-32" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Skeleton rounded="999px" className="h-9 w-40" />
          <Skeleton rounded="999px" className="h-9 w-28" />
        </div>
      </section>
      <section className="admin-dashboard-reveal admin-table-surface overflow-hidden">
        <div className="space-y-1 px-2 py-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <SkeletonLine w="22%" />
          </div>
          {Array.from({ length: 8 }, (_, index) => <UserRow key={index} />)}
        </div>
      </section>
    </div>
  );
}
