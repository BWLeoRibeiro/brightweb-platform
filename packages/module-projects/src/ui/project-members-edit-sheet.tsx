"use client";

import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Plus, Save, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sheetShellClassName } from "./constants";
import { AppSheetBody, AppSheetFooter, AppSheetHeader, SheetSection } from "./shared/app-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  SearchField,
  Sheet,
  SheetContent,
  Skeleton,
  TooltipProvider,
} from "@brightweblabs/ui";
import { SectionIconButton } from "./shared/section-icon-button";
import type { ProjectMemberRole } from "../contracts";
import { parseProjectBoardApiError } from "./project-board-response-parser";
import {
  AddResultRow,
  applyProjectTeamMemberRoles,
  defaultRoleForProjectTeam,
  filterAvailableProjectMembers,
  findRemovedProjectTeamMemberIds,
  TeamMemberRow,
  TEAM_MEMBER_AVATAR_CLASS_NAME,
  type ProjectMemberOption,
} from "./project-team-members";

export {
  applyProjectTeamMemberRoles,
  defaultRoleForProjectTeam,
  filterAvailableProjectMembers,
  findRemovedProjectTeamMemberIds,
  hasProjectTeamOwner,
} from "./project-team-members";

const MAX_ADD_RESULTS = 25;

function projectMemberRoles(
  members: Array<{ profileId: string; role: ProjectMemberRole }>,
): Record<string, ProjectMemberRole> {
  return Object.fromEntries(members.map((member) => [member.profileId, member.role]));
}


type ProjectMembersEditSheetProps = {
  projectId: string;
  initialMembers: Array<{ profileId: string; role: ProjectMemberRole }>;
};

