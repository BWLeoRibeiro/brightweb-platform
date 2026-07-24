import { createInvitationAcceptHandler } from "@brightweblabs/core-auth/routes";
import { invitationHttpDependencies } from "../../_dependencies";

export const dynamic = "force-dynamic";
export const POST = createInvitationAcceptHandler(invitationHttpDependencies);
