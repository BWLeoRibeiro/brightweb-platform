import { ArrowRight, Layers3, MoveRight, Sparkles, SwatchBook, Waypoints } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const pillars = [
  {
    icon: Sparkles,
    title: "Branded by default",
    description: "Start from an editorial Tailwind baseline with deliberate type, spacing, and color tokens instead of a blank utility sandbox.",
  },
  {
    icon: Layers3,
    title: "Shadcn-compatible local UI",
    description: "The starter ships with local component primitives so the site stays easy to customize without coupling itself to the heavier platform stack.",
  },
  {
    icon: SwatchBook,
    title: "Token-ready structure",
    description: "Global variables, semantic color names, and a clean `config/site.ts` entrypoint make rebranding straightforward from day one.",
  },
];

const processSteps = [
  "Define the voice in `config/site.ts` and tune the hero copy.",
  "Refine the palette and typography in `app/globals.css`.",
  "Add sections or import new shadcn components as the site grows.",
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="mb-14 flex items-center justify-between gap-6 border-b border-[color:var(--border)] pb-6">
          <div>
            <p className="font-display text-2xl tracking-[-0.03em]">{siteConfig.name}</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">{siteConfig.eyebrow}</p>
          </div>
          <Badge variant="accent">Next.js + Tailwind</Badge>
        </header>

        <div className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:items-center">
          <section className="relative">
            <div className="absolute -left-6 top-4 hidden h-24 w-24 rounded-full border border-[color:var(--border)] bg-white/35 blur-3xl sm:block" />
            <Badge className="mb-5" variant="default">
              Distinctive site scaffold
            </Badge>
            <h1 className="max-w-4xl font-display text-[clamp(3.75rem,10vw,8.5rem)] leading-[0.88] tracking-[-0.06em] text-[color:var(--foreground)]">
              Build the first version with taste, not just tooling.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted-foreground)] sm:text-xl">
              {siteConfig.description} The starter is tuned for brand sites, launch pages, and polished marketing surfaces
              that need a strong visual point of view from the start.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={siteConfig.primaryCta.href} size="lg">
                {siteConfig.primaryCta.label}
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href={siteConfig.secondaryCta.href} size="lg" variant="secondary">
                {siteConfig.secondaryCta.label}
              </ButtonLink>
            </div>

            <div className="mt-12 grid gap-4 border-t border-[color:var(--border)] pt-6 sm:grid-cols-3">
              {[
                ["01", "Type-led landing page"],
                ["02", "Tailwind v4 tokens"],
                ["03", "Ready for local components"],
              ].map(([index, label]) => (
                <div key={index}>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">{index}</p>
                  <p className="mt-2 max-w-[14rem] text-sm leading-6 text-[color:var(--muted-foreground)]">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <Card className="rotate-[-1.5deg] bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,241,232,0.72))]">
              <CardContent>
                <p className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                  Starter composition
                </p>
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-[color:var(--border)] bg-white/70 p-4">
                    <p className="text-sm text-[color:var(--muted-foreground)]">Hero language</p>
                    <p className="mt-2 font-display text-3xl tracking-[-0.04em]">Editorial, warm, and high-contrast.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-[color:var(--border)] bg-white/65 p-4">
                      <Waypoints className="mb-4 size-5 text-[color:var(--accent)]" />
                      <p className="text-sm text-[color:var(--muted-foreground)]">Flexible sections</p>
                    </div>
                    <div className="rounded-[24px] border border-[color:var(--border)] bg-white/65 p-4">
                      <MoveRight className="mb-4 size-5 text-[color:var(--accent)]" />
                      <p className="text-sm text-[color:var(--muted-foreground)]">Immediate polish</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="translate-x-4 bg-[rgba(35,32,28,0.94)] text-white">
              <CardContent>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Why this exists</p>
                <p className="mt-4 font-display text-3xl tracking-[-0.04em]">
                  A lighter path than the platform app, without giving up design discipline.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-10 sm:px-10 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title}>
                <CardContent>
                  <Icon className="mb-5 size-5 text-[color:var(--accent)]" />
                  <CardTitle>{pillar.title}</CardTitle>
                  <CardDescription className="mt-3">{pillar.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="process" className="mx-auto w-full max-w-7xl px-6 pb-20 sm:px-10 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="bg-[rgba(255,255,255,0.64)]">
            <CardContent>
              <Badge variant="accent">Three quick passes</Badge>
              <CardTitle className="mt-5 text-[clamp(2rem,4vw,3.4rem)]">Tune the voice, then ship.</CardTitle>
              <CardDescription className="mt-4 max-w-xl text-base">
                The starter gives you structure, not bureaucracy. Rename the site, adjust the tone, and keep moving.
              </CardDescription>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {processSteps.map((step, index) => (
              <Card key={step} className="bg-white/70">
                <CardContent className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] font-semibold text-[color:var(--accent)]">
                    {index + 1}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{step}</CardTitle>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
