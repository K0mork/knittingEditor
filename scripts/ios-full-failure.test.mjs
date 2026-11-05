// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ISSUE_LABELS,
  ISSUE_TITLE,
  createGitHub,
  decideAction,
  failedTests,
  findRecurring,
  handleFailure,
  issueBody,
} from './ios-full-failure.mjs';

const prefix = 'app_update (iPhone 17)\tSimulate app update and restore IndexedDB\t2026-11-04T12:24:06.1786300Z ';
const seedProbe = 'KnittingEditorUITests/testSeedDocumentForAppUpdateProbe';
const backupGuide = 'KnittingEditorUITests/testBlockSaveAndFullBackupRestoreFollowGuide';

const seedProbeLog = [
  `${prefix}Test Case '-[knittingEditorUITests.KnittingEditorUITests testSeedDocumentForAppUpdateProbe]' started (Iteration 1 of 2).`,
  `${prefix}Test Case '-[knittingEditorUITests.KnittingEditorUITests testSeedDocumentForAppUpdateProbe]' exceeded execution time allowance of 3 minutes. The test may have hung.`,
  `${prefix}Test Case '-[knittingEditorUITests.KnittingEditorUITests testSeedDocumentForAppUpdateProbe]' passed (209.123 seconds).`,
  `${prefix}Failing tests:`,
].join('\n');
const backupGuideLog = [
  `${prefix}  if grep -Eq "Test Case '.*' failed \\(" "$RUNNER_TEMP/ios-tests.log"; then`,
  `${prefix}Test Case '-[knittingEditorUITests.KnittingEditorUITests testBlockSaveAndFullBackupRestoreFollowGuide]' failed (256.410 seconds).`,
  `${prefix}Test Case '-[knittingEditorUITests.KnittingEditorUITests testBlockSaveAndFullBackupRestoreFollowGuide]' failed (240.002 seconds).`,
  `${prefix}Test Case '-[knittingEditorUITests.KnittingEditorUITests testOther]' passed (12.000 seconds).`,
].join('\n');

describe('failedTests', () => {
  it('collects tests that failed or exceeded the time allowance, as Class/method', () => {
    expect(failedTests(seedProbeLog)).toEqual([seedProbe]);
    expect(failedTests(backupGuideLog)).toEqual([backupGuide]);
  });

  it('reads unit tests and tests without a module prefix, and sorts them', () => {
    const log = [
      "Test Case '-[knittingEditorTests.LocalWebSchemeHandlerTests testGuideDirectoryURLLoadsBundledIndex]' failed (37.800 seconds).",
      "Test Case '-[AppTests testA]' failed (1.000 seconds).",
    ].join('\n');
    expect(failedTests(log)).toEqual(['AppTests/testA', 'LocalWebSchemeHandlerTests/testGuideDirectoryURLLoadsBundledIndex']);
  });

  it('returns nothing for a failure outside the tests', () => {
    expect(failedTests('xcodebuild: error: Unable to find a device matching the provided destination specifier')).toEqual([]);
  });
});

describe('findRecurring', () => {
  it('lists each failed test with the earlier runs it also failed in', () => {
    const previousRuns = [
      { url: 'run/1', tests: [backupGuide] },
      { url: 'run/2', tests: [seedProbe, backupGuide] },
    ];
    expect(findRecurring([backupGuide, 'X/testNew'], previousRuns))
      .toEqual([{ test: backupGuide, previousRuns: ['run/1', 'run/2'] }]);
    expect(findRecurring(['X/testNew'], previousRuns)).toEqual([]);
  });
});

describe('decideAction', () => {
  const recurring = [{ test: backupGuide, previousRuns: ['run/1'] }];

  it('reruns a first failure once without an issue', () => {
    expect(decideAction({ attempt: 1, newerRunExists: false, recurring: [] })).toEqual({ rerun: true, report: null });
  });

  it('reports a test that keeps failing, and still reruns', () => {
    expect(decideAction({ attempt: 1, newerRunExists: false, recurring })).toEqual({ rerun: true, report: 'recurring' });
  });

  it('does not rerun an older commit when a later run exists', () => {
    expect(decideAction({ attempt: 1, newerRunExists: true, recurring: [] })).toEqual({ rerun: false, report: null });
  });

  it('reports a failed rerun and does not rerun again', () => {
    expect(decideAction({ attempt: 2, newerRunExists: false, recurring: [] })).toEqual({ rerun: false, report: 'rerun-failed' });
  });
});

