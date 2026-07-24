import type { ReactNode } from "react";
import { Button } from "@brightweblabs/ui";
import type { ShellBrand } from "../types";

import {
  defaultAppShellStatusPagesDictionary,
  type AppShellStatusPagesDictionary,
} from "./dictionary";

export type NotFoundPageProps = {
  brand?: ShellBrand;
  brandLogo?: ReactNode;
  dictionary?: AppShellStatusPagesDictionary;
  footerBackHref?: string;
  footerBackLabel?: string;
};

export function NotFoundPage({
  brand,
  brandLogo,
  dictionary = defaultAppShellStatusPagesDictionary,
  footerBackHref = "/",
  footerBackLabel,
}: NotFoundPageProps) {
  const configuredBrandLogo = brand ? (
    <a href={brand.href} aria-label={brand.ariaLabel}>
      <img
        src={(brand.statusPageLogo?.light ?? brand.collapsedLogo).src}
        alt=""
        width={(brand.statusPageLogo?.light ?? brand.collapsedLogo).width}
        height={(brand.statusPageLogo?.light ?? brand.collapsedLogo).height}
        className="h-12 w-auto object-contain dark:hidden"
      />
      <img
        src={(brand.statusPageLogo?.dark ?? brand.collapsedLogo).src}
        alt=""
        width={(brand.statusPageLogo?.dark ?? brand.collapsedLogo).width}
        height={(brand.statusPageLogo?.dark ?? brand.collapsedLogo).height}
        className="hidden h-12 w-auto object-contain dark:block"
      />
    </a>
  ) : null;
  const resolvedBrandLogo = brandLogo !== undefined ? brandLogo : configuredBrandLogo;

  return (
    <main className="min-h-dvh bg-[var(--page-background)] text-foreground">
      {resolvedBrandLogo ? (
        <div className="flex h-[4.5rem] items-center px-6">
          {resolvedBrandLogo}
        </div>
      ) : null}
      <section
        className={`flex items-center justify-center px-6 py-20 text-center ${
          resolvedBrandLogo ? "min-h-[calc(100dvh-4.5rem)]" : "min-h-dvh"
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
