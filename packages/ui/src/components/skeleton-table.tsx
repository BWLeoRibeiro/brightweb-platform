import { Skeleton } from "./skeleton";
import { TableCell, TableRow } from "./table";

export function TableRowsSkeleton({ rows = 6, columns }: {
  rows?: number;
  columns: ("text" | "chip" | "action")[];
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {columns.map((kind, columnIndex) => (
            <TableCell key={columnIndex}>
              {kind === "chip" ? (
                <Skeleton rounded="var(--radius-pill)" className="h-5 w-14" />
              ) : kind === "action" ? (
                <Skeleton rounded="var(--radius)" className="ml-auto size-7" />
              ) : (
                <Skeleton rounded="var(--radius-pill)" className="h-[var(--skeleton-line-height)] w-[72%]" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
