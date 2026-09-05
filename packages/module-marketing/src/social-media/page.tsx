import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { SocialMediaClient } from "./social-media-client";
import { parseSocialMediaPlan } from "./validate-plan";

export type { SocialMediaPlan } from "./types";
export { parseSocialMediaPlan } from "./validate-plan";

export async function SocialMediaPage({ plan }: { plan: unknown }) {
  await requireServerPageRoleAccess(["staff", "admin"]);
  return <SocialMediaClient plan={parseSocialMediaPlan(plan)} />;
}
