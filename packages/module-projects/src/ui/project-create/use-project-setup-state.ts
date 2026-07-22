"use client";

import { useProjectsUiClient } from "../context";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { defaultProjectsUiDictionary } from "../dictionary";
import { PROJECT_MEMBER_ROLE_LABELS_PT, type ProjectMemberRole } from "../../contracts";

type ProjectMemberOption = {
  profileId: string;
  label: string;
  email: string | null;
  organizationRole: "staff" | "admin" | "org_admin" | "org_member";
  projectRole: ProjectMemberRole | null;
};

type ProjectSetupState = {
  projectId: string;
  projectName: string;
  members: Record<string, ProjectMemberRole>;
};

export const PROJECT_MEMBER_SCOPE_LABELS: Record<ProjectMemberOption["organizationRole"], string> = {
  admin: defaultProjectsUiDictionary.projectCreate.scopeLabels.admin,
  staff: defaultProjectsUiDictionary.projectCreate.scopeLabels.staff,
  org_admin: defaultProjectsUiDictionary.projectCreate.scopeLabels.organizationAdmin,
  org_member: defaultProjectsUiDictionary.projectCreate.scopeLabels.organizationMember,
};

export function useProjectSetupState() {
  const client = useProjectsUiClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupState, setSetupState] = useState<ProjectSetupState | null>(null);
  const [memberOptions, setMemberOptions] = useState<ProjectMemberOption[]>([]);
  const [loadingSetupData, setLoadingSetupData] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMemberOptions = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return memberOptions;
    return memberOptions.filter((member) => (
      member.label.toLowerCase().includes(needle)
      || (member.email ?? "").toLowerCase().includes(needle)
    ));
  }, [memberOptions, memberSearch]);

  const closeSetupSheet = () => {
    setSetupOpen(false);
    setSetupState(null);
    setMemberOptions([]);
    setMemberSearch("");
  };

  const loadSetupData = async (projectId: string, projectName: string, ownerProfileId: string | null = null) => {
    setLoadingSetupData(true);
    try {
      const membersResponse = await client.requestRaw(`/api/projects/${projectId}/members`, { cache: "no-store" });

      const membersPayload = await membersResponse.json();
      if (!membersResponse.ok) {
        const message = typeof membersPayload?.error === "string" ? membersPayload.error : defaultProjectsUiDictionary.team.setupLoadMembersError;
        throw new Error(message);
      }

      const options = (Array.isArray(membersPayload?.data) ? membersPayload.data : []) as ProjectMemberOption[];
      const membersMap = options.reduce<Record<string, ProjectMemberRole>>((acc, option) => {
        if (option.projectRole) acc[option.profileId] = option.projectRole;
        return acc;
      }, {});

      setMemberOptions(options);
      if (ownerProfileId && !membersMap[ownerProfileId]) {
        membersMap[ownerProfileId] = "owner";
      }
      setSetupState({
        projectId,
        projectName,
        members: membersMap,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : defaultProjectsUiDictionary.team.setupPrepareError);
      closeSetupSheet();
    } finally {
      setLoadingSetupData(false);
    }
  };

  const toggleMember = (profileId: string) => {
    setSetupState((current) => {
      if (!current) return current;
      const nextMembers = { ...current.members };
      if (nextMembers[profileId]) {
        delete nextMembers[profileId];
      } else {
        nextMembers[profileId] = "contributor";
      }
      return { ...current, members: nextMembers };
    });
  };

  const setMemberRole = (profileId: string, role: ProjectMemberRole) => {
    setSetupState((current) => {
      if (!current) return current;
      const nextMembers = { ...current.members };
      if (role === "owner") {
        for (const [id, assignedRole] of Object.entries(nextMembers)) {
          if (id !== profileId && assignedRole === "owner") {
            nextMembers[id] = "contributor";
          }
        }
      }
      nextMembers[profileId] = role;
      return {
        ...current,
        members: nextMembers,
      };
    });
  };

  return {
    setupOpen,
    setSetupOpen,
    setupState,
    setSetupState,
    memberOptions,
    setMemberOptions,
    loadingSetupData,
    setLoadingSetupData,
    savingSetup,
    setSavingSetup,
    memberSearch,
    setMemberSearch,
    filteredMemberOptions,
    closeSetupSheet,
    loadSetupData,
    toggleMember,
    setMemberRole,
    projectMemberRoleLabels: PROJECT_MEMBER_ROLE_LABELS_PT,
  };
}
