import assert from 'node:assert/strict';
import test from 'node:test';
import { getCrmReportData } from '../packages/module-crm/src/data.ts';
import { getProjectDashboard, listProjectTasks, listProjectMilestones, listProjects, getProjectPortfolioStats } from '../packages/module-projects/src/server.ts';
import { fetchAllRows, listProjects as dataList, getProjectPortfolioStats as dataStats } from '../packages/module-projects/src/data.ts';
import { validateTaskDraft } from '../packages/module-projects/src/ui/task-form.ts';

function reportClient(contacts: number, organizations: number, options: { cap?: number; count?: boolean; failAfter?: number; truncateAt?: number; changeCount?: boolean; duplicate?: boolean } = {}) {
  const ranges: unknown[][] = [];
  return { ranges, from(table: string) {
    let start = 0, end = 0;
    const size = ['crm_contacts', 'project_tasks'].includes(table) ? contacts : ['organizations', 'project_milestones'].includes(table) ? organizations : 0;
    const query: any = new Proxy({}, { get(_target, key) {
      if (key === 'then') return (resolve: any) => {
        if (table === 'crm_contacts' && options.failAfter != null && start >= options.failAfter) return resolve({ data: null, error: { message: 'late page unavailable' } });
        const length = Math.max(0, Math.min(size - start, end - start + 1, options.cap ?? 1000, (options.truncateAt ?? Infinity) - start));
        const data = Array.from({ length }, (_, index) => ({ id: `${table}-${options.duplicate && start > 0 ? index : start + index}`, status: 'lead', source: null, owner_id: null, organization_id: null, name: 'Organization' }));
        resolve({ data, error: null, count: options.count === false ? null : size + (options.changeCount && start > 0 ? 1 : 0) });
      };
      return (...args: any[]) => { if (key === 'range') { [start, end] = args; ranges.push([table, start, end]); } return query; };
    } });
    return query;
  } } as any;
}

test('CRM reports read every capped contact and organization page', async () => {
  const client = reportClient(1200, 1100, { cap: 300 });
  const report = await getCrmReportData(client);
  assert.equal(report.summary.totalContacts, 1200);
  assert.equal(report.organizationCoverage.totalOrganizations, 1100);
  assert.equal(report.byStatus.find(row => row.status === 'lead')?.count, 1200);
  assert.ok(client.ranges.some((row: any[]) => row[0] === 'crm_contacts' && row[1] === 900));
});
test('CRM reports tolerate absent counts and read through short capped pages', async () => {
  const report = await getCrmReportData(reportClient(1200, 0, { cap: 100, count: false }));
  assert.equal(report.summary.totalContacts, 1200);
});
test('CRM report retains the 5000 record boundary and empty result', async () => {
  assert.equal((await getCrmReportData(reportClient(5000, 0))).summary.totalContacts, 5000);
  assert.equal((await getCrmReportData(reportClient(0, 0))).summary.totalContacts, 0);
  await assert.rejects(getCrmReportData(reportClient(5001, 0)), /CRM_REPORT_TOO_LARGE/);
  await assert.rejects(getCrmReportData(reportClient(0, 5001)), /CRM_REPORT_TOO_LARGE/);
  await assert.rejects(getCrmReportData(reportClient(5001, 0, { count: false })), /CRM_REPORT_TOO_LARGE/);
});
test('CRM report never returns partial success on later-page failure or premature exhaustion', async () => {
  await assert.rejects(getCrmReportData(reportClient(1200, 0, { failAfter: 1000 })), /late page unavailable/);
  await assert.rejects(getCrmReportData(reportClient(1200, 0, { truncateAt: 1000 })), /CRM_REPORT_INCOMPLETE/);
});

