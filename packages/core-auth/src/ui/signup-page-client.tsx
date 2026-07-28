"use client";

import { AuthCard, AuthHeading, AuthLayout } from "./auth-layout";
import { useAuthUi } from "./context";

export function OpenSignupPage() {
  const { dictionary } = useAuthUi();

  // TODO(core-auth): add open registration when its profile/role policy is defined.
  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading title={dictionary.signup.openTodoTitle} description={dictionary.signup.openTodoDescription} />
      </AuthCard>
    </AuthLayout>
  );
}