describe('issueBody', () => {
  it('names the commit, run, and failed tests of a failed rerun', () => {
    const body = issueBody({ report: 'rerun-failed', commit: 'abc', runUrl: 'run/9/attempts/2', tests: [seedProbe], recurring: [], rerun: false });
    expect(body).toContain('再実行でも失敗しました');
    expect(body).toContain('Commit: abc');
    expect(body).toContain('Run: run/9/attempts/2');
    expect(body).toContain(`- \`${seedProbe}\``);
  });

  it('says when the failed tests could not be read from the log', () => {
    const body = issueBody({ report: 'rerun-failed', commit: 'abc', runUrl: 'run', tests: [], recurring: [], rerun: false });
    expect(body).toContain('ログから特定できませんでした');
  });

  it('lists the earlier failures of a recurring test', () => {
    const body = issueBody({
      report: 'recurring',
      commit: 'abc',
      runUrl: 'run/9/attempts/1',
      tests: [backupGuide],
      recurring: [{ test: backupGuide, previousRuns: ['run/1', 'run/2'] }],
      rerun: true,
    });
    expect(body).toContain('過去14日以内');
    expect(body).toContain(`- \`${backupGuide}\`（前の失敗: run/1、run/2）`);
    expect(body).toContain('失敗したジョブを再実行しました');
  });
});

const html = (id) => `https://github.com/o/r/actions/runs/${id}`;

function fakeGitHub({ attempt = 1, runs = [], jobs, logs, issues = [] }) {
  const posts = [];
  const request = async (path, { method = 'GET', body } = {}) => {
    if (method === 'POST') {
      posts.push({ path, body });
      return path === '/issues' ? { number: 500 } : null;
    }
    if (path === '/actions/runs/10') return { id: 10, created_at: '2026-11-04T12:12:00Z', html_url: html(10), head_sha: 'abc', run_attempt: attempt };
    const jobsMatch = path.match(/^\/actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs/);
    if (jobsMatch) return { jobs: jobs[`${jobsMatch[1]}/${jobsMatch[2]}`] ?? [] };
    const logMatch = path.match(/^\/actions\/jobs\/(\d+)\/logs$/);
    if (logMatch) {
      if (logs[logMatch[1]] instanceof Error) throw logs[logMatch[1]];
      return logs[logMatch[1]];
    }
    const runsMatch = path.match(/^\/actions\/workflows\/ios-full\.yml\/runs\?branch=main&created=%3E%3D2026-10-21T12%3A12%3A00Z&per_page=100&page=(\d+)$/);
    if (runsMatch) {
      const all = [{ id: 10, created_at: '2026-11-04T12:12:00Z', html_url: html(10), run_attempt: attempt, conclusion: 'failure' }, ...runs];
      const page = Number(runsMatch[1]);
      return { workflow_runs: all.slice((page - 1) * 100, page * 100) };
    }
    if (path.startsWith('/issues?state=open&labels=bug%2Cpriority%3AP1%2Cplatform%3Aios')) return issues;
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  return { github: { request }, posts };
}

const failedJob = (id) => ({ id, conclusion: 'failure' });
const passedJob = (id) => ({ id, conclusion: 'success' });

describe('handleFailure', () => {
  it('reruns the failed jobs of a first failure without opening an issue', async () => {
    const { github, posts } = fakeGitHub({
      runs: [{ id: 8, created_at: '2026-11-01T00:00:00Z', html_url: html(8), run_attempt: 1, conclusion: 'success' }],
      jobs: { '10/1': [failedJob(1), passedJob(2)] },
      logs: { 1: seedProbeLog },
    });
    const result = await handleFailure({ github, runId: '10', attempt: 1, log: () => {} });
    expect(result).toMatchObject({ tests: [seedProbe], recurring: [], newerRunExists: false, rerun: true, report: null });
    expect(posts).toEqual([{ path: '/actions/runs/10/rerun-failed-jobs', body: undefined }]);
  });

  it('opens an issue when a failed test also failed an earlier main run within 14 days', async () => {
    const { github, posts } = fakeGitHub({
      runs: [
        { id: 7, created_at: '2026-10-30T00:00:00Z', html_url: html(7), run_attempt: 2, conclusion: 'success' },
        { id: 6, created_at: '2026-10-25T00:00:00Z', html_url: html(6), run_attempt: 1, conclusion: 'success' },
      ],
      jobs: { '10/1': [failedJob(1)], '7/1': [failedJob(2)] },
      logs: { 1: backupGuideLog, 2: backupGuideLog },
    });
    const result = await handleFailure({ github, runId: '10', attempt: 1, log: () => {} });
    expect(result.report).toBe('recurring');
    expect(posts.map(({ path }) => path)).toEqual(['/issues', '/actions/runs/10/rerun-failed-jobs']);
    expect(posts[0].body).toMatchObject({ title: ISSUE_TITLE, labels: ISSUE_LABELS });
    expect(posts[0].body.body).toContain(`${html(7)}/attempts/1`);
  });

  it('leaves an older commit to the later run', async () => {
    const { github, posts } = fakeGitHub({
      runs: [{ id: 11, created_at: '2026-11-04T23:46:00Z', html_url: html(11), run_attempt: 1, conclusion: null }],
      jobs: { '10/1': [failedJob(1)] },
      logs: { 1: seedProbeLog },
    });
    const result = await handleFailure({ github, runId: '10', attempt: 1, log: () => {} });
    expect(result).toMatchObject({ newerRunExists: true, rerun: false, report: null });
    expect(posts).toEqual([]);
  });

  it('comments on the open failure issue when the rerun also fails', async () => {
    const { github, posts } = fakeGitHub({
      attempt: 2,
      jobs: { '10/2': [failedJob(3)] },
      logs: { 3: seedProbeLog },
      issues: [
        { number: 400, title: ISSUE_TITLE, pull_request: {} },
        { number: 414, title: ISSUE_TITLE },
      ],
    });
    const result = await handleFailure({ github, runId: '10', attempt: 2, log: () => {} });
    expect(result).toMatchObject({ rerun: false, report: 'rerun-failed' });
    expect(posts.map(({ path }) => path)).toEqual(['/issues/414/comments']);
    expect(posts[0].body.body).toContain(`Run: ${html(10)}/attempts/2`);
  });

  it('reads every page of earlier runs', async () => {
    const older = Array.from({ length: 99 }, (_, index) => ({
      id: 100 + index,
      created_at: '2026-11-01T00:00:00Z',
      html_url: html(100 + index),
      run_attempt: 1,
      conclusion: 'success',
    }));
    const { github, posts } = fakeGitHub({
      runs: [...older, { id: 11, created_at: '2026-11-04T23:46:00Z', html_url: html(11), run_attempt: 1, conclusion: null }],
      jobs: { '10/1': [failedJob(1)] },
      logs: { 1: seedProbeLog },
    });
    const result = await handleFailure({ github, runId: '10', attempt: 1, log: () => {} });
    expect(result.newerRunExists).toBe(true);
    expect(posts).toEqual([]);
  });

  it('still reruns when a log cannot be read, and notes it', async () => {
    const { github, posts } = fakeGitHub({
      jobs: { '10/1': [failedJob(1)] },
      logs: { 1: new Error('GET /actions/jobs/1/logs failed: 404') },
    });
    const output = [];
    const result = await handleFailure({ github, runId: '10', attempt: 1, log: (text) => output.push(text) });
    expect(result).toMatchObject({ tests: [], rerun: true, report: null });
    expect(posts.map(({ path }) => path)).toEqual(['/actions/runs/10/rerun-failed-jobs']);
    expect(output.join('\n')).toContain('注意: https://github.com/o/r/actions/runs/10/attempts/1のログを読めませんでした');
  });

  it('changes nothing in a dry run', async () => {
    const { github, posts } = fakeGitHub({
      attempt: 2,
      jobs: { '10/2': [failedJob(3)] },
      logs: { 3: seedProbeLog },
    });
    const output = [];
    await handleFailure({ github, runId: '10', attempt: 2, dryRun: true, log: (text) => output.push(text) });
    expect(posts).toEqual([]);
    expect(output.join('\n')).toContain('作成またはコメントする（dry run）');
  });
});

describe('createGitHub', () => {
  it('sends authenticated requests and returns JSON or text', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return new Response(url.endsWith('/logs') ? 'log text' : '{"ok":true}', { status: url.endsWith('/rerun-failed-jobs') ? 201 : 200 });
    };
    const github = createGitHub({ token: 't', repository: 'o/r', fetchImpl });
    expect(await github.request('/actions/runs/1')).toEqual({ ok: true });
    expect(await github.request('/actions/jobs/2/logs', { text: true })).toBe('log text');
    await github.request('/actions/runs/1/rerun-failed-jobs', { method: 'POST' });
    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/actions/runs/1');
    expect(calls[0].init.headers.Authorization).toBe('Bearer t');
    expect(calls[2].init.method).toBe('POST');
  });

  it('throws with the status when GitHub refuses a request', async () => {
    const github = createGitHub({ token: 't', repository: 'o/r', fetchImpl: async () => new Response('nope', { status: 403 }) });
    await expect(github.request('/actions/runs/1/rerun-failed-jobs', { method: 'POST' })).rejects.toThrow('403 nope');
  });
});

