"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, AuthHeading, AuthLayout } from "./auth-layout";
import { useAuthUi } from "./context";

export function SignupPage() {
  const router = useRouter();
  const { dictionary, signupMode = "invite-only" } = useAuthUi();

  useEffect(() => {
    if (signupMode === "invite-only") router.replace("/login?message=invite-only");
  }, [router, signupMode]);

  if (signupMode === "invite-only") return null;

  // TODO(core-auth): add open registration when its profile/role policy is defined.
  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading title={dictionary.signup.openTodoTitle} description={dictionary.signup.openTodoDescription} />
      </AuthCard>
    </AuthLayout>
  );
}
