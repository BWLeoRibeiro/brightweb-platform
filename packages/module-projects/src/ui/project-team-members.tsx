"use client";

import { X } from "lucide-react";
import { Button, Checkbox } from "@brightweblabs/ui";
import { SheetSelect } from "./shared/app-sheet";
import { ProjectOwnerAvatar } from "./shared/project-owner-avatar";
import { defaultProjectsUiDictionary } from "./dictionary";
import { PROJECT_MEMBER_ROLE_LABELS_PT, type ProjectMemberRole } from "../contracts";

export type ProjectMemberOption = {
  profileId: string;
  label: string;
  email: string | null;
  organizationRole: "staff" | "admin";
  projectRole: ProjectMemberRole | null;
};

export const TEAM_MEMBER_AVATAR_CLASS_NAME = "size-8";

export function hasProjectTeamOwner(members: Record<string, ProjectMemberRole>): boolean {
  return Object.values(members).includes("owner");
}

export function defaultRoleForProjectTeam(_members: Record<string, ProjectMemberRole>): ProjectMemberRole {
  return "contributor";
}

export function findRemovedProjectTeamMemberIds(
  savedMembers: Record<string, ProjectMemberRole>,
  selectedMembers: Record<string, ProjectMemberRole>,
): string[] {
  return Object.keys(savedMembers).filter((profileId) => !selectedMembers[profileId]);
}

export function applyProjectTeamMemberRoles(
  members: Record<string, ProjectMemberRole>,
  additions: Record<string, ProjectMemberRole>,
): Record<string, ProjectMemberRole> {
  const next = { ...members };
  for (const [profileId, role] of Object.entries(additions)) {
    if (role === "owner") {
      for (const [id, assignedRole] of Object.entries(next)) {
        if (id !== profileId && assignedRole === "owner") next[id] = "contributor";
      }
    }
    next[profileId] = role;
  }
  return next;
}

export function filterAvailableProjectMembers(
  memberOptions: ProjectMemberOption[],
  selectedMembers: Record<string, ProjectMemberRole>,
  search: string,
): ProjectMemberOption[] {
  const needle = search.trim().toLowerCase();
  return memberOptions
    .filter((member) => !selectedMembers[member.profileId])
    .filter((member) => (
      !needle
      || member.label.toLowerCase().includes(needle)
      || (member.email ?? "").toLowerCase().includes(needle)
    ))
    .sort((a, b) => a.label.localeCompare(b.label, "pt"));
}

function MemberIdentity({ member }: { member: ProjectMemberOption }) {
  return (
    <div className="min-w-0 flex-1">
      <span className="block truncate text-body font-semibold text-foreground">{member.label}</span>
      <span className="block truncate text-meta text-foreground/60">
        {member.email ?? defaultProjectsUiDictionary.people.noEmail}
      </span>
    </div>
  );
}

export function TeamMemberRow({
  member,
  role,
  roleLabel,
  removeLabel,
  removeTitle,
  ownerDisabled = false,
  onRoleChange,
  onRemove,
}: {
  member: ProjectMemberOption;
  role: ProjectMemberRole;
  roleLabel: string;
  removeLabel: string;
  removeTitle: string;
  ownerDisabled?: boolean;
  onRoleChange: (role: ProjectMemberRole) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5">
      <ProjectOwnerAvatar
        label={member.label}
        size="md"
        roleColor={role === "owner" ? "manager" : "team"}
        className={TEAM_MEMBER_AVATAR_CLASS_NAME}
      />
      <div className="min-w-0 self-center">
        <MemberIdentity member={member} />
      </div>
      <div className="col-span-2 flex min-w-0 items-center gap-2">
        <SheetSelect
          className="min-w-0 flex-1"
          aria-label={roleLabel}
          value={role}
          onValueChange={(value) => onRoleChange(value as ProjectMemberRole)}
          options={[
            { value: "owner", label: PROJECT_MEMBER_ROLE_LABELS_PT.owner, disabled: ownerDisabled },
            { value: "contributor", label: PROJECT_MEMBER_ROLE_LABELS_PT.contributor },
            { value: "observer", label: PROJECT_MEMBER_ROLE_LABELS_PT.observer },
          ]}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 self-center px-2 text-foreground/55 hover:text-semantic-danger-strong"
          onClick={onRemove}
          title={removeTitle}
        >
          <X className="mr-1 size-3.5" />
          {removeLabel}
        </Button>
      </div>
    </div>
  );
}

export function AddResultRow({
  member,
  role,
  roleLabel,
  selectLabel,
  lockOwner,
  ownerDisabled = false,
  onToggle,
  onRoleChange,
}: {
  member: ProjectMemberOption;
  role: ProjectMemberRole | null;
  roleLabel: string;
  selectLabel: string;
  lockOwner: boolean;
  ownerDisabled?: boolean;
  onToggle: () => void;
  onRoleChange: (role: ProjectMemberRole) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-background/40 transition-colors hover:bg-foreground/[0.035] dark:hover:bg-white/[0.045]">
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
        <Checkbox checked={role !== null} onChange={onToggle} aria-label={selectLabel} />
        <ProjectOwnerAvatar
          label={member.label}
          size="md"
          roleColor={role === "owner" ? "manager" : "team"}
          className={TEAM_MEMBER_AVATAR_CLASS_NAME}
        />
        <MemberIdentity member={member} />
      </label>
      {role ? (
        <div className="border-t border-[color:var(--border)] px-3 py-2.5">
          <SheetSelect
            aria-label={roleLabel}
            value={role}
            onValueChange={(value) => onRoleChange(value as ProjectMemberRole)}
            options={[
              { value: "owner", label: PROJECT_MEMBER_ROLE_LABELS_PT.owner, disabled: ownerDisabled },
              { value: "contributor", label: PROJECT_MEMBER_ROLE_LABELS_PT.contributor, disabled: lockOwner },
              { value: "observer", label: PROJECT_MEMBER_ROLE_LABELS_PT.observer, disabled: lockOwner },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