describe('workflows', () => {
  const failureWorkflow = readFileSync(new URL('../.github/workflows/ios-full-failure.yml', import.meta.url), 'utf8');
  const fullWorkflow = readFileSync(new URL('../.github/workflows/ios-full.yml', import.meta.url), 'utf8');

  it('runs after a failed main run of the full iOS validation workflow', () => {
    const name = fullWorkflow.match(/^name: (.+)$/m)[1];
    expect(failureWorkflow).toContain(`workflows: [${name}]`);
    expect(failureWorkflow).toContain('types: [completed]');
    expect(failureWorkflow).toContain("github.event.workflow_run.conclusion == 'failure'");
    expect(failureWorkflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(failureWorkflow).toContain('RUN_ATTEMPT: ${{ github.event.workflow_run.run_attempt }}');
    expect(failureWorkflow).toContain('node scripts/ios-full-failure.mjs');
  });

  it('grants only the rerun and issue permissions to the failure job', () => {
    expect(failureWorkflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(failureWorkflow).toMatch(/permissions:\n {6}actions: write\n {6}contents: read\n {6}issues: write\n/);
  });

  it('leaves failure handling out of the full iOS validation workflow', () => {
    expect(fullWorkflow).not.toContain('report_failure');
    expect(fullWorkflow).not.toContain('issues: write');
  });
});
