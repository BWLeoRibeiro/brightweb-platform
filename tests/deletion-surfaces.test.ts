import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

test("platform packages expose every supported destructive UI surface", () => {
  const projectEditor = source("packages/module-projects/src/ui/project-edit-sheet.tsx");
  assert.match(projectEditor, /role === "admin" \|\| role === "owner"/);
  assert.doesNotMatch(projectEditor, /\/api\/projects\/\$\{projectId\}\/access/);
  assert.match(projectEditor, /deleteProject/);

  const organizationSheet = source("packages/module-crm/src/ui/organization-sheet.tsx");
  assert.match(organizationSheet, /Eliminar organização/);
  assert.match(organizationSheet, /Revogar/);
  assert.match(organizationSheet, /window\.prompt/);

  const campaignEditor = source("packages/module-marketing/src/ui/marketing-client.tsx");
  assert.match(campaignEditor, /Eliminar campanha/);
  assert.match(campaignEditor, /deleteRecipient/);
  assert.match(campaignEditor, /\["draft", "canceled"\]/);

  const segmentEditor = source("packages/module-marketing/src/ui/segment-workspace.tsx");
  const workflowEditor = source("packages/module-marketing/src/ui/workflow-workspace.tsx");
  const topicEditor = source("packages/module-marketing/src/ui/topic-workspace.tsx");
  assert.match(segmentEditor, /window\.confirm/);
  assert.match(workflowEditor, /active\.status !== "draft"/);
  assert.match(workflowEditor, /node\.id && !window\.confirm/);
  assert.match(topicEditor, /client\.deleteTopic/);

  const alerts = source("packages/app-shell/src/components/alerts-menu.tsx");
  const shellNotifications = source("packages/app-shell/src/use-shell-notifications.ts");
  assert.match(alerts, /onDismissAll/);
  assert.match(alerts, /Dispensar alerta/);
  assert.match(shellNotifications, /eventIds/);
  assert.doesNotMatch(shellNotifications, /all:\s*true/);
});

test("generated applications mount deletion routes and notification dismissal migration", () => {
  assert.match(
    source("packages/create-bw-app/template/base/app/api/organizations/[id]/route.ts"),
    /handleOrganizationDeleteRequest/,
  );
  assert.match(
    source("packages/create-bw-app/template/base/app/api/notifications/route.ts"),
    /handleNotificationsDeleteRequest as DELETE/,
  );
  assert.match(
    source("packages/create-bw-app/template/modules/marketing/app/api/marketing/topics/[id]/route.ts"),
    /marketingTopicDelete as DELETE/,
  );
  assert.match(
    source("packages/create-bw-app/template/modules/marketing/app/api/marketing/campaigns/[id]/recipients/[recipientId]/route.ts"),
    /marketingCampaignRecipientDelete as DELETE/,
  );
  const notificationDismissals = source(
    "packages/create-bw-app/template/supabase/modules/core/migrations/20260801120000_core_notification_dismissals.sql",
  );
  assert.match(notificationDismissals, /user_notification_dismissals/);
  assert.match(notificationDismissals, /IF p_activity_event_id IS NULL THEN/);
  assert.match(notificationDismissals, /event\.id = p_activity_event_id/);

  const marketingDeletionSafety = source(
    "packages/create-bw-app/template/supabase/modules/marketing/migrations/20260801121000_marketing_deletion_safety.sql",
  );
  assert.match(marketingDeletionSafety, /delete_marketing_campaign_safely/);
  assert.match(marketingDeletionSafety, /delete_marketing_campaign_recipient_safely/);
  assert.match(marketingDeletionSafety, /FOR UPDATE/);
  assert.match(marketingDeletionSafety, /maintain_marketing_campaign_recipient_count/);
  assert.match(marketingDeletionSafety, /AFTER INSERT OR DELETE/);

  const projectMemberSync = source(
    "packages/create-bw-app/template/supabase/modules/projects/migrations/20260801122000_project_member_sync.sql",
  );
  assert.match(projectMemberSync, /sync_project_members_exact/);
  assert.match(projectMemberSync, /FOR UPDATE/);

  const organizationData = source("packages/module-orgs/src/data.ts");
  const marketingServer = source("packages/module-marketing/src/server.ts");
  const previewBoard = source("apps/platform-preview/app/(shell)/projects/[id]/board/page.tsx");
  assert.match(organizationData, /PGRST205/);
  assert.match(organizationData, /23503/);
  assert.match(marketingServer, /23503/);
  assert.match(previewBoard, /getProjectAccess/);
  assert.match(previewBoard, /permissions=\{access\.permissions\}/);
});
