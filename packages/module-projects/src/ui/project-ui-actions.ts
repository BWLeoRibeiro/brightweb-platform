"use client";

import type { ProjectsUiClient } from "./types";

type CreateProjectInput = { organizationId: string; name: string; code?: string; status: string; targetDate?: string; cancellationReason?: string; summary?: string };
type CreateMilestoneInput = { title: string; status: string; targetDate?: string };
type CreateTaskInput = { title: string; description?: string; status: string; priority: string; milestoneId?: string; assigneeProfileId?: string; dueDate?: string; blockedReason?: string };
type CreateLinkInput = { label: string; url: string; kind: string; visibility: string };
type UpdateMilestoneInput = { title: string; status: string; targetDate: string };
type UpdateTaskInput = { title: string; description: string; status: string; priority: string; milestoneId: string; assigneeProfileId: string; dueDate: string; blockedReason: string };

export async function createProject(client: ProjectsUiClient, input: CreateProjectInput) { return client.createProject(input as Parameters<ProjectsUiClient["createProject"]>[0]); }
export async function createMilestone(client: ProjectsUiClient, projectId: string, input: CreateMilestoneInput) { return { data: await client.createMilestone(projectId, input as Parameters<ProjectsUiClient["createMilestone"]>[1]) }; }
export async function createTask(client: ProjectsUiClient, projectId: string, input: CreateTaskInput) { return { data: await client.createTask(projectId, input as Parameters<ProjectsUiClient["createTask"]>[1]) }; }
export async function createLink(client: ProjectsUiClient, projectId: string, input: CreateLinkInput) { return { data: await client.createLink(projectId, input as Parameters<ProjectsUiClient["createLink"]>[1]) }; }
export async function updateMilestone(client: ProjectsUiClient, projectId: string, milestoneId: string, input: UpdateMilestoneInput) { return { data: await client.updateMilestone(projectId, milestoneId, input as Parameters<ProjectsUiClient["updateMilestone"]>[2]) }; }
export async function updateTask(client: ProjectsUiClient, projectId: string, taskId: string, input: UpdateTaskInput) { return { data: await client.updateTask(projectId, taskId, input as Parameters<ProjectsUiClient["updateTask"]>[2]) }; }
export async function deleteMilestone(client: ProjectsUiClient, projectId: string, milestoneId: string) { return { data: await client.deleteMilestone(projectId, milestoneId) }; }
export async function deleteTask(client: ProjectsUiClient, projectId: string, taskId: string) { return { data: await client.deleteTask(projectId, taskId) }; }
