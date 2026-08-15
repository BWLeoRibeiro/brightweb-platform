"use client";

import { useState } from "react";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { projectAccessDictionary } from "./project-access-dictionary";
import { ContactActionButtons } from "./shared/contact-action-buttons";
import { ProjectOwnerAvatar } from "./shared/project-owner-avatar";
import { MemberRoleBadge } from "./shared/member-role-badge";
import { SectionEmptyState } from "./shared/section-feedback";
import { Users } from "lucide-react";
import { ProjectMembersEditSheetLazy } from "./project-lazy-panels";
import { useProjectDetailData } from "./project-detail-data-provider";
import { memberRoleToColorFallback, type AvatarRoleColor, type RoleColor } from "./shared/role-colors";
import { useProjectsUiDictionary } from "./context";
import { AppSheetHeader } from "./shared/app-sheet";
import { sheetBodyClassName, sheetShellClassName } from "./constants";
import { Sheet, SheetContent } from "@brightweblabs/ui";
import {
  CompactCollectionHeaderActions,
  compactCollectionRevealClassName,
} from "./shared/compact-collection";
import { getCompactCollectionPreview } from "./shared/compact-collection-model";

type ProjectDetailTeamCardProps = {
  canManageMembers: boolean;
  /** Server-resolved color bucket per member profile id. */
  memberColorRoles: Record<string, RoleColor>;
};

const CONTACT_ICON_LINK_CLASS =
  "pointer-events-auto flex size-8 items-center justify-center rounded-full text-foreground/45 transition hover:bg-[color:var(--muted)] hover:text-foreground";

export function ProjectDetailTeamCard({ canManageMembers, memberColorRoles }: ProjectDetailTeamCardProps) {
  const { project, members } = useProjectDetailData();
  const dictionary = useProjectsUiDictionary();
  const [isAllTeamOpen, setAllTeamOpen] = useState(false);
  const colorRoleFor = (profileId: string, role: string): RoleColor => {
    const resolved = (memberColorRoles[profileId] ?? memberRoleToColorFallback(role)) as AvatarRoleColor;
    return resolved === "accent" ? "team" : resolved;
  };
  // Client grants are deliberately separate from project_members. Filter any
  // legacy client-coloured rows so this card remains an internal team surface.
  const internalMembers = members.filter((member) => colorRoleFor(member.profileId, member.role) !== "client");
  const colorRoleOrder: Record<Exclude<RoleColor, "client">, number> = { manager: 0, team: 1, admin: 2 };
  const sortedMembers = [...internalMembers].sort((a, b) => {
    const colorA = colorRoleFor(a.profileId, a.role) as Exclude<RoleColor, "client">;
    const colorB = colorRoleFor(b.profileId, b.role) as Exclude<RoleColor, "client">;
    const orderDiff =
      colorRoleOrder[colorA] - colorRoleOrder[colorB];
    if (orderDiff !== 0) return orderDiff;
    return a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" });
  });

  const renderMembers = (items: typeof sortedMembers) => items.map((member) => {
    const contactCount = (member.email ? 1 : 0) + (member.phone ? 1 : 0);
    const contactText = member.email ?? member.phone;
    const colorRole = colorRoleFor(member.profileId, member.role);

    return (
      <li
        key={member.id}
        className="group relative flex min-h-[3.25rem] items-center gap-3 border-t border-[color:var(--border)] px-3 py-1.5 transition-colors first:border-t-0 hover:bg-[color:var(--project-ui-color-09)]"
      >
        <ProjectOwnerAvatar label={member.label} size="md" roleColor={colorRole} />
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-body font-semibold leading-snug text-foreground">{member.label}</p>
          {contactText ? (
            <div className="text-meta text-muted-foreground mt-0.5 truncate">{contactText}</div>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <MemberRoleBadge role={member.role} colorRole={colorRole} />
          {contactCount > 0 ? (
            <div className="pointer-events-none flex items-center gap-0.5 opacity-0 transition-opacity duration-200 motion-reduce:transition-none group-focus-within:opacity-100 group-hover:opacity-100">
              <ContactActionButtons
                label={member.label}
                email={member.email}
                phone={member.phone}
                projectName={project.name}
                projectReference={project.code ?? project.id}
                linkClassName={CONTACT_ICON_LINK_CLASS}
                iconClassName="size-4"
              />
            </div>
          ) : null}
        </div>
      </li>
    );
  });

  return (
    <ProjectSurfaceCard className="self-start">
      <ProjectSurfaceSectionHeader
        icon={Users}
        title={projectAccessDictionary.detail.internalTeam}
        subtitle={projectAccessDictionary.detail.internalTeamSubtitle}
        rightSlot={<CompactCollectionHeaderActions total={sortedMembers.length} collectionLabel={projectAccessDictionary.detail.internalTeam} expandLabel={dictionary.team.viewAll} onExpand={() => setAllTeamOpen(true)}>
          {canManageMembers ? (
            <ProjectMembersEditSheetLazy
              projectId={project.id}
              initialMembers={internalMembers.map((member) => ({ profileId: member.profileId, role: member.role }))}
            />
          ) : null}
        </CompactCollectionHeaderActions>}
      />
      {sortedMembers.length === 0 ? (
        <div className="mt-4">
          <SectionEmptyState message={dictionary.detail.noAllocatedMembers} icon={Users} />
        </div>
      ) : (
        <ul className={`${compactCollectionRevealClassName} mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)]`}>
          {renderMembers(getCompactCollectionPreview(sortedMembers))}
        </ul>
      )}
      <Sheet open={isAllTeamOpen} onOpenChange={setAllTeamOpen}>
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={Users}
            title={<>{projectAccessDictionary.detail.internalTeam}</>}
            description={<>{projectAccessDictionary.detail.internalTeamDescription}</>}
          />
          <div className={sheetBodyClassName}>
            <ul className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)]">
              {renderMembers(sortedMembers)}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </ProjectSurfaceCard>
  );
}
