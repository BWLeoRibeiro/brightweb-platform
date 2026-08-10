import Link from "next/link";
import { getStarterClientConfig } from "../config/client";

export default function HomePage() {
  const config = getStarterClientConfig();
  const configuredEnvCount = config.envStatus.filter((item) => item.present).length;

  return (
    <main className="preview-page shell starter-home">
      <div className="frame">
        <section className="starter-hero">
          <div className="starter-hero-copy">
            <span className="eyebrow text-label">Platform Preview</span>
            <h1 className="title text-heading-1">Internal sandbox for {config.brand.companyName}</h1>
            <p className="lead text-body-lg">
              Use this app to try platform features locally before deciding what should ship in the generated platform scaffold.
            </p>
            <div className="actions">
              <Link href="/preview/app-shell" className="action text-body">Preview App Shell</Link>
              <Link href="/crm" className="action secondary text-body">Open CRM</Link>
              <Link href="/bootstrap" className="action secondary text-body">Open Preview Checklist</Link>
            </div>
          </div>

          <div className="starter-hero-card panel">
            <div className="panel-inner">
              <p className={`status text-label ${config.envReadiness.allReady ? "ok" : "warn"}`}>
                {config.envReadiness.allReady ? "Preview ready" : "Preview setup in progress"}
              </p>
              <div className="starter-stat-grid">
                <div>
                  <span className="stat-number text-kpi">{config.enabledModules.length}</span>
                  <p className="text-body muted">active module previews</p>
                </div>
                <div>
                  <span className="stat-number text-kpi">{configuredEnvCount}</span>
                  <p className="text-body muted">configured env keys</p>
                </div>
              </div>
              <div className="starter-hero-note">
                <strong className="text-title">How to use this app</strong>
                <p className="text-body muted">
                  Treat this as a proving ground for package work. Promote only settled behavior into the platform scaffold.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="preview-grid starter-signal-grid">
          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <p className="eyebrow text-label">Preview role</p>
              <h2 className="text-heading-3">Local integration surface</h2>
              <p className="text-body muted">Exercise shared packages and routes without editing a generated client app.</p>
              <p className="package-name text-meta">apps/platform-preview</p>
            </div>
          </article>

          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <p className="eyebrow text-label">Template ownership</p>
              <h2 className="text-heading-3">`create-bw-app` stays canonical</h2>
              <p className="text-body muted">
                Platform apps scaffold from `packages/create-bw-app/template/base`. This preview app can diverge while you test new work.
              </p>
            </div>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-inner">
            <h2 className="text-heading-3">Active module previews</h2>
            <div className="preview-grid">
              {config.enabledModules.map((moduleConfig) => (
                <article key={moduleConfig.key} className="panel preview-glass-card">
                  <div className="panel-inner">
                    <p className={`status text-label ${moduleConfig.enabled ? "ok" : "warn"}`}>{moduleConfig.placement}</p>
                    <h3 className="text-title">{moduleConfig.label}</h3>
                    <p className="text-body muted">{moduleConfig.description}</p>
                    <p className="package-name text-meta">{moduleConfig.packageName}</p>
                    {moduleConfig.playgroundHref ? (
                      <Link href={moduleConfig.playgroundHref} className="inline-link">
                        Open module playground
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="preview-grid" style={{ marginTop: 18 }}>
          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <h2 className="text-heading-3">App-shell surfaces</h2>
              <ul className="list text-body">
                {config.shellPreview.primaryNav.map((item) => (
                  <li key={item.href}>{item.label} · {item.href}</li>
                ))}
                {config.shellPreview.moduleGroups.map((group) => (
                  <li key={group.key}>
                    {group.label} · {group.children.length} item(s)
                  </li>
                ))}
                {config.shellPreview.adminNavItem ? <li>{config.shellPreview.adminNavItem.label} · {config.shellPreview.adminNavItem.href}</li> : null}
              </ul>
            </div>
          </article>

          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <h2 className="text-heading-3">Preview controls</h2>
              <ul className="list text-body">
                <li>`config/modules.ts` controls which module playgrounds are wired into the preview app.</li>
                <li>`config/env.ts` exposes readiness checks so preview routes fail fast when services are missing.</li>
                <li>`config/shell.ts` assembles the package-based app-shell registration used by preview surfaces.</li>
                <li>Update `template/base` only when a feature should ship in newly scaffolded platform apps.</li>
              </ul>
            </div>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-inner">
            <h2 className="text-heading-3">Preview environment checklist</h2>
            <div className="preview-grid">
              {config.envStatus.map((item) => (
                <article key={item.key} className="panel preview-glass-card">
                  <div className="panel-inner">
                    <p className={`status text-label ${item.present ? "ok" : "warn"}`}>{item.present ? "Configured" : "Missing"}</p>
                    <h3 className="text-title">{item.key}</h3>
                    <p className="text-body muted">{item.description}</p>
                    <p className="package-name text-meta">{item.scope} · {item.requiredFor.join(", ")}</p>
                  </div>
                </article>
                ))}
              </div>
          </div>
        </section>
      </div>
    </main>
  );
}
