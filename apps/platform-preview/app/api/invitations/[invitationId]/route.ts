import { createInvitationDetailsHandler } from "@brightweblabs/core-auth/routes";
import { invitationHttpDependencies } from "../_dependencies";

export const dynamic = "force-dynamic";
export const GET = createInvitationDetailsHandler(invitationHttpDependencies);
