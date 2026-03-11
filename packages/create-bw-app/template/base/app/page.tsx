import Link from "next/link";
import { getStarterClientConfig } from "../config/client";

export default function HomePage() {
  const config = getStarterClientConfig();

  return (
    <main className="shell starter-home">
      <div className="frame">
        <section className="starter-hero">
          <div className="starter-hero-copy">
            <span className="eyebrow">{config.brand.companyName}</span>
            <h1 className="title">{config.brand.productName}</h1>
            <p className="lead">{config.brand.tagline}</p>
            <div className="actions">
              <Link href="/preview/app-shell" className="action">Preview App Shell</Link>
              <Link href="/bootstrap" className="action secondary">Open Bootstrap Checklist</Link>
              <Link href="/playground/auth" className="action secondary">Open Module Playgrounds</Link>
            </div>
          </div>

          <div className="starter-hero-card panel">
            <div className="panel-inner">
              <p className={`status ${config.envReadiness.allReady ? "ok" : "warn"}`}>
                {config.envReadiness.allReady ? "Starter ready" : "Setup in progress"}
              </p>
              <div className="starter-stat-grid">
                <div>
                  <span className="stat-number">{config.enabledModules.length}</span>
                  <p className="muted">enabled modules</p>
                </div>
                <div>
                  <span className="stat-number">{config.envStatus.filter((item) => item.present).length}</span>
                  <p className="muted">configured env keys</p>
                </div>
              </div>
              <div className="starter-hero-note">
                <strong>What this template gives you</strong>
                <p className="muted">
                  One place to brand, provision, preview, and validate a new client before the first deployment.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid starter-signal-grid">
          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <p className="eyebrow">Brand</p>
              <h2>{config.brand.companyName}</h2>
              <p className="muted">{config.brand.contactEmail} · {config.brand.supportEmail}</p>
              <p className="package-name">{config.brand.slug}</p>
            </div>
          </article>

          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <p className="eyebrow">Infrastructure</p>
              <h2>{config.envReadiness.allReady ? "Ready to validate" : "Needs provisioning"}</h2>
              <p className="muted">
                {config.envReadiness.allReady
                  ? "Core env and service wiring are present."
                  : `${config.envReadiness.missing.length} required environment key(s) are still missing.`}
              </p>
            </div>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-inner">
            <h2>Enabled platform modules</h2>
            <div className="grid">
              {config.enabledModules.map((moduleConfig) => (
                <article key={moduleConfig.key} className="panel preview-glass-card" style={{ background: "rgba(255,255,255,0.72)" }}>
                  <div className="panel-inner">
                    <p className={`status ${moduleConfig.enabled ? "ok" : "warn"}`}>{moduleConfig.placement}</p>
                    <h3>{moduleConfig.label}</h3>
                    <p className="muted">{moduleConfig.description}</p>
                    <p className="package-name">{moduleConfig.packageName}</p>
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

        <section className="grid" style={{ marginTop: 18 }}>
          <article className="panel preview-glass-card">
            <div className="panel-inner">
              <h2>App-shell surfaces</h2>
              <ul className="list">
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
              <h2>Starter controls</h2>
              <ul className="list">
                <li>`config/brand.ts` for client identity and contact details.</li>
                <li>`config/modules.ts` for enabled platform modules.</li>
                <li>`config/env.ts` for infra requirements and readiness checks.</li>
                <li>`.env.local` from `.env.example` for per-client secrets and flags.</li>
              </ul>
            </div>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-inner">
            <h2>Infrastructure checklist</h2>
            <div className="grid">
              {config.envStatus.map((item) => (
                <article key={item.key} className="panel preview-glass-card" style={{ background: "rgba(255,255,255,0.72)" }}>
                  <div className="panel-inner">
                    <p className={`status ${item.present ? "ok" : "warn"}`}>{item.present ? "Configured" : "Missing"}</p>
                    <h3>{item.key}</h3>
                    <p className="muted">{item.description}</p>
                    <p className="package-name">{item.scope} · {item.requiredFor.join(", ")}</p>
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
