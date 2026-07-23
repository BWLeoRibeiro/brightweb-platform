"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@brightweblabs/ui/button";
import { AuthCard, AuthHeading, AuthLayout } from "./auth-layout";
import { useAuthUi } from "./context";

function ConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dictionary } = useAuthUi();
  const d = dictionary.confirmed;
  const target = searchParams.get("target") === "app" ? "app" : "login";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(target === "app" ? "/auth/post-login" : "/login?confirmed=1");
    }, target === "app" ? 0 : 1200);
    return () => window.clearTimeout(timer);
  }, [router, target]);

  const href = target === "app" ? "/auth/post-login" : "/login?confirmed=1";
  return (
    <AuthLayout>
      <AuthCard className="text-center">
        <AuthHeading title={d.title} description={target === "app" ? d.appDescription : d.loginDescription} />
        <Button variant="link" size="link" asChild>
          <Link href={href} className="mx-auto paragraph-small font-semibold text-primary hover:text-primary/80">
            {target === "app" ? d.continue : dictionary.common.login}
          </Link>
        </Button>
      </AuthCard>
    </AuthLayout>
  );
}

function ConfirmedFallback() {
  const { dictionary } = useAuthUi();
  return <AuthLayout><AuthCard className="text-center"><AuthHeading title={dictionary.confirmed.title} description={dictionary.confirmed.redirecting} /></AuthCard></AuthLayout>;
}

export function AuthConfirmedPage() {
  return <Suspense fallback={<ConfirmedFallback />}><ConfirmedContent /></Suspense>;
}
