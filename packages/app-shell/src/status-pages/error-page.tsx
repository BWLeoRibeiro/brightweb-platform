"use client";

import { useEffect } from "react";
import { Button } from "@brightweblabs/ui";

import {
  defaultAppShellStatusPagesDictionary,
  type AppShellStatusPagesDictionary,
} from "./dictionary";

export type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
  dictionary?: AppShellStatusPagesDictionary;
  backHref?: string;
  backLabel?: string;
};

export function ErrorPage({
  error,
  reset,
  dictionary = defaultAppShellStatusPagesDictionary,
  backHref = "/",
  backLabel,
}: ErrorPageProps) {
  useEffect(() => {
    console.error("Portal app error:", error);
  }, [error]);

  return (
    <section className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-6 py-20 text-center">
      <div className="max-w-xl">
        <p className="label text-[var(--mq-brand-400)]">{dictionary.error.label}</p>
        <h1 className="heading-2 mt-4">
          {dictionary.error.heading}<span className="text-accent">.</span>
        </h1>
        <p className="paragraph mt-4 text-muted-foreground">
          {dictionary.error.description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>{dictionary.error.retryLabel}</Button>
          <Button href={backHref} variant="outline">
            {backLabel ?? dictionary.error.backLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
