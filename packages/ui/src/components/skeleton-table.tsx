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
                <Skeleton rounded="999px" className="h-5 w-14" />
              ) : kind === "action" ? (
                <Skeleton rounded="var(--radius)" className="ml-auto size-7" />
              ) : (
                <Skeleton rounded="999px" className="h-[0.6rem] w-[72%]" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
