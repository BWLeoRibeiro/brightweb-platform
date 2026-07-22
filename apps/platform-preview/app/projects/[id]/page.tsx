"use client";
import { useParams } from "next/navigation";
import { ProjectDetailPage } from "@brightweblabs/module-projects/ui";
import { dashboard, mockProjectsClient } from "../mock-data";
export default function ProjectPreviewDetailPage() { const { id } = useParams<{ id: string }>(); return <ProjectDetailPage client={mockProjectsClient} initialData={{ ...dashboard, project: { ...dashboard.project, id } }} memberColorRoles={{ "owner-leo": "manager", "member-ana": "team", "member-marta": "client" }} navigation={{ listHref: "/projects", detailHref: (projectId) => `/projects/${projectId}`, boardHref: (projectId) => `/projects/${projectId}/tasks` }} />; }
