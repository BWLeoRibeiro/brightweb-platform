export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export default async function CrmPlaygroundPage() {
  try {
    const { getCrmDashboardData } = await import("@brightweb/module-crm");
    const data = await getCrmDashboardData();

    return (
      <>
        <article className="panel">
          <div className="panel-inner">
            <p className="eyebrow">CRM Module</p>
            <h1>CRM server/data playground</h1>
            <p className="muted">
              This route calls the external `@brightweb/module-crm` package directly and shows a thin data summary.
            </p>
          </div>
        </article>

        <article className="grid">
          <div className="panel">
            <div className="panel-inner">
              <p className="status ok">Connected</p>
              <h2>Snapshot</h2>
              <ul className="list">
                <li>Total contacts: {data.stats.total}</li>
                <li>Organizations loaded: {data.organizations.length}</li>
                <li>Timeline events: {data.statusLog.length}</li>
                <li>Owner options: {data.ownerOptions.length}</li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-inner">
              <h2>Statuses</h2>
              <div className="code-box">
                <pre>{JSON.stringify(data.stats.byStatus, null, 2)}</pre>
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner">
            <h2>First records</h2>
            <div className="code-box">
              <pre>
                {JSON.stringify(
                  {
                    organizations: data.organizations.slice(0, 2),
                    contacts: data.contacts.slice(0, 3),
                    statusLog: data.statusLog.slice(0, 3),
                  },
                  null,
                  2,
                )}
              </pre>
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
            <p className="eyebrow">CRM Module</p>
            <h1>CRM server/data playground</h1>
            <p className="muted">
              The package is wired, but this sandbox still needs valid environment variables and database access.
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
              <li>Set `NEXT_PUBLIC_APP_URL`.</li>
              <li>Set `NEXT_PUBLIC_SUPABASE_URL`.</li>
              <li>Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`.</li>
              <li>If you need CRM writes or email flows, also set the server-only keys in the platform repo.</li>
            </ul>
          </div>
        </article>
      </>
    );
  }
}
