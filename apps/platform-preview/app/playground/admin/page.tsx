export const dynamic = "force-dynamic";

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export default async function AdminPlaygroundPage() {
  try {
    const { getAdminUsersPageData } = await import("@brightweblabs/module-admin");
    const { users } = await getAdminUsersPageData();

    return (
      <>
        <article className="panel">
          <div className="panel-inner">
            <p className="eyebrow">Admin Module</p>
            <h1>Admin users and roles playground</h1>
            <p className="muted">
              This route previews the shared admin governance module without relying on the BeGreen client app.
            </p>
          </div>
        </article>

        <article className="grid">
          <div className="panel">
            <div className="panel-inner">
              <p className="status ok">Connected</p>
              <h2>User governance snapshot</h2>
              <ul className="list">
                <li>Total users in page: {users.data.length}</li>
                <li>Total users overall: {users.pagination.total}</li>
                <li>Current page: {users.pagination.page}</li>
                <li>Total pages: {users.pagination.totalPages}</li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-inner">
              <h2>Role mix</h2>
              <div className="code-box">
                <pre>
                  {JSON.stringify(
                    users.data.reduce<Record<string, number>>((acc, row) => {
                      acc[row.role] = (acc[row.role] ?? 0) + 1;
                      return acc;
                    }, {}),
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner">
            <h2>First admin users</h2>
            <div className="code-box">
              <pre>{JSON.stringify(users.data.slice(0, 5), null, 2)}</pre>
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
            <p className="eyebrow">Admin Module</p>
            <h1>Admin users and roles playground</h1>
            <p className="muted">
              The admin package is wired, but this preview app still needs a configured client database and admin-ready
              auth environment.
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
              <li>Set the Supabase service role key.</li>
              <li>Ensure the client database includes the admin role assignment tables and RPCs.</li>
            </ul>
          </div>
        </article>
      </>
    );
  }
}
