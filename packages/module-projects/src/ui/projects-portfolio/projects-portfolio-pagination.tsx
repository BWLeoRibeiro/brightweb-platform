"use client";

import { TablePagination } from "@brightweblabs/ui";
import { useProjectsUiDictionary } from "../context";

type ProjectsPortfolioPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number | ((current: number) => number)) => void;
};

export function ProjectsPortfolioPagination({
  page,
  totalPages,
  onPageChange,
}: ProjectsPortfolioPaginationProps) {
  const dictionary = useProjectsUiDictionary();
  if (totalPages <= 1) return null;

  return (
    <TablePagination
      page={page}
      totalPages={totalPages}
      onPageChange={(nextPage) => onPageChange(nextPage)}
      className="mt-lg"
      previousLabel={dictionary.portfolio.previousPage}
      nextLabel={dictionary.portfolio.nextPage}
      pageLabel={dictionary.portfolio.page}
    />
  );
}
