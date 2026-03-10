export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export default async function ProjectsPlaygroundPage() {
  try {
    const { getProjectsPortfolioPageData } = await import("@brightweb/module-projects");
    const data = await getProjectsPortfolioPageData();

    return (
      <>
        <article className="panel">
          <div className="panel-inner">
            <p className="eyebrow">Projects Module</p>
            <h1>Projects portfolio playground</h1>
            <p className="muted">
              This route calls the external `@brightweb/module-projects` package directly and shows a thin portfolio
              snapshot for a starter client.
            </p>
          </div>
        </article>

        <article className="grid">
          <div className="panel">
            <div className="panel-inner">
              <p className={`status ${data.schemaMissing ? "warn" : "ok"}`}>{data.schemaMissing ? "Schema missing" : "Connected"}</p>
              <h2>Portfolio snapshot</h2>
              <ul className="list">
                <li>Total open projects: {data.portfolioStats.total}</li>
                <li>At risk: {data.portfolioStats.atRisk}</li>
                <li>Overdue: {data.portfolioStats.overdue}</li>
                <li>Organizations loaded: {data.organizationOptions.length}</li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-inner">
              <h2>Status distribution</h2>
              <div className="code-box">
                <pre>{JSON.stringify(data.portfolioStats, null, 2)}</pre>
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner">
            <h2>First project records</h2>
            <div className="code-box">
              <pre>{JSON.stringify(data.result.items.slice(0, 3), null, 2)}</pre>
            </div>
          </div>
        </article>
      </>
    );
  } catch (error) {
    return (
      <>
        <article className="panel">
          <div className="panel-inner">
            <p className="eyebrow">Projects Module</p>
            <h1>Projects portfolio playground</h1>
            <p className="muted">
              The package is wired, but this starter app still needs the client project infrastructure configured.
            </p>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner stack">
            <p className="status warn">Configuration required</p>
            <div className="result-box">
              <strong>Current error</strong>
              <p>{formatError(error)}</p>
            </div>
            <ul className="list">
              <li>Set the Supabase public URL and anon key.</li>
              <li>Set the Supabase service role key for server access.</li>
              <li>Ensure the projects schema exists in the target client database.</li>
            </ul>
          </div>
        </article>
      </>
    );
  }
}
