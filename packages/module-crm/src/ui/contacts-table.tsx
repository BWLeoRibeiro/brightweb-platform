"use client";

import { ArrowDown, Trash2, Users } from "lucide-react";
import type { ReactNode } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
} from "@brightweblabs/ui";

import type { CrmContact, CrmContactsListParams, CrmContactsListResult, CrmOwnerOption, CrmContactSort } from "../data";
import { defaultCrmUiDictionary, resolveCrmStages } from "./dictionary";
import type { CrmStageConfig, CrmTableColumnConfig, CrmTableColumnKey, CrmUiDictionary } from "./types";

const defaultColumns: CrmTableColumnConfig[] = [
  { key: "name" },
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

const CRM_TABLE_SURFACE =
  "rounded-[var(--radius-card)] border border-border-hairline bg-[color:var(--project-surface-primary)] shadow-none";
const CRM_TABLE_DIVIDERS = "[&_tr]:border-[color:var(--hairline)]";
const columnWidth: Record<CrmTableColumnKey, string> = {
  name: "w-[30%]",
  organization: "w-[18%]",
  owner: "w-[18%]",
  status: "w-[12%]",
  updated: "w-[17%]",
};
const columnVisibility: Partial<Record<CrmTableColumnKey, string>> = {
  organization: "hidden md:table-cell",
  owner: "hidden xl:table-cell",
  updated: "hidden lg:table-cell",
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
  onBulkDelete?: (contactIds: string[]) => void;
  onQuickStatus?: (contact: CrmContact, status: CrmStageConfig["value"]) => void;
  renderRowActions?: (contact: CrmContact) => ReactNode;
  showToolbar?: boolean;
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
  onBulkDelete,
  onQuickStatus,
  renderRowActions,
  showToolbar = true,
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
      case "name": return (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate paragraph-small font-semibold leading-tight text-[color:var(--foreground)]">{contactName(contact, dictionary.table.noContact)}</p>
          <p className="truncate paragraph-mini leading-tight text-[color:var(--muted-foreground)]">{contact.email ?? contact.phone ?? dictionary.table.noContact}</p>
        </div>
      );
      case "organization": return contact.organizations?.name ?? dictionary.table.unavailable;
      case "owner": return owner?.label ?? dictionary.table.unavailable;
      case "status": return stage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" onClick={(event) => event.stopPropagation()}>
              <StatusPill token={stage.token}>{stage.label}</StatusPill>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44 rounded-xl border-[color:var(--hairline)] bg-[color:var(--popover)] p-1.5 text-[color:var(--popover-foreground)]">
            {resolvedStages.filter((item) => item.value !== contact.status).map((item) => (
              <DropdownMenuItem key={item.value} className="my-0.5 rounded-full" onClick={(event) => { event.stopPropagation(); onQuickStatus?.(contact, item.value); }}>
                <StatusPill token={item.token}>{item.label}</StatusPill>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : contact.status;
      case "updated": return new Intl.DateTimeFormat(dictionary.locale, { day: "2-digit", month: "short" }).format(new Date(contact.updated_at));
    }
  };

  return (
    <SurfaceCard className={`${CRM_TABLE_SURFACE} scroll-mt-28 flex h-[calc(100dvh-12rem)] min-h-[560px] min-w-0 w-full max-w-full flex-col overflow-hidden p-0`}>
      {showToolbar ? <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
        <SearchField
          value={params.search ?? ""}
          onChange={(search) => updateParams({ search, page: 1 })}
          onClear={() => updateParams({ search: "", page: 1 })}
          placeholder={dictionary.table.searchPlaceholder}
          aria-label={dictionary.table.searchPlaceholder}
          className="max-w-md"
        />
        <select
          value={params.status ?? ""}
          onChange={(event) => updateParams({ status: event.target.value || null, page: 1 })}
          aria-label={dictionary.table.allSegments}
          className="h-10 rounded-[var(--radius-control)] border border-hairline bg-card px-3 text-ui-meta text-foreground"
        >
          <option value="">{dictionary.table.allSegments}</option>
          {resolvedStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
        </select>
        <select
          value={params.sort ?? "date_desc"}
          onChange={(event) => updateParams({ sort: event.target.value as CrmContactSort, page: 1 })}
          aria-label={dictionary.table.organizeBy}
          className="h-10 rounded-[var(--radius-control)] border border-hairline bg-card px-3 text-ui-meta text-foreground"
        >
          <option value="date_desc">{dictionary.table.sortNewest}</option>
          <option value="name">{dictionary.table.sortName}</option>
          <option value="company">{dictionary.table.sortCompany}</option>
        </select>
        {selectedIds.length > 0 ? (
          <div className="ml-auto flex items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-muted px-3 py-2">
            <span className="text-ui-meta font-semibold text-foreground">{dictionary.table.selectedCount(selectedIds.length)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => onBulkStatus?.(selectedIds)}>
              {dictionary.table.changeStatus}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onBulkDelete?.(selectedIds)}>
              <Trash2 className="size-3.5" aria-hidden />{dictionary.table.deleteSelected}
            </Button>
          </div>
        ) : null}
      </div> : null}

      <Table containerClassName="overflow-x-hidden" className={`${data.total === 0 ? "h-full table-fixed" : "table-fixed"} ${CRM_TABLE_DIVIDERS}`}>
        <TableHeader>
          <TableRow className="border-b border-[color:var(--hairline-strong)] bg-[color:var(--elevate-2)] hover:bg-[color:var(--elevate-2)] [&_th]:align-middle [&_th]:text-[length:var(--portal-text-micro)] [&_th]:text-[color:var(--foreground)]">
            <TableHead className="h-9 w-[5%] px-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onSelectedIdsChange?.(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...visibleIds])))}
                aria-label={dictionary.table.selectAll}
                className="h-3.5 w-3.5 rounded border border-border-strong"
              />
            </TableHead>
            {visibleColumns.map((column) => {
              const label = column.label ?? dictionary.table.columns[column.key];
              const sort = columnSort[column.key];
              return (
                <TableHead key={column.key} className={`portal-label h-9 px-4 ${columnWidth[column.key]} ${columnVisibility[column.key] ?? ""}`}>
                  {sort ? (
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => updateParams({ sort, page: 1 })} aria-label={dictionary.table.sortBy(label)}>
                      {label}<ArrowDown className="size-3" aria-hidden />
                    </button>
                  ) : <span className="text-ui-label text-foreground">{label}</span>}
                </TableHead>
              );
            })}
            {renderRowActions ? <TableHead className="portal-label h-9 px-4"><span className="sr-only">{dictionary.table.columns.status}</span></TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((contact) => {
            const name = contactName(contact, dictionary.table.noContact);
            return (
              <TableRow key={contact.id} data-state={selectedIds.includes(contact.id) ? "selected" : undefined} className={onRowClick ? "cursor-pointer" : undefined} onClick={() => onRowClick?.(contact)}>
                <TableCell className="w-[5%] px-4 py-2" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(contact.id)}
                    onChange={(event) => onSelectedIdsChange?.(event.target.checked ? [...selectedIds, contact.id] : selectedIds.filter((id) => id !== contact.id))}
                    aria-label={dictionary.table.selectContact(name)}
                    className="h-3.5 w-3.5 rounded border border-border-strong"
                  />
                </TableCell>
                {visibleColumns.map((column) => <TableCell key={column.key} className={`max-w-0 px-4 py-2 paragraph-small text-[color:var(--muted-foreground)] ${columnVisibility[column.key] ?? ""} ${column.key === "organization" || column.key === "owner" ? "truncate" : ""}`}>{renderCell(column, contact)}</TableCell>)}
                {renderRowActions ? <TableCell className="px-4 py-2" onClick={(event) => event.stopPropagation()}>{renderRowActions(contact)}</TableCell> : null}
              </TableRow>
            );
          })}
          {data.total === 0 ? (
            <TableRow className="h-full">
              <TableCell colSpan={visibleColumns.length + 1 + (renderRowActions ? 1 : 0)} className="h-full p-0">
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                  <div className="flex size-11 items-center justify-center rounded-[var(--radius-card)] border border-border-hairline bg-[color:var(--muted)]">
                    <Users className="size-5 text-foreground/30 dark:text-foreground/45" aria-hidden />
                  </div>
                  <div>
                    <p className="paragraph-small font-semibold text-foreground/60 dark:text-foreground/72">{loading ? dictionary.table.emptyLoading : dictionary.table.emptyTitle}</p>
                    <p className="mt-1 paragraph-mini text-foreground/40 dark:text-foreground/58">{loading ? dictionary.table.emptyLoadingHint : dictionary.table.emptyHint}</p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      {data.total > 0 ? (
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
