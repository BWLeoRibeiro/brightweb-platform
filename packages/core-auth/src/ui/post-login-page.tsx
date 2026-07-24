"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolvePostLoginPath } from "../shared";
import { useAuthUi } from "./context";

function isPathWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Literal port of MQ's allow-listed post-login redirect resolver. */
export function resolveRequestedInternalPath(
  value: string | undefined,
  { isAdmin, isStaff }: { isAdmin: boolean; isStaff: boolean },
) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;

  let target: URL;
  try {
    target = new URL(value, "https://portal.local");
  } catch {
    return null;
  }

  const pathname = target.pathname;
  if (
    isPathWithin(pathname, "/auth")
    || ["/login", "/signup", "/forgot-password", "/reset-password", "/invite"].some((prefix) =>
      isPathWithin(pathname, prefix),
    )
  ) return null;

  const resolvedPath = `${pathname}${target.search}${target.hash}`;
  if (isPathWithin(pathname, "/account")) return resolvedPath;
  if (isPathWithin(pathname, "/admin")) return isAdmin ? resolvedPath : null;

  const staffPrefixes = ["/dashboard", "/crm", "/projetos", "/ferramentas"];
  if (staffPrefixes.some((prefix) => isPathWithin(pathname, prefix))) return isStaff ? resolvedPath : null;
  return null;
}

function PostLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brand, client, dictionary } = useAuthUi();
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const skeletonTimer = window.setTimeout(() => setShowSkeleton(true), 400);
    let cancelled = false;

    async function resolveRedirect() {
      try {
        const access = await client.getPostLoginAccess();
        if (cancelled) return;
        if (!access.user) {
          router.replace("/login");
          return;
        }

        const invitationId = searchParams.get("invitationId");
        if (invitationId && access.profileId && access.user.email && client.acceptInvite) {
          try {
            await client.acceptInvite({ invitationId, profileId: access.profileId, email: access.user.email });
          } catch {
            // Invitation acceptance is best-effort, matching MQ's post-login route.
          }
        }

        const requestedTarget = searchParams.get("next") ?? searchParams.get("redirectTo") ?? undefined;
        const target = resolveRequestedInternalPath(requestedTarget, access) ?? resolvePostLoginPath(access.role);
        router.replace(target);
      } catch {
        router.replace("/login?error=auth_system");
      }
    }

    void resolveRedirect();
    return () => {
      cancelled = true;
      window.clearTimeout(skeletonTimer);
    };
  }, [client, router, searchParams]);

  return (
    <main className="auth-post-login">
      <div className="auth-post-login__content" aria-live="polite">
        <div className="auth-layout__brand-logo">{brand.logo}</div>
        <span className="auth-spinner" aria-hidden="true" />
        <p className="paragraph-small text-muted-foreground">{dictionary.postLogin.preparing}</p>
        {showSkeleton ? <span className="auth-skeleton-line" aria-hidden="true" /> : null}
      </div>
    </main>
  );
}

function PostLoginFallback() {
  const { brand, dictionary } = useAuthUi();
  return <main className="auth-post-login"><div className="auth-post-login__content"><div className="auth-layout__brand-logo">{brand.logo}</div><span className="auth-spinner" aria-hidden="true" /><p className="paragraph-small text-muted-foreground">{dictionary.postLogin.preparing}</p></div></main>;
}

export function PostLoginPage() {
  return <Suspense fallback={<PostLoginFallback />}><PostLoginContent /></Suspense>;
}
