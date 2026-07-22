"use client";

import { Filter, Plus } from "lucide-react";
import { useState } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, SearchField } from "@brightweblabs/ui";
import { PROJECTS_EVENTS, dispatchProjectsEvent, dispatchProjectsCustomEvent, type ProjectsHealthFilter, type ProjectsStatusFilter } from "./events";
import { useProjectsUiDictionary } from "./context";

const statuses: ProjectsStatusFilter[] = ["all", "planned", "active", "blocked", "completed", "canceled"];
const healthStates: ProjectsHealthFilter[] = ["all", "on_track", "at_risk", "off_track"];

export function ProjectsToolbarControls() {
  const [search, setSearch] = useState("");
  const dictionary = useProjectsUiDictionary();
  return <div className="flex min-w-0 items-center gap-2">
    <SearchField value={search} className="w-52" placeholder="Procurar projetos…" onChange={(value) => { setSearch(value); dispatchProjectsCustomEvent(PROJECTS_EVENTS.setSearch, { query: value }); }} />
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Filter className="size-4" />Filtros</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {statuses.map((status) => <DropdownMenuItem key={status} onSelect={() => dispatchProjectsCustomEvent(PROJECTS_EVENTS.setStatus, { status })}>{status === "all" ? "Todos" : dictionary.status[status]}</DropdownMenuItem>)}
      {healthStates.map((health) => <DropdownMenuItem key={health} onSelect={() => dispatchProjectsCustomEvent(PROJECTS_EVENTS.setHealth, { health })}>{health === "all" ? "Todas" : dictionary.status[health]}</DropdownMenuItem>)}
    </DropdownMenuContent></DropdownMenu>
    <Button size="sm" onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openNewProject)}><Plus className="size-4" />Novo projeto</Button>
  </div>;
}
