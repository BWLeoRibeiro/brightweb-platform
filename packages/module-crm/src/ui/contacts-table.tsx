"use client";

import { ArrowDown, Building2, Users } from "lucide-react";
import type { ReactNode } from "react";
import {
  Button,
  EmptyState,
  SearchField,
  StatusPill,
  SurfaceCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableRowsSkeleton,
} from "@brightweblabs/ui";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmOwnerOption, CrmContactSort } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmStageConfig, CrmTableColumnConfig, CrmTableColumnKey, CrmUiDictionary } from "./types";

const defaultColumns: CrmTableColumnConfig[] = [
  { key: "name" },
  { key: "email" },
  { key: "organization" },
  { key: "owner" },
  { key: "status" },
  { key: "updated" },
];

const columnSort: Partial<Record<CrmTableColumnKey, CrmContactSort>> = {
  name: "name",
  organization: "company",
  updated: "date_desc",
};

function contactName(contact: CrmContact, fallback: string) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || fallback;
}

export type CrmContactsTableProps = {
  data: CrmContactsListResult;
  params?: CrmContactsListParams;
  owners?: CrmOwnerOption[];
  loading?: boolean;
  dictionary?: CrmUiDictionary;
  stages?: CrmStageConfig[];
  columns?: CrmTableColumnConfig[];
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onParamsChange?: (params: CrmContactsListParams) => void;
  onRowClick?: (contact: CrmContact) => void;
  onBulkStatus?: (contactIds: string[]) => void;
  renderRowActions?: (contact: CrmContact) => ReactNode;
};

export function CrmContactsTable({
  data,
  params = {},
  owners = [],
  loading = false,
  dictionary = defaultCrmUiDictionary,
  stages,
  columns = defaultColumns,
  selectedIds = [],
  onSelectedIdsChange,
  onParamsChange,
  onRowClick,
  onBulkStatus,
  renderRowActions,
}: CrmContactsTableProps) {
  const visibleColumns = columns.filter((column) => !column.hidden);
  const resolvedStages = resolveCrmStages(dictionary, stages);
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));
  const stageMap = new Map(resolvedStages.map((stage) => [stage.value, stage]));
  const visibleIds = data.items.map((contact) => contact.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const updateParams = (patch: Partial<CrmContactsListParams>) => onParamsChange?.({ ...params, ...patch });

  const renderCell = (column: CrmTableColumnConfig, contact: CrmContact) => {
    const owner = contact.owner_id ? ownerMap.get(contact.owner_id) : undefined;
    const stage = stageMap.get(contact.status as CrmStageConfig["value"]);
    if (column.render) return column.render(contact, { owner, stage, dictionary });
    switch (column.key) {
      case "name": return <span className="font-semibold text-foreground">{contactName(contact, dictionary.table.noContact)}</span>;
      case "email": return contact.email ?? dictionary.table.noContact;
      case "organization": return contact.organizations?.name ?? dictionary.table.unavailable;
      case "owner": return owner?.label ?? dictionary.table.unavailable;
      case "status": return stage ? <StatusPill token={stage.token}>{stage.label}</StatusPill> : contact.status;
      case "updated": return new Intl.DateTimeFormat(dictionary.locale, { dateStyle: "medium" }).format(new Date(contact.updated_at));
    }
  };

  return (
    <SurfaceCard className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
        <SearchField
          value={params.search ?? ""}
          onChange={(search) => updateParams({ search, page: 1 })}
          onClear={() => updateParams({ search: "", page: 1 })}
          placeholder={dictionary.table.searchPlaceholder}
          aria-label={dictionary.table.searchPlaceholder}
          className="max-w-md"
        />
        {selectedIds.length > 0 ? (
          <div className="ml-auto flex items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-muted px-3 py-2">
            <span className="text-ui-meta font-semibold text-foreground">{dictionary.table.selectedCount(selectedIds.length)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => onBulkStatus?.(selectedIds)}>
              {dictionary.table.changeStatus}
            </Button>
          </div>
        ) : null}
      </div>

      <Table className="min-w-[52rem]">
        <TableHeader>
          <TableRow className="bg-elevate-2 hover:bg-elevate-2">
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onSelectedIdsChange?.(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...visibleIds])))}
                aria-label={dictionary.table.selectAll}
                className="size-4 rounded border-hairline-strong accent-[var(--brand-accent)]"
              />
            </TableHead>
            {visibleColumns.map((column) => {
              const label = column.label ?? dictionary.table.columns[column.key];
              const sort = columnSort[column.key];
              return (
                <TableHead key={column.key}>
                  {sort ? (
                    <button type="button" className="inline-flex items-center gap-1 text-ui-label text-foreground" onClick={() => updateParams({ sort, page: 1 })} aria-label={dictionary.table.sortBy(label)}>
                      {label}<ArrowDown className="size-3" aria-hidden />
                    </button>
                  ) : <span className="text-ui-label text-foreground">{label}</span>}
                </TableHead>
              );
            })}
            {renderRowActions ? <TableHead><span className="sr-only">{dictionary.table.columns.status}</span></TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? <TableRowsSkeleton rows={6} columns={["action", ...visibleColumns.map((column) => column.key === "status" ? "chip" as const : "text" as const)]} /> : null}
          {!loading && data.items.map((contact) => {
            const name = contactName(contact, dictionary.table.noContact);
            return (
              <TableRow key={contact.id} data-state={selectedIds.includes(contact.id) ? "selected" : undefined} className={onRowClick ? "cursor-pointer" : undefined} onClick={() => onRowClick?.(contact)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(contact.id)}
                    onChange={(event) => onSelectedIdsChange?.(event.target.checked ? [...selectedIds, contact.id] : selectedIds.filter((id) => id !== contact.id))}
                    aria-label={dictionary.table.selectContact(name)}
                    className="size-4 rounded border-hairline-strong accent-[var(--brand-accent)]"
                  />
                </TableCell>
                {visibleColumns.map((column) => <TableCell key={column.key} className="text-ui-body text-muted-foreground">{renderCell(column, contact)}</TableCell>)}
                {renderRowActions ? <TableCell onClick={(event) => event.stopPropagation()}>{renderRowActions(contact)}</TableCell> : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {!loading && data.items.length === 0 ? (
        <EmptyState icon={params.search ? Users : Building2} title={dictionary.table.emptyTitle} hint={dictionary.table.emptyHint} className="flex-1" />
      ) : null}
      {!loading && data.total > 0 ? (
        <TablePagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={(page) => updateParams({ page })}
          summary={dictionary.table.pageSummary(data.total)}
          previousLabel={dictionary.table.previousPage}
          nextLabel={dictionary.table.nextPage}
          pageLabel={dictionary.table.pageLabel}
        />
      ) : null}
    </SurfaceCard>
  );
}
