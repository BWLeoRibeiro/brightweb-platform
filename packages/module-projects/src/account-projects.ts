import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectListItem } from "./data";
import {
  isProjectsSchemaMissingError,
  listOrgAdminProjectsByProfile,
  listProjects,
} from "./server";

export type AccountProjectsResult = {
  items: ProjectListItem[];
  schemaMissing: boolean;
  error: string | null;
};

type AccountProjectsDependencies = {
  isProjectsSchemaMissingError: typeof isProjectsSchemaMissingError;
  listOrgAdminProjectsByProfile: typeof listOrgAdminProjectsByProfile;
  listProjects: typeof listProjects;
};

const defaultDependencies: AccountProjectsDependencies = {
  isProjectsSchemaMissingError,
  listOrgAdminProjectsByProfile,
  listProjects,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return String(error);
}

function isMissingRoleAssignmentsTable(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("user_role_assignments") && message.includes("does not exist");
}

export async function listAccountProjects(
  supabase: SupabaseClient,
  profileId: string | null | undefined,
  options?: { limit?: number },
  dependencies: AccountProjectsDependencies = defaultDependencies,
): Promise<AccountProjectsResult> {
  if (!profileId) {
    return { items: [], schemaMissing: false, error: null };
  }

  const limit = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 20;

  try {
    const items = await dependencies.listOrgAdminProjectsByProfile(supabase, profileId, { limit });
    return { items, schemaMissing: false, error: null };
  } catch (error) {
    if (dependencies.isProjectsSchemaMissingError(error)) {
      return { items: [], schemaMissing: true, error: null };
    }

    if (isMissingRoleAssignmentsTable(error)) {
      try {
        const fallback = await dependencies.listProjects(supabase, {
          page: 1,
          pageSize: limit,
          dueWindow: "all",
        });
        return { items: fallback.items, schemaMissing: false, error: null };
      } catch (fallbackError) {
        if (dependencies.isProjectsSchemaMissingError(fallbackError)) {
          return { items: [], schemaMissing: true, error: null };
        }

        return {
          items: [],
          schemaMissing: false,
          error: getErrorMessage(fallbackError),
        };
      }
    }

    return { items: [], schemaMissing: false, error: getErrorMessage(error) };
  }
}
