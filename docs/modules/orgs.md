# Organizations Module

The Organizations module is the shared foundation for organization records, membership, invitations, and organization access checks. CRM and Projects both depend on it; Marketing includes it through CRM.

> Organizations is not independently selectable. The scaffolder enables it automatically, with hidden shell placement, whenever CRM, Marketing, or Projects is selected.

Use [Base Contract](./base-contract.md) for support tiers and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What it installs

- The organizations, organization_members, and organization_invitations tables
- The is_org_admin() and is_org_member() helpers
- Staff, organization-admin, member, and invitation RLS policies
- 14-day invitation expiry and admin or member roles

The Organizations baseline installs without CRM. When CRM is present, CRM integration migrations add accepted-contact linkage, primary-contact synchronization, and the multi-organization contact relationship used when one profile belongs to more than one organization.

## Package and domain contract

`@brightweblabs/module-orgs` owns organization records, membership, invitations, and the request handlers shared by CRM and Projects. Its `orgsModuleRegistration` uses hidden placement so it can participate in shell configuration without adding navigation.

### Organization data and membership

- `listOrganizations()`, `createOrganization()`, `updateOrganization()`, and `deleteOrganization()`
- `listOrganizationMembers()` and `listOrganizationMemberViews()`
- `setOrganizationMemberRole()`, `updateOrganizationMemberRole()`, and `removeOrganizationMember()`
- `syncOrganizationPrimaryContactFromAdmins()` for CRM installations that project organization admins into the primary CRM contact

Organization management is authorized through the caller's global BrightWeb role. Global administrators and staff can continue managing memberships and invitations even when an organization currently has no organization-admin member, so a zero-admin organization remains recoverable. Organization membership itself does not grant access to these staff request handlers.

### Invitations and access outcomes

- `inviteOrganizationMembers()` resolves each email against current Auth identity. Confirmed identities can receive immediate membership; other addresses follow the 14-day invitation path. Identity conflicts are reported for reconciliation rather than granting access from an existing profile alone.
- The result includes per-email `OrganizationInviteOutcome` records and an `OrganizationInviteSummary`, distinguishing immediate access, role updates, unchanged members, duplicate pending invitations, email failures, CRM-link failures, and other API failures.
- `listOrganizationInvitations()`, `getOrganizationInvitationDetails()`, `resendOrganizationInvitation()`, and `revokeOrganizationInvitation()` manage the invitation lifecycle.
- `acceptOrganizationInvitation()` and `registerUserFromOrganizationInvitation()` complete signed-in and first-registration acceptance flows.
- When CRM is installed, use its database-marked `ensureCrmContactForProfile` integration so immediate access and invitation acceptance also link the profile to its CRM contact and organization relationship. A custom integration must first provide a compatible SQL hook through a forward migration and acknowledge it with `contactIntegration: "database"`; an arbitrary callback is rejected. Failed CRM linkage is reported explicitly instead of being presented as a successful access change.

If a new invitation email fails, the package attempts to remove the pending invitation and reports `email_failed`. Cleanup failure retains the invitation identifier and tells the caller to resend or revoke it; delivery is not reported as successful. Resending preserves the existing pending invitation if delivery fails.

### Request handlers

`createOrganizationRequestHandlers()` composes package-owned organization, membership, and invitation handlers with host dependencies such as CRM contact linkage. The package root also exports the default handlers used by generated apps, including organization create/update/delete, invitation list/create/resend/revoke, and member role/removal operations.

### Package UI

`@brightweblabs/module-orgs/ui` exports `OrganizationCreateSheet`, the shared organization-creation surface with optional member invitations used by CRM and Projects.

## Integration guidance

Keep the authenticated Supabase client and global-role decision at the page or route boundary. Pass a service client only to flows that must inspect Auth users, create invitation registrations, or perform the CRM profile-link operation.

For invitation-aware organization creation, use the composed request handlers rather than duplicating membership and email orchestration in an app route. This preserves global staff/admin authorization, per-email outcomes, and transactional membership and contact-link guarantees. Global staff or administrators can recover an organization with no organization-admin member.

See [Base Contract](./base-contract.md) for support tiers and [Using BrightWeb Modules](./using-modules.md) for integration guidance.

## Implementation references

- packages/module-orgs/src
- packages/module-orgs/src/invitations.ts
- packages/module-orgs/src/handlers.ts
- supabase/modules/orgs/migrations
- supabase/module-registry.json
