import { notFound } from "next/navigation";
import { OpenSignupPage } from "./signup-page-client";
import type { SignupMode } from "./types";

export type SignupPageProps = {
  signupMode?: SignupMode;
};

export function SignupPage({ signupMode = "invite-only" }: SignupPageProps = {}) {
  if (signupMode === "invite-only") notFound();
  return <OpenSignupPage />;
}
