"use client";

import { TablePagination } from "@brightweblabs/ui";

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
  if (totalPages <= 1) return null;

  return (
    <TablePagination
      page={page}
      totalPages={totalPages}
      onPageChange={(nextPage) => onPageChange(nextPage)}
      className="mt-lg"
      previousLabel="Ir para a página anterior"
      nextLabel="Ir para a próxima página"
      pageLabel={(current, count) => `Página ${current} de ${count}`}
    />
  );
}
