"use client";
import { ProjectsPage } from "@brightweblabs/module-projects/ui";
import { listProjects, mockProjectsClient } from "./mock-data";
export default function ProjectsPreviewPage() { return <ProjectsPage client={mockProjectsClient} initialData={listProjects()} initialUpdatedAt="2026-07-22T10:30:00.000Z" portfolioStats={{ total: 3, planned: 1, active: 1, atRisk: 1, overdue: 1 }} organizations={[{ id: "org-atlas", name: "Atlas Studio" }, { id: "org-north", name: "Northstar Foods" }]} navigation={{ listHref: "/projects", detailHref: (id) => `/projects/${id}`, boardHref: (id) => `/projects/${id}/tasks` }} />; }
