import Link from "next/link";
import { getStarterBootstrapChecklist } from "../../config/bootstrap";

export default function BootstrapPage() {
  const checklist = getStarterBootstrapChecklist();

  return (
    <main className="shell">
      <div className="frame">
        <section className="hero">
          <span className="eyebrow">Preview Bootstrap</span>
          <h1 className="title">Preview checklist for {checklist.client.brand.companyName}</h1>
          <p className="lead">
            This page turns the preview config into an operational checklist for validating the local sandbox before promoting work into the scaffold.
          </p>
          <div className="actions">
            <Link href="/" className="action">Back to preview overview</Link>
            <Link href="/playground/auth" className="action secondary">Open playgrounds</Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <h2>Client summary</h2>
            <div className="grid">
              <article className="panel" style={{ background: "rgba(255,255,255,0.72)" }}>
                <div className="panel-inner">
                  <p className="status ok">{checklist.client.brand.slug}</p>
                  <h3>{checklist.client.brand.productName}</h3>
                  <p className="muted">{checklist.client.brand.tagline}</p>
                </div>
              </article>
              <article className="panel" style={{ background: "rgba(255,255,255,0.72)" }}>
                <div className="panel-inner">
                  <p className={`status ${checklist.client.envReadiness.allReady ? "ok" : "warn"}`}>
                    {checklist.client.envReadiness.allReady ? "Ready" : "Blocked"}
                  </p>
                  <h3>Environment status</h3>
                  <p className="muted">
                    {checklist.client.envReadiness.allReady
                      ? "All required environment keys are configured."
                      : `${checklist.client.envReadiness.missing.length} required key(s) still missing.`}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="grid" style={{ marginTop: 18 }}>
          {checklist.sections.map((section) => (
            <article key={section.key} className="panel">
              <div className="panel-inner">
                <h2>{section.title}</h2>
                <ul className="list">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <div className="check-row">
                        <span className={`check-dot ${item.done ? "done" : "pending"}`} aria-hidden="true" />
                        <div>
                          <strong>{item.label}</strong>
                          {item.detail ? <p className="muted inline-detail">{item.detail}</p> : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