export function ProjectMembersEditSheet({
  projectId,
  initialMembers,
}: ProjectMembersEditSheetProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const router = useRouter();
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovalConfirmationOpen, setIsRemovalConfirmationOpen] = useState(false);
  const [view, setView] = useState<"allocated" | "add">("allocated");
  const [memberSearch, setMemberSearch] = useState("");
  const [pendingMemberRoles, setPendingMemberRoles] = useState<Record<string, ProjectMemberRole>>({});
  const [memberOptions, setMemberOptions] = useState<ProjectMemberOption[]>([]);
  const [savedMembers, setSavedMembers] = useState<Record<string, ProjectMemberRole>>(
    () => projectMemberRoles(initialMembers),
  );
  const [selectedMembers, setSelectedMembers] = useState<Record<string, ProjectMemberRole>>(
    () => projectMemberRoles(initialMembers),
  );

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    if (open) return;
    setView("allocated");
    setMemberSearch("");
    setPendingMemberRoles({});
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const controller = new AbortController();

    const loadMembers = async () => {
      setIsLoading(true);
      try {
        const response = await client.requestRaw(`/api/projects/${projectId}/members`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = parseProjectBoardApiError(payload, dictionary.team.loadOptionsError);
          throw new Error(message);
        }

        const options = (
          (Array.isArray(payload?.data) ? payload.data : []) as Array<
            ProjectMemberOption & { organizationRole: string }
          >
        ).filter(
          (option): option is ProjectMemberOption => (
            option.organizationRole === "staff" || option.organizationRole === "admin"
          ),
        );
        if (!isMounted) return;

        setMemberOptions(options);
        setView("allocated");
        setPendingMemberRoles({});
        const fromApi = options.reduce<Record<string, ProjectMemberRole>>((acc, option) => {
          if (option.projectRole) acc[option.profileId] = option.projectRole;
          return acc;
        }, {});
        setSavedMembers(fromApi);
        setSelectedMembers(fromApi);
      } catch (error) {
        if (!isMounted) return;
        toast.error(error instanceof Error ? error.message : dictionary.team.loadFallbackError);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadMembers();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [initialMembers, open, projectId]);

  const optionsByProfile = useMemo(() => {
    return new Map(memberOptions.map((option) => [option.profileId, option]));
  }, [memberOptions]);

  // Allocated internal people stay visible, with the responsible person first.
  const teamMembers = useMemo(() => {
    return Object.keys(selectedMembers)
      .map((profileId) => optionsByProfile.get(profileId))
      .filter((option): option is ProjectMemberOption => Boolean(option))
      .sort((a, b) => {
        const ownerOrder = Number(selectedMembers[b.profileId] === "owner")
          - Number(selectedMembers[a.profileId] === "owner");
        return ownerOrder || a.label.localeCompare(b.label, "pt");
      });
  }, [optionsByProfile, selectedMembers]);

  // Show every available internal person by default; search only narrows the list.
  const addResults = useMemo(() => {
    return filterAvailableProjectMembers(memberOptions, selectedMembers, memberSearch);
  }, [memberOptions, memberSearch, selectedMembers]);

  const togglePendingMember = (profileId: string) => {
    setPendingMemberRoles((current) => {
      if (current[profileId]) {
        const next = { ...current };
        delete next[profileId];
        return next;
      }
      return {
        ...current,
        [profileId]: defaultRoleForProjectTeam({ ...selectedMembers, ...current }),
      };
    });
  };

  const setPendingMemberRole = (profileId: string, role: ProjectMemberRole) => {
    setPendingMemberRoles((current) => {
      if (!current[profileId]) return current;
      const next = { ...current };
      if (role === "owner") {
        for (const [id, assignedRole] of Object.entries(next)) {
          if (id !== profileId && assignedRole === "owner") next[id] = "contributor";
        }
      }
      next[profileId] = role;
      return next;
    });
  };

  const confirmPendingMembers = () => {
    setSelectedMembers((current) => applyProjectTeamMemberRoles(current, pendingMemberRoles));
    setPendingMemberRoles({});
    setMemberSearch("");
    setView("allocated");
  };

  const returnToAllocatedTeam = () => {
    setView("allocated");
    setPendingMemberRoles({});
    setMemberSearch("");
  };

  const removeMember = (profileId: string) => {
    setSelectedMembers((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
  };

  const setMemberRole = (profileId: string, role: ProjectMemberRole) => {
    setSelectedMembers((current) => {
      const next = { ...current };
      if (role === "owner") {
        for (const [id, assignedRole] of Object.entries(next)) {
          if (id !== profileId && assignedRole === "owner") {
            next[id] = "contributor";
          }
        }
      }
      next[profileId] = role;
      return next;
    });
  };

  const persistMembers = async () => {
    const membersPayload = Object.entries(selectedMembers).map(([profileId, role]) => ({ profileId, role }));
    setIsSaving(true);
    try {
      const response = await client.requestRaw(`/api/projects/${projectId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: membersPayload }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = parseProjectBoardApiError(payload, dictionary.team.saveError);
        throw new Error(message);
      }

      toast.success(
        removedMemberIds.length > 0
          ? dictionary.team.membersRemoved(removedMemberIds.length)
          : dictionary.team.updated,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.team.saveFallbackError);
    } finally {
      setIsSaving(false);
    }
  };

  const removedMemberIds = findRemovedProjectTeamMemberIds(savedMembers, selectedMembers);
  const removedMemberLabels = removedMemberIds.map((profileId) => (
    optionsByProfile.get(profileId)?.label ?? dictionary.people.member
  ));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || view !== "allocated") return;
    if (removedMemberIds.length > 0) {
      setIsRemovalConfirmationOpen(true);
      return;
    }
    void persistMembers();
  };

  if (!isClientMounted) {
    return (
      <TooltipProvider>
        <SectionIconButton icon={Pencil} label={dictionary.team.edit} disabled />
      </TooltipProvider>
    );
  }

  const needle = memberSearch.trim();
  const pendingMemberCount = Object.keys(pendingMemberRoles).length;

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={setOpen}>
        <SectionIconButton icon={Pencil} label={dictionary.team.edit} onClick={() => setOpen(true)} />
        <SheetContent className={sheetShellClassName}>
          <AppSheetHeader
            icon={view === "allocated" ? Users : UserPlus}
            editing
            eyebrow={dictionary.board.editEyebrow}
            title={<>{view === "allocated" ? dictionary.detail.allocatedTeam : dictionary.team.addMember}</>}
            description={<>{view === "allocated" ? dictionary.team.description : dictionary.team.addMemberDescription}</>}
          />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <AppSheetBody>
            {isLoading ? (
              <SheetSection title={dictionary.team.inProject} editing bodyClassName="divide-y divide-[color:var(--border)]">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5">
                    <Skeleton rounded="999px" className={TEAM_MEMBER_AVATAR_CLASS_NAME} />
                    <div className="space-y-1.5">
                      <Skeleton rounded="999px" className="h-3 w-2/5" />
                      <Skeleton rounded="999px" className="h-2.5 w-3/5" />
                    </div>
                    <Skeleton rounded="8px" className="col-span-2 h-9 w-full" />
                  </div>
                ))}
              </SheetSection>
            ) : (
              view === "allocated" ? (
                <>
                  <div className="space-y-3">
                    <SheetSection
                      title={dictionary.team.inProject}
                      editing
                      aside={<span className="rounded-full bg-muted px-2 py-0.5 text-data text-meta font-semibold text-muted-foreground">{teamMembers.length}</span>}
                      bodyClassName="divide-y divide-[color:var(--border)]"
                    >
                      {teamMembers.length === 0 ? (
                        <p className="px-4 py-6 text-center text-meta text-muted-foreground">{dictionary.team.noneAllocated}</p>
                      ) : (
                        <div className="divide-y divide-[color:var(--border)]">
                          {teamMembers.map((member) => (
                            <TeamMemberRow
                              key={member.profileId}
                              member={member}
                              role={selectedMembers[member.profileId]}
                              roleLabel={dictionary.team.memberRoleLabel(member.label)}
                              removeLabel={dictionary.team.remove}
                              removeTitle={dictionary.team.removeFromProject}
                              onRoleChange={(role) => setMemberRole(member.profileId, role)}
                              onRemove={() => removeMember(member.profileId)}
                            />
                          ))}
                        </div>
                      )}
                    </SheetSection>
                  </div>

                  <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setView("add")}>
                    <Plus className="mr-2 size-4" />
                    {dictionary.team.addMember}
                  </Button>
                </>
              ) : (
                <section className="space-y-3">
                  <SearchField
                    size="sm"
                    value={memberSearch}
                    onChange={setMemberSearch}
                    onClear={() => setMemberSearch("")}
                    placeholder={dictionary.team.searchPlaceholder}
                  />
                  {addResults.length === 0 ? (
                    <p className="text-meta text-foreground/55">
                      {needle ? dictionary.team.noResults(needle) : dictionary.team.noneAvailable}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {addResults.slice(0, MAX_ADD_RESULTS).map((member) => (
                        <AddResultRow
                          key={member.profileId}
                          member={member}
                          role={pendingMemberRoles[member.profileId] ?? null}
                          roleLabel={dictionary.team.memberRoleLabel(member.label)}
                          selectLabel={dictionary.team.selectMemberLabel(member.label)}
                          lockOwner={false}
                          onToggle={() => togglePendingMember(member.profileId)}
                          onRoleChange={(role) => setPendingMemberRole(member.profileId, role)}
                        />
                      ))}
                      {addResults.length > MAX_ADD_RESULTS ? (
                        <p className="text-meta text-foreground/55">
                          {dictionary.team.resultLimit(MAX_ADD_RESULTS, addResults.length)}
                        </p>
                      ) : null}
                    </div>
                  )}
                </section>
              )
            )}
            </AppSheetBody>

            <AppSheetFooter className="flex-row">
            {view === "allocated" ? (
              <>
                <Button type="submit" className="flex-1" disabled={isSaving || isLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? dictionary.actions.saving : dictionary.team.save}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isSaving}>
                  {dictionary.actions.cancel}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={pendingMemberCount === 0}
                  onClick={confirmPendingMembers}
                >
                  <UserPlus className="mr-2 size-4" />
                  {dictionary.team.addSelectedMembers(pendingMemberCount)}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={returnToAllocatedTeam}>
                  <ArrowLeft className="mr-2 size-4" />
                  {dictionary.team.backToTeam}
                </Button>
              </>
            )}
            </AppSheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={isRemovalConfirmationOpen}
        onOpenChange={(next) => {
          if (!next && !isSaving) setIsRemovalConfirmationOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.team.removeConfirmationTitle(removedMemberIds.length)}</AlertDialogTitle>
            <AlertDialogDescription>
              {dictionary.team.removeConfirmationDescription(removedMemberLabels)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{dictionary.team.keepMembers}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSaving}
              onClick={() => {
                setIsRemovalConfirmationOpen(false);
                void persistMembers();
              }}
            >
              {dictionary.team.confirmRemoval}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
