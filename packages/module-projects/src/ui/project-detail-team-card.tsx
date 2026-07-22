"use client";

import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { ContactActionButtons } from "./shared/contact-action-buttons";
import { ProjectOwnerAvatar } from "./shared/project-owner-avatar";
import { MemberRoleBadge } from "./shared/member-role-badge";
import { SectionEmptyState } from "./shared/section-feedback";
import { Users } from "lucide-react";
import { ProjectMembersEditSheetLazy } from "./project-lazy-panels";
import { useProjectDetailData } from "./project-detail-data-provider";
import { memberRoleToColorFallback, type AvatarRoleColor, type RoleColor } from "./shared/role-colors";
import { useProjectsUiDictionary } from "./context";

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
  const colorRoleFor = (profileId: string, role: string): RoleColor => {
    const resolved = (memberColorRoles[profileId] ?? memberRoleToColorFallback(role)) as AvatarRoleColor;
    return resolved === "accent" ? "team" : resolved;
  };
  // Surface the gestor first, then the client, then the rest of the team.
  const colorRoleOrder: Record<RoleColor, number> = { manager: 0, client: 1, team: 2, admin: 3 };
  const sortedMembers = [...members].sort((a, b) => {
    const orderDiff =
      colorRoleOrder[colorRoleFor(a.profileId, a.role)] - colorRoleOrder[colorRoleFor(b.profileId, b.role)];
    if (orderDiff !== 0) return orderDiff;
    return a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" });
  });

  return (
    <ProjectSurfaceCard className="self-start">
      <ProjectSurfaceSectionHeader
        icon={Users}
        title={dictionary.detail.allocatedTeam}
        subtitle={dictionary.detail.allocatedTeamSubtitle}
        rightSlot={
          canManageMembers ? (
            <ProjectMembersEditSheetLazy
              projectId={project.id}
              initialMembers={members.map((member) => ({ profileId: member.profileId, role: member.role }))}
            />
          ) : null
        }
      />
      {sortedMembers.length === 0 ? (
        <div className="mt-4">
          <SectionEmptyState message={dictionary.detail.noAllocatedMembers} icon={Users} />
        </div>
      ) : (
        <ul className="portal-scroll mt-4 h-[17.75rem] rounded-[var(--radius-card)] border border-[color:var(--border)]">
          {sortedMembers.map((member) => {
            const contactCount = (member.email ? 1 : 0) + (member.phone ? 1 : 0);
            const padHoverClass =
              contactCount >= 2
                ? "group-focus-within:pr-[5.25rem] group-hover:pr-[5.25rem]"
                : contactCount === 1
                  ? "group-focus-within:pr-[2.75rem] group-hover:pr-[2.75rem]"
                  : "";
            const contactText = member.email ?? member.phone;
            const colorRole = colorRoleFor(member.profileId, member.role);

            return (
              <li
                key={member.id}
                className="group relative flex min-h-[3.25rem] items-center gap-3 border-t border-[color:var(--border)] px-3 py-1.5 transition-colors first:border-t-0 hover:bg-[color:var(--project-ui-color-09)]"
              >
                <ProjectOwnerAvatar label={member.label} size="md" roleColor={colorRole} />
                <div className={`min-w-0 flex-1 py-0.5 transition-[padding] duration-200 ${padHoverClass}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="portal-body min-w-0 flex-1 truncate font-semibold leading-snug">{member.label}</p>
                    <MemberRoleBadge role={member.role} colorRole={colorRole} />
                  </div>
                  {contactText ? (
                    <div className="portal-meta mt-0.5 truncate">{contactText}</div>
                  ) : null}
                </div>
                {contactCount > 0 ? (
                  <div className="pointer-events-none absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
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
              </li>
            );
          })}
        </ul>
      )}
    </ProjectSurfaceCard>
  );
}
