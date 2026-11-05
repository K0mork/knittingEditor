// Full iOS validation（.github/workflows/ios-full.yml）が`main`で失敗したときに、
// .github/workflows/ios-full-failure.ymlから実行する。GitHubのmacOSランナーではSimulatorのテストが
// ランナーの遅さで時々落ちるため、1回目の失敗では失敗したジョブを1回だけ再実行し、次のときだけIssueにする。
// - 再実行でも失敗した。
// - 失敗したテストが、過去14日以内の`main`の別の実行でもジョブを失敗させていた。
// 方針はルートのAGENTS.mdの「Intermittent iOS test failures」に書いてある。
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const ISSUE_TITLE = 'Full iOS validation failed';
export const ISSUE_LABELS = ['bug', 'priority:P1', 'platform:ios'];
export const RECURRENCE_WINDOW_DAYS = 14;
const WORKFLOW_FILE = 'ios-full.yml';
const DAY_MS = 24 * 60 * 60 * 1000;

// xcodebuildのログで、テストの失敗と実行時間の上限の超過を表す行から「クラス/メソッド」を取り出す。
// 上限を超えたテストは、ランナーの再起動後に「passed」と出てもジョブを失敗させるので、超過も失敗に数える。
const testCasePattern = /Test Case '-\[(?:\w+\.)?(\w+) (test\w*)\]' (?:failed \(|exceeded execution time allowance)/g;

export function failedTests(log) {
  const tests = new Set();
  for (const match of log.matchAll(testCasePattern)) tests.add(`${match[1]}/${match[2]}`);
  return [...tests].sort();
}

// previousRunsは、過去の実行ごとの { url, tests }。
export function findRecurring(tests, previousRuns) {
  return tests.flatMap((test) => {
    const urls = previousRuns.filter((run) => run.tests.includes(test)).map((run) => run.url);
    return urls.length > 0 ? [{ test, previousRuns: urls }] : [];
  });
}

// report: null（Issueにしない）、'rerun-failed'（再実行でも失敗）、'recurring'（同じテストが繰り返し失敗）。
export function decideAction({ attempt, newerRunExists, recurring }) {
  if (attempt >= 2) return { rerun: false, report: 'rerun-failed' };
  return {
    // 同じブランチの後の実行は、より新しいコミットを検証する。古いコミットの再実行は、
    // ios-full.ymlのconcurrencyで後の実行を取り消してしまうので行わない。
    rerun: !newerRunExists,
    report: recurring.length > 0 ? 'recurring' : null,
  };
}

function formatTests(tests) {
  if (tests.length === 0) return '- ログから特定できませんでした（ビルドやSimulatorの起動の失敗など）';
  return tests.map((test) => `- \`${test}\``).join('\n');
}

export function issueBody({ report, commit, runUrl, tests, recurring, rerun }) {
  if (report === 'rerun-failed') {
    return [
      'iOSの全検証が、失敗したジョブの再実行でも失敗しました。該当コミットの失敗ジョブとログを確認してください。',
      '',
      `Commit: ${commit}`,
      `Run: ${runUrl}`,
      '',
      '失敗したテスト:',
      formatTests(tests),
    ].join('\n');
  }
  const lines = recurring.map(({ test, previousRuns }) => `- \`${test}\`（前の失敗: ${previousRuns.join('、')}）`);
  return [
    `iOSの全検証で、過去${RECURRENCE_WINDOW_DAYS}日以内の\`main\`の別の実行でもジョブを失敗させていたテストが、また失敗しました。再実行で通っても、ランナーの遅さだけでは説明できない原因がないか調べてください。`,
    '',
    `Commit: ${commit}`,
    `Run: ${runUrl}`,
    `再実行: ${rerun ? '失敗したジョブを再実行しました。' : '後の実行が新しいコミットを検証するため、再実行していません。'}`,
    '',
    '繰り返し失敗したテスト:',
    ...lines,
  ].join('\n');
}

export function createGitHub({ token, repository, fetchImpl = fetch }) {
  const base = `https://api.github.com/repos/${repository}`;
  async function request(path, { method = 'GET', body, text = false } = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const content = await response.text();
    if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${content}`);
    if (text) return content;
    return content ? JSON.parse(content) : null;
  }
  return { request };
}

async function failedTestsOfAttempt(github, runId, attempt) {
  const { jobs } = await github.request(`/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
  const tests = new Set();
  for (const job of jobs.filter((candidate) => candidate.conclusion === 'failure')) {
    const log = await github.request(`/actions/jobs/${job.id}/logs`, { text: true });
    for (const test of failedTests(log)) tests.add(test);
  }
  return [...tests].sort();
}

async function listMainRuns(github, since) {
  const created = encodeURIComponent(`>=${since.toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
  const runs = [];
  for (let page = 1; ; page++) {
    const { workflow_runs: batch } = await github.request(
      `/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&created=${created}&per_page=100&page=${page}`,
    );
    runs.push(...batch);
    if (batch.length < 100) return runs;
  }
}

async function reportIssue(github, body) {
  const issues = await github.request(`/issues?state=open&labels=${encodeURIComponent(ISSUE_LABELS.join(','))}&per_page=100`);
  const existing = issues.find((issue) => !issue.pull_request && issue.title === ISSUE_TITLE);
  if (existing) {
    await github.request(`/issues/${existing.number}/comments`, { method: 'POST', body: { body } });
    return `#${existing.number}にコメントしました。`;
  }
  const created = await github.request('/issues', { method: 'POST', body: { title: ISSUE_TITLE, labels: ISSUE_LABELS, body } });
  return `#${created.number}を作成しました。`;
}

export async function handleFailure({ github, runId, attempt, dryRun = false, log = console.log }) {
  const run = await github.request(`/actions/runs/${runId}`);
  const createdAt = new Date(run.created_at);
  const runUrl = `${run.html_url}/attempts/${attempt}`;
  // ログを読めなくても、再実行とIssueの判断は止めない。読めなかったことは要約に残す。
  const warnings = [];
  const readFailedTests = async (id, number, url) => {
    try {
      return await failedTestsOfAttempt(github, id, number);
    } catch (error) {
      warnings.push(`${url}のログを読めませんでした: ${error.message}`);
      return [];
    }
  };
  const tests = await readFailedTests(runId, attempt, runUrl);
  const runs = await listMainRuns(github, new Date(createdAt.getTime() - RECURRENCE_WINDOW_DAYS * DAY_MS));
  const others = runs.filter((candidate) => candidate.id !== run.id);
  const newerRunExists = others.some((candidate) => new Date(candidate.created_at) > createdAt);

  const recurringCandidates = [];
  if (attempt === 1 && tests.length > 0) {
    // 1回目でジョブが失敗した実行だけを見る。再実行された実行と、再実行前の失敗のままの実行が当たる。
    const previous = others.filter((candidate) => new Date(candidate.created_at) < createdAt
      && (candidate.run_attempt > 1 || candidate.conclusion === 'failure'));
    for (const candidate of previous) {
      const url = `${candidate.html_url}/attempts/1`;
      recurringCandidates.push({ url, tests: await readFailedTests(candidate.id, 1, url) });
    }
  }
  const recurring = findRecurring(tests, recurringCandidates);
  const action = decideAction({ attempt, newerRunExists, recurring });

  const summary = [
    `Run: ${runUrl}`,
    `失敗したテスト:\n${formatTests(tests)}`,
    `繰り返し失敗したテスト: ${recurring.length > 0 ? recurring.map(({ test }) => `\`${test}\``).join('、') : 'なし'}`,
    `後の実行: ${newerRunExists ? 'あり' : 'なし'}`,
    ...warnings.map((warning) => `注意: ${warning}`),
  ];

  if (action.report) {
    const body = issueBody({ report: action.report, commit: run.head_sha, runUrl, tests, recurring, rerun: action.rerun });
    summary.push(`Issue: ${dryRun ? `作成またはコメントする（dry run）\n\n${body}` : await reportIssue(github, body)}`);
  } else {
    summary.push('Issue: 作らない');
  }
  if (action.rerun) {
    if (!dryRun) await github.request(`/actions/runs/${runId}/rerun-failed-jobs`, { method: 'POST' });
    summary.push(`再実行: 失敗したジョブを再実行${dryRun ? 'する（dry run）' : 'しました'}`);
  } else {
    summary.push(`再実行: しない（${attempt >= 2 ? '再実行の結果' : '後の実行があるため'}）`);
  }
  log(summary.join('\n\n'));
  return { tests, recurring, newerRunExists, ...action };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
      attempt: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const runId = values['run-id'] ?? process.env.RUN_ID;
  const attempt = Number(values.attempt ?? process.env.RUN_ATTEMPT);
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^\d+$/.test(runId ?? '')) throw new Error('Set --run-id or RUN_ID to the workflow run ID.');
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('Set --attempt or RUN_ATTEMPT to the run attempt.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Set GITHUB_REPOSITORY to owner/name.');
  const token = process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const github = createGitHub({ token, repository });
  await handleFailure({
    github,
    runId,
    attempt,
    dryRun: values['dry-run'],
    log: (text) => {
      console.log(text);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
    },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