function projectClient(failure?: string) {
  const calls: any[][] = [];
  return { calls, from(table: string) {
    let columns = '';
    const query: any = new Proxy({}, { get(_target, key) {
      if (key === 'then') return (resolve: any) => resolve({ data: [], count: 0, error: failure && (failure !== 'column profiles.phone does not exist' || columns.includes('phone')) ? { message: failure } : null });
      return (...args: any[]) => { calls.push([table, key, ...args]); if (key === 'select') { columns = args[0]; } return query; };
    } });
    return query;
  } } as any;
}
test('public and HTTP Projects queries share attention filtering, ordering and pagination', async () => {
  assert.equal(listProjects, dataList);
  assert.equal(getProjectPortfolioStats, dataStats);
  const client = projectClient();
  const result = await listProjects(client, { page: 2, pageSize: 10, dashboardAttention: { dueThrough: '2026-09-10', includeProjectIds: ['invalid', '00000000-0000-0000-0000-000000000001'] } });
  assert.equal(result.page, 2);
  assert.ok(client.calls.some((call: any[]) => call[1] === 'range' && call[2] === 10 && call[3] === 19));
  assert.ok(client.calls.some((call: any[]) => call[1] === 'order' && call[2] === 'target_date' && call[3].nullsFirst === false));
  const attention = client.calls.find((call: any[]) => call[1] === 'or')[2];
  for (const criterion of ['target_date.lte.2026-09-10', 'health.in.(at_risk,off_track)', 'status.eq.blocked', 'owner_profile_id.is.null', '00000000-0000-0000-0000-000000000001']) assert.ok(attention.includes(criterion));
  assert.ok(!attention.includes('invalid'));
  assert.ok(client.calls.some((call: any[]) => call[1] === 'not' && call[2] === 'status'));
});
test('all status remains unrestricted and recoverable phone schemas retry; real errors propagate', async () => {
  const client = projectClient('column profiles.phone does not exist');
  await listProjects(client, { status: 'all' });
  assert.equal(client.calls.filter((call: any[]) => call[1] === 'select').length, 2);
  assert.ok(!client.calls.some((call: any[]) => call[1] === 'not' && call[2] === 'status'));
  assert.ok(client.calls.some((call: any[]) => call[1] === 'order' && call[2] === 'updated_at'));
  await assert.rejects(listProjects(projectClient('permission denied'), {}), /permission denied/);
});
const draft = { projectId: 'project', title: '  Task  ', status: 'todo', blockedReason: '', startDate: '', dueDate: '' };
test('both task entry points normalize title and reject blank blocked reasons and reversed dates', () => {
  assert.equal(validateTaskDraft(draft).input.title, 'Task');
  assert.equal(validateTaskDraft({ ...draft, title: '  ' }).valid, false);
  assert.equal(validateTaskDraft({ ...draft, projectId: '' }).valid, false);
  assert.equal(validateTaskDraft({ ...draft, status: 'blocked', blockedReason: '  ' }).valid, false);
  assert.equal(validateTaskDraft({ ...draft, startDate: '2026-09-10', dueDate: '2026-09-09' }).valid, false);
  assert.equal(validateTaskDraft({ ...draft, startDate: '2026-09-10', dueDate: '2026-09-10' }).valid, true);
  assert.equal(validateTaskDraft({ ...draft, status: 'blocked', blockedReason: ' waiting ' }).input.blockedReason, 'waiting');
  assert.equal(validateTaskDraft({ ...draft, blockedReason: 'old hidden reason' }).input.blockedReason, undefined);
});

test('public portfolio statistics preserve aggregate values and propagate failures', async () => {
  assert.deepEqual(await getProjectPortfolioStats(projectClient()), { total: 0, planned: 0, active: 0, atRisk: 0, overdue: 0 });
  await assert.rejects(getProjectPortfolioStats(projectClient('stats denied')), /stats denied/);
});

test('CRM rejects changing counts and repeated rows between pages', async () => {
  await assert.rejects(getCrmReportData(reportClient(1200, 0, { changeCount: true })), /CHANGED_DURING_READ/);
  await assert.rejects(getCrmReportData(reportClient(1200, 0, { duplicate: true })), /CHANGED_DURING_READ/);
});
test('project task and milestone lists return all capped rows and reject incomplete collections', async () => {
  const client = reportClient(1200, 1100, { cap: 100 });
  assert.equal((await listProjectTasks(client, 'project')).length, 1200);
  assert.equal((await listProjectMilestones(client, 'project')).length, 1100);
  assert.equal((await listProjectTasks(reportClient(0, 0), 'project')).length, 0);
  await assert.rejects(listProjectTasks(reportClient(10001, 0), 'project'), /TOO_LARGE/);
  await assert.rejects(listProjectTasks(reportClient(1200, 0, { truncateAt: 1000 }), 'project'), /INCOMPLETE/);
  await assert.rejects(listProjectTasks(reportClient(1200, 0, { duplicate: true }), 'project'), /CHANGED_DURING_READ/);
});
test('collection helper reads unknown-count short pages and never returns data on failure', async () => {
  const rows = Array.from({ length: 12 }, (_, id) => ({id: String(id)}));
  assert.deepEqual(await fetchAllRows(async from => ({data: rows.slice(from, from + 3), error: null})), {data: rows, error: null});
  assert.deepEqual(await fetchAllRows(async from => from === 0 ? {data: rows.slice(0, 3), error: null} : {data: null, error: {message: 'later failure'}}), {data: [], error: {message: 'later failure'}});
  assert.match((await fetchAllRows(async from => ({data: rows.slice(from, from+3), error: null, count: from ? 13 : 12}))).error?.message ?? '', /CHANGED/);
  assert.match((await fetchAllRows(async () => ({data: Array.from({length: 1000}, () => ({})), error: null}))).error?.message ?? '', /TOO_LARGE/);
});

test('project detail uses shared aggregate task statistics and propagates aggregate failure', async () => {
  const client = (fail: boolean): any => ({
    rpc: async () => ({data: {}, error: null}),
    from(table: string) {
      const query: any = new Proxy({}, {get(_target, key) {
        if (key === 'then') return (resolve: any) => resolve({
          data: table === 'projects' ? {id:'project',organization_id:'org',name:'Project',status:'active',health:'on_track',owner_profile_id:null} : table === 'project_task_stats' ? [{project_id:'project',total:1200,done:400,blocked:2,overdue:3}] : [],
          count:0, error: fail && table === 'project_task_stats' ? {message:'aggregate denied'} : null,
        });
        return () => query;
      }});return query;
    },
  });
  const result = await getProjectDashboard(client(false), 'project');
  assert.deepEqual(result.project.taskStats, {total:1200,done:400,blocked:2,overdue:3});
  await assert.rejects(getProjectDashboard(client(true), 'project'), /aggregate denied/);
});
