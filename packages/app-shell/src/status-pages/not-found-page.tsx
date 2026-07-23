import type { ReactNode } from "react";
import { Button } from "@brightweblabs/ui";

import {
  defaultAppShellStatusPagesDictionary,
  type AppShellStatusPagesDictionary,
} from "./dictionary";

export type NotFoundPageProps = {
  brandLogo?: ReactNode;
  dictionary?: AppShellStatusPagesDictionary;
  footerBackHref?: string;
  footerBackLabel?: string;
};

export function NotFoundPage({
  brandLogo,
  dictionary = defaultAppShellStatusPagesDictionary,
  footerBackHref = "/",
  footerBackLabel,
}: NotFoundPageProps) {
  return (
    <main className="min-h-dvh bg-[var(--page-background)] text-foreground">
      {brandLogo ? (
        <div className="flex h-[4.5rem] items-center px-6">
          {brandLogo}
        </div>
      ) : null}
      <section
        className={`flex items-center justify-center px-6 py-20 text-center ${
          brandLogo ? "min-h-[calc(100dvh-4.5rem)]" : "min-h-dvh"
        }`}
      >
        <div className="max-w-[36rem]">
          <p className="label text-[var(--mq-brand-400)]">{dictionary.notFound.label}</p>
          <h1 className="heading-2 mt-4">
            {dictionary.notFound.heading}<span className="text-accent">.</span>
          </h1>
          <p className="paragraph mt-4 text-muted-foreground">
            {dictionary.notFound.description}
          </p>
          <div className="mt-8 flex justify-center">
            <Button href={footerBackHref}>
              {footerBackLabel ?? dictionary.notFound.backLabel}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
