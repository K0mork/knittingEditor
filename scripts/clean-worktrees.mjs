// マージ・クローズ済みのPRのworktreeとローカルブランチを片付ける（AGENTS.mdの「Branches, Worktrees & Cleanup」）。
//   node scripts/clean-worktrees.mjs           消す候補と残す理由を表示するだけ
//   node scripts/clean-worktrees.mjs --apply   候補を実際に消す
// 未コミットの変更があるもの、PRに含まれない未pushのコミットがあるもの、オープンなPRのもの、
// どれかのプロセスが作業場所にしているもの（実行中のセッション）は消さない。
// リポジトリ直下のチェックアウトは切り替えず、`main`以外にあれば知らせるだけにする。
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** `git worktree list --porcelain`の出力を読む。先頭がリポジトリ直下のチェックアウト。 */
export function parseWorktrees(porcelain) {
  return porcelain
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const worktree = { path: '', head: '', branch: null };
      for (const line of block.split('\n')) {
        if (line.startsWith('worktree ')) worktree.path = line.slice('worktree '.length);
        else if (line.startsWith('HEAD ')) worktree.head = line.slice('HEAD '.length);
        else if (line.startsWith('branch ')) worktree.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
      }
      return worktree;
    });
}

/**
 * ブランチ（またはworktreeのHEAD）を消してよいかを決める。
 *   facts.inMain     先端が`origin/main`に含まれる
 *   facts.pr         同じ名前のブランチから出た最新のPR（{ number, state, headIsTipOrDescendant }）、無ければnull
 *   facts.dirty      未コミットの変更がある（worktreeのみ）
 *   facts.inUse      どれかのプロセスが作業場所にしている（worktreeのみ）
 * 戻り値: { remove: boolean, reason: string }
 */
export function decide({ inMain, pr, dirty = false, inUse = false }) {
  if (dirty) return { remove: false, reason: 'uncommitted changes' };
  if (inUse) return { remove: false, reason: 'in use by a running process' };
  if (pr?.state === 'OPEN') return { remove: false, reason: `PR #${pr.number} is open` };
  if (inMain) return { remove: true, reason: pr ? `PR #${pr.number} ${pr.state.toLowerCase()}, tip is in origin/main` : 'tip is in origin/main' };
  if (pr && pr.headIsTipOrDescendant) return { remove: true, reason: `PR #${pr.number} ${pr.state.toLowerCase()}, tip matches the PR head` };
  if (pr) return { remove: false, reason: `commits not in PR #${pr.number} or origin/main` };
  return { remove: false, reason: 'no PR and commits not in origin/main' };
}

/** `lsof -F n`の出力から、作業場所のパスを取り出す。 */
export function parseLsofCwds(output) {
  return output
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => line.slice(1));
}

/** `cwds`のどれかが`path`の中にあればtrue。 */
export function isPathInUse(path, cwds) {
  return cwds.some((cwd) => cwd === path || cwd.startsWith(path + sep));
}

function run(args, options = {}) {
  return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function tryRun(args) {
  try {
    return { ok: true, output: run(args) };
  } catch (error) {
    return { ok: false, output: String(error.stderr ?? error.message).trim() };
  }
}

function isAncestor(commit, of) {
  return tryRun(['git', 'merge-base', '--is-ancestor', commit, of]).ok;
}

function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function pullRequestFor(branch, tip) {
  const result = tryRun(['gh', 'pr', 'list', '--state', 'all', '--head', branch, '--limit', '1', '--json', 'number,state,headRefOid']);
  if (!result.ok) throw new Error(`gh pr list failed for ${branch}: ${result.output}`);
  const [pr] = JSON.parse(result.output || '[]');
  if (!pr) return null;
  const headKnown = tryRun(['git', 'cat-file', '-e', `${pr.headRefOid}^{commit}`]).ok;
  return { number: pr.number, state: pr.state, headIsTipOrDescendant: pr.headRefOid === tip || (headKnown && isAncestor(tip, pr.headRefOid)) };
}

function processCwds() {
  const result = tryRun(['lsof', '-a', '-d', 'cwd', '-F', 'n']);
  // lsofは権限の無いプロセスがあると終了コード1になるが、読めた分は出力される。
  return parseLsofCwds(result.ok ? result.output : '').map(realPath);
}

function main() {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
  run(['git', 'fetch', '--prune', '--quiet', 'origin']);
  const [mainCheckout, ...worktrees] = parseWorktrees(run(['git', 'worktree', 'list', '--porcelain']));
  // このスクリプト自身の作業場所も「使用中」に含める。実行中のworktreeは消さない。
  const cwds = processCwds();
  const kept = new Set(mainCheckout.branch ? [mainCheckout.branch, 'main'] : ['main']);
  const actions = [];

  for (const worktree of worktrees) {
    const tip = worktree.head;
    const facts = {
      inMain: isAncestor(tip, 'origin/main'),
      pr: worktree.branch ? pullRequestFor(worktree.branch, tip) : null,
      dirty: run(['git', '-C', worktree.path, 'status', '--porcelain']) !== '',
      inUse: isPathInUse(realPath(worktree.path), cwds),
    };
    const decision = decide(facts);
    console.log(`${decision.remove ? 'remove' : 'keep  '} worktree ${worktree.path} [${worktree.branch ?? 'detached'}]: ${decision.reason}`);
    if (decision.remove) actions.push(['git', 'worktree', 'remove', worktree.path]);
    else if (worktree.branch) kept.add(worktree.branch);
  }

  for (const line of run(['git', 'for-each-ref', 'refs/heads', '--format=%(refname:short) %(objectname)']).split('\n')) {
    const [branch, tip] = line.split(' ');
    if (!branch || kept.has(branch)) continue;
    const decision = decide({ inMain: isAncestor(tip, 'origin/main'), pr: pullRequestFor(branch, tip) });
    console.log(`${decision.remove ? 'remove' : 'keep  '} branch ${branch}: ${decision.reason}`);
    // squashマージしたブランチはgitからは未マージに見えるので、判定を済ませた上で-Dで消す。
    if (decision.remove) actions.push(['git', 'branch', '-D', branch]);
  }

  if (mainCheckout.branch !== 'main') {
    console.log(`note: the main checkout ${mainCheckout.path} is on ${mainCheckout.branch ?? 'a detached HEAD'}; switch it back with \`git switch main\` once no session uses it.`);
  }

  if (!values.apply) {
    console.log(actions.length ? `\n${actions.length} item(s) can be removed. Re-run with --apply to remove them.` : '\nNothing to remove.');
    return;
  }
  for (const action of actions) run(action);
  tryRun(['git', 'worktree', 'prune']);
  console.log(`\nRemoved ${actions.length} item(s).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
