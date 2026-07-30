import Link from "next/link";
import { getStarterBootstrapChecklist } from "../../config/bootstrap";

export default function BootstrapPage() {
  const checklist = getStarterBootstrapChecklist();

  return (
    <main className="preview-page shell">
      <div className="frame">
        <section className="hero">
          <span className="eyebrow text-label">Preview Bootstrap</span>
          <h1 className="title text-heading-1">Preview checklist for {checklist.client.brand.companyName}</h1>
          <p className="lead text-body-lg">
            This page turns the preview config into an operational checklist for validating the local sandbox before promoting work into the scaffold.
          </p>
          <div className="actions">
            <Link href="/" className="action text-body">Back to preview overview</Link>
            <Link href="/login" className="action secondary text-body">Open auth preview</Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <h2 className="text-heading-3">Client summary</h2>
            <div className="preview-grid">
              <article className="panel preview-glass-card">
                <div className="panel-inner">
                  <p className="status text-label ok">{checklist.client.brand.slug}</p>
                  <h3 className="text-title">{checklist.client.brand.productName}</h3>
                  <p className="text-body muted">{checklist.client.brand.tagline}</p>
                </div>
              </article>
              <article className="panel preview-glass-card">
                <div className="panel-inner">
                  <p className={`status text-label ${checklist.client.envReadiness.allReady ? "ok" : "warn"}`}>
                    {checklist.client.envReadiness.allReady ? "Ready" : "Blocked"}
                  </p>
                  <h3 className="text-title">Environment status</h3>
                  <p className="text-body muted">
                    {checklist.client.envReadiness.allReady
                      ? "All required environment keys are configured."
                      : `${checklist.client.envReadiness.missing.length} required key(s) still missing.`}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="preview-grid" style={{ marginTop: 18 }}>
          {checklist.sections.map((section) => (
            <article key={section.key} className="panel">
              <div className="panel-inner">
                <h2 className="text-heading-3">{section.title}</h2>
                <ul className="list text-body">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      <div className="check-row">
                        <span className={`check-dot ${item.done ? "done" : "pending"}`} aria-hidden="true" />
                        <div>
                          <strong className="text-title">{item.label}</strong>
                          {item.detail ? <p className="text-body muted inline-detail">{item.detail}</p> : null}
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
