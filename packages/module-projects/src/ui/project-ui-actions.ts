"use client";

import type { ProjectsUiClient } from "./types";

type CreateMilestoneInput = { title: string; status: string; targetDate?: string; visibility?: "staff" | "client" };
type CreateTaskInput = { title: string; description?: string; status: string; priority: string; milestoneId?: string; assigneeProfileId?: string; startDate?: string; dueDate?: string; blockedReason?: string };
type UpdateMilestoneInput = { title: string; status: string; targetDate: string; visibility?: "staff" | "client" };
type UpdateTaskInput = Partial<{ title: string; description: string; status: string; priority: string; milestoneId: string; assigneeProfileId: string; startDate: string; dueDate: string; blockedReason: string }>;

export async function createMilestone(client: ProjectsUiClient, projectId: string, input: CreateMilestoneInput) { return { data: await client.createMilestone(projectId, input as Parameters<ProjectsUiClient["createMilestone"]>[1]) }; }
export async function createTask(client: ProjectsUiClient, projectId: string, input: CreateTaskInput) { return { data: await client.createTask(projectId, input as Parameters<ProjectsUiClient["createTask"]>[1]) }; }
export async function updateMilestone(client: ProjectsUiClient, projectId: string, milestoneId: string, input: UpdateMilestoneInput) { return { data: await client.updateMilestone(projectId, milestoneId, input as Parameters<ProjectsUiClient["updateMilestone"]>[2]) }; }
export async function updateTask(client: ProjectsUiClient, projectId: string, taskId: string, input: UpdateTaskInput) { return { data: await client.updateTask(projectId, taskId, input as Parameters<ProjectsUiClient["updateTask"]>[2]) }; }
export async function deleteMilestone(client: ProjectsUiClient, projectId: string, milestoneId: string) { return { data: await client.deleteMilestone(projectId, milestoneId) }; }
export async function deleteTask(client: ProjectsUiClient, projectId: string, taskId: string) { return { data: await client.deleteTask(projectId, taskId) }; }
