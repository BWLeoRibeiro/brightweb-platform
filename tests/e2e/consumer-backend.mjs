import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const cliVersion = '2.116.0';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function localUrl(value, name) {
  const url = new URL(value);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), `${name} must be local`);
  return url;
}

// Never links a project or accepts a remote URL. Docker resources have a unique
// generated ID; even failure cleanup can only stop this invocation's project.
export async function startConsumerBackend({ migrationsDirectory, appUrl }) {
  localUrl(appUrl, 'Application URL');
  const migrations = (await readdir(migrationsDirectory)).filter(file => file.endsWith('.sql'));
  assert(migrations.length > 0, 'Consumer migrations are required');
  const directory = await mkdtemp(path.join(tmpdir(), 'bw-consumer-db-'));
  const projectId = `bw-consumer-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const cli = async args => {
    try {
      return (await exec('pnpm', ['exec', 'supabase', ...args, '--workdir', directory], { cwd: root, timeout: 600_000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    } catch (error) {
      // CLI status/start output may include local credentials. Do not attach it
      // to thrown errors, CI logs, or browser artifacts.
      const diagnostic = `${error.stderr ?? ''}\n${error.stdout ?? ''}`.split('\n').filter(line => /error|failed|fatal|migration|unhealthy|invalid|already|cannot|address|does not exist|SQLSTATE|At statement/i.test(line)).slice(-12).join('\n').replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted JWT]').replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/g, '[redacted URL]').replace(/((?:key|token|password|secret)\s*[:=]\s*)\S+/gi, '$1[redacted]');
      throw new Error(`Disposable Supabase ${args[0]} failed; Docker and pinned CLI ${cliVersion} are required\n${diagnostic}`);
    }
  };
  let started = false;
  const stop = async () => {
    if (started) {
      await cli(['stop', '--project-id', projectId, '--no-backup']);
      started = false;
    }
    await rm(directory, { recursive: true, force: true });
  };
  try {
    const version = (await exec('pnpm', ['exec', 'supabase', '--version'], { cwd: root })).stdout.trim();
    assert.equal(version, cliVersion, 'Use the package-locked Supabase CLI');
    try { await exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000 }); }
    catch { throw new Error('Docker is required for real consumer integration; this suite cannot be skipped'); }
    await cli(['init']);
    const configFile = path.join(directory, 'supabase/config.toml');
    let config = await readFile(configFile, 'utf8');
    config = config.replace(/^project_id = .*/m, `project_id = "${projectId}"`);
    // Use distinct ephemeral ports without touching any developer's local stack.
    const ports = new Set();
    while (ports.size < [...config.matchAll(/^(port|shadow_port) = \d+/gm)].length) ports.add(await freePort());
    let index = 0;
    config = config.replace(/^(port|shadow_port) = \d+/gm, (line, name) => `${name} = ${[...ports][index++]}`);
    config = config.replace(/^site_url = .*/m, `site_url = ${JSON.stringify(appUrl)}`);
    config = config.replace(/^additional_redirect_urls = .*/m, `additional_redirect_urls = [${JSON.stringify(`${appUrl}/**`)}]`);
    config = config.replace(/(\[db.seed\][\s\S]*?enabled = )true/, '$1false');
    assert.match(config, /major_version = 17/, 'Consumer database must match production major version');
    await writeFile(configFile, config);
    await cp(migrationsDirectory, path.join(directory, 'supabase/migrations'), { recursive: true });
    started = true;
    await cli(['start', '--exclude', 'studio,postgres-meta,imgproxy,edge-runtime,logflare,vector,supavisor']);
    const status = JSON.parse(await cli(['status', '--output', 'json']));
    const url = localUrl(status.API_URL, 'Supabase URL').origin;
    const mailSinkUrl = localUrl(status.INBUCKET_URL ?? status.MAILPIT_URL, 'Mail sink URL').origin;
    const anonKey = status.ANON_KEY, serviceKey = status.SERVICE_ROLE_KEY;
    const publishableKey = status.PUBLISHABLE_KEY, secretKey = status.SECRET_KEY;
    assert(anonKey && serviceKey, 'Local Supabase must provide fixture client and service credentials');
    assert(publishableKey?.startsWith('sb_publishable_') && secretKey?.startsWith('sb_secret_'), 'Local Supabase must provide production-compatible application credentials');
    const sessions = new Map();
    async function request(endpoint, { method = 'GET', body, token = serviceKey } = {}) {
      const response = await fetch(`${url}${endpoint}`, {
        method,
        headers: { apikey: serviceKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if (!response.ok) {
        const failure = JSON.parse(text);
        throw new Error(`Local fixture ${method} ${endpoint.split('?')[0]} failed (${response.status}, ${failure.code ?? 'unknown'}): ${failure.message ?? 'request rejected'}`);
      }
      return text ? JSON.parse(text) : null;
    }
    const [topic] = await request('/rest/v1/marketing_topics?on_conflict=slug', { method: 'POST', body: { slug: 'novidades', label: 'Novidades', is_active: true } });
    return {
      url, anonKey, serviceKey, publishableKey, secretKey, topicId: topic.id, mailSinkUrl,
      async sendMagicLink({ email }) {
        assert(email.endsWith('@example.invalid'), 'Only synthetic fixture identities are permitted');
        const response = await fetch(`${url}/auth/v1/otp`, {
          method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, create_user: false }), signal: AbortSignal.timeout(30_000),
        });
        assert(response.ok, `Local GoTrue email request failed (${response.status})`);
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const inbox = await fetch(`${mailSinkUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { signal: AbortSignal.timeout(5000) });
          assert(inbox.ok, `Local mail sink request failed (${inbox.status})`);
          const result = await inbox.json();
          const message = result.messages?.find(message => message.To?.some(recipient => recipient.Address === email));
          if (message) return { delivered: true, recipient: email, messageId: message.ID, mailSinkOrigin: mailSinkUrl };
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Local auth email did not reach the synthetic mail sink');
      },
      async createUser({ email, password, role = 'admin' }) {
        assert(email.endsWith('@example.invalid'), 'Only synthetic fixture identities are permitted');
        assert(['admin', 'staff', 'client'].includes(role));
        const user = await request('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
        const profiles = await request(`/rest/v1/profiles?user_id=eq.${user.id}&select=id`);
        assert.equal(profiles.length, 1, 'Auth trigger must create exactly one profile');
        await request('/rest/v1/user_role_assignments?on_conflict=profile_id', { method: 'POST', body: { profile_id: profiles[0].id, role_code: role } });
        const session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
        assert(session.access_token, 'Synthetic user must be able to sign in');
        sessions.set(profiles[0].id, session.access_token);
        return { id: user.id, profileId: profiles[0].id, email, password };
      },
      async createInvitation({ email, role = 'staff', inviterProfileId = null }) {
        assert(email.endsWith('@example.invalid'), 'Only synthetic fixture identities are permitted');
        assert(['staff', 'client'].includes(role));
        const invitationId = randomUUID();
        await request('/rest/v1/admin_user_invitations', { method: 'POST', body: { id: invitationId, invited_email: email, role_code: role, invited_by_profile_id: inviterProfileId, expires_at: new Date(Date.now() + 86_400_000).toISOString() } });
        // Generate a local auth token without sending mail. The browser exercises
        // the real callback and post-login acceptance against the application.
        const link = await request('/auth/v1/admin/generate_link', { method: 'POST', body: { type: 'magiclink', email } });
        const tokenHash = link.hashed_token ?? link.properties?.hashed_token;
        assert(tokenHash, 'GoTrue must produce a verification token');
        const acceptance = new URL('/auth/callback', appUrl);
        acceptance.searchParams.set('token_hash', tokenHash);
        acceptance.searchParams.set('type', 'magiclink');
        acceptance.searchParams.set('next', `/auth/post-login?invitationId=${invitationId}&invitationKind=admin`);
        return {
          invitationId, acceptanceUrl: acceptance.toString(), type: 'admin',
          async state() {
            const [invitation] = await request(`/rest/v1/admin_user_invitations?id=eq.${invitationId}&select=status,accepted_by_profile_id`);
            const [profile] = await request(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`);
            const [assignment] = await request(`/rest/v1/user_role_assignments?profile_id=eq.${profile.id}&select=role_code`);
            return { status: invitation.status, acceptedByProfileId: invitation.accepted_by_profile_id, role: assignment?.role_code ?? null };
          },
        };
      },
      async createProject({ profileId }) {
        const organizationId = randomUUID(), taskId = randomUUID();
        const token = sessions.get(profileId);
        assert(token, 'Project actor must be a seeded local user');
        const projectName = 'Consumer regression project', taskTitle = 'Consumer regression task';
        await request('/rest/v1/organizations', { method: 'POST', body: { id: organizationId, name: 'Consumer regression organization' } });
        const created = await request('/rest/v1/rpc/create_project_with_client_access', { method: 'POST', token, body: { p_request_id: randomUUID(), p_project: { primary_organization_id: organizationId, name: projectName }, p_organization_ids: [organizationId], p_members: [{ profile_id: profileId, role: 'owner' }], p_client_access: { mode: 'hidden', organization_ids: [] } } });
        const projectId = created[0].project_id;
        await request('/rest/v1/project_tasks', { method: 'POST', body: { id: taskId, project_id: projectId, title: taskTitle, assignee_profile_id: profileId } });
        return { organizationId, projectId, taskId, projectName, taskTitle };
      },
      stop,
    };
  } catch (error) {
    try { await stop(); } catch { throw new AggregateError([error], `Consumer setup failed and cleanup failed for disposable project ${projectId}`); }
    throw error;
  }
}
