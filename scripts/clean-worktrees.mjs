// マージ・クローズ済みのPRのworktreeとローカルブランチを片付ける（AGENTS.mdの「Branches, Worktrees & Cleanup」）。
//   node scripts/clean-worktrees.mjs           消す候補と残す理由を表示するだけ
//   node scripts/clean-worktrees.mjs --apply   候補を実際に消す
// 未コミットの変更があるもの、PRに含まれない未pushのコミットがあるもの、オープンなPRのもの、
// どれかのプロセスが作業場所にしているもの（実行中のセッション）、作成から7日以内でPRがまだ無いもの（作りたて）と、
// それらを中に入れ子で持つworktreeは消さない。
// リポジトリ直下のチェックアウトは切り替えず、`main`以外にあれば知らせるだけにする。
import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * 作成からこの期間内で、先端を含むPRがまだ無いworktree・ブランチは「作りたて」として残す。
 * `git worktree add -b <branch> <path> origin/main`の直後は先端が`origin/main`に含まれるので、
 * 別のセッションがその間に片付けを実行しても消さないようにする。誤って消すより残す側に倒す。
 */
export const RECENT_CREATION_MS = 7 * 24 * 60 * 60 * 1000;

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
 *   facts.processCwdsKnown プロセスの作業場所を完全に取得できた（worktreeのみ）
 *   facts.inUse      どれかのプロセスが作業場所にしている（worktreeのみ）
 *   facts.createdAt  worktreeまたはブランチを作った時刻（ミリ秒）。分からなければnull
 *   facts.now        現在時刻（ミリ秒）
 * 戻り値: { remove: boolean, reason: string }
 */
export function decide({ inMain, pr, dirty = false, inUse = false, processCwdsKnown = true, createdAt = null, now = Date.now() }) {
  if (dirty) return { remove: false, reason: 'uncommitted changes' };
  if (!processCwdsKnown) return { remove: false, reason: 'process working directories could not be determined' };
  if (inUse) return { remove: false, reason: 'in use by a running process' };
  if (pr?.state === 'OPEN') return { remove: false, reason: `PR #${pr.number} is open` };
  // PRがあっても先端を含まなければ、同じ名前の古いブランチのPRなので、作りたてとして扱う。
  if (createdAt !== null && now - createdAt < RECENT_CREATION_MS && !pr?.headIsTipOrDescendant) {
    const age = formatAge(now - createdAt);
    return { remove: false, reason: pr ? `created ${age} ago and PR #${pr.number} does not contain its tip` : `created ${age} ago and has no PR yet` };
  }
  if (inMain) return { remove: true, reason: pr ? `PR #${pr.number} ${pr.state.toLowerCase()}, tip is in origin/main` : 'tip is in origin/main' };
  if (pr && pr.headIsTipOrDescendant) return { remove: true, reason: `PR #${pr.number} ${pr.state.toLowerCase()}, tip matches the PR head` };
  if (pr) return { remove: false, reason: `commits not in PR #${pr.number} or origin/main` };
  return { remove: false, reason: 'no PR and commits not in origin/main' };
}

/** 経過時間を短く表す（例: `5m`、`3h`、`2d`）。 */
export function formatAge(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** `git reflog show --date=unix --format=%gd`の出力から、最も古い項目（作成時）の時刻をミリ秒で返す。無ければnull。 */
export function parseReflogCreatedAt(output) {
  const lines = output.split('\n').filter(Boolean);
  const match = lines.at(-1)?.match(/@\{(\d+)\}$/);
  return match ? Number(match[1]) * 1000 : null;
}

/** 分かっている作成時刻のうち最も新しいものを返す。どれも分からなければnull。 */
export function latestCreatedAt(...times) {
  const known = times.filter((time) => time !== null);
  return known.length ? Math.max(...known) : null;
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

/**
 * worktreeごとに`decide`で判定し、残すworktreeを中に入れ子で持つworktreeも残す。
 * `.claude/`は`.gitignore`の対象なので、`git worktree remove`は入れ子のworktreeを無視されたファイルとして
 * `--force`なしでも一緒に消し、その未コミットの変更と`.git/worktrees/`の管理情報が失われる。
 *   worktrees  [{ path, ... }]（pathは実パス）
 *   factsOf    worktreeを受け取り、`decide`に渡す事実を返す
 * 戻り値: [{ worktree, decision }]（入力と同じ順）
 */
export function planWorktrees(worktrees, factsOf) {
  const plans = worktrees.map((worktree) => ({ worktree, decision: decide(factsOf(worktree)) }));
  const keptPaths = plans.filter(({ decision }) => !decision.remove).map(({ worktree }) => worktree.path);
  return plans.map(({ worktree, decision }) => {
    if (!decision.remove) return { worktree, decision };
    const nested = keptPaths.find((kept) => kept !== worktree.path && isPathInUse(worktree.path, [kept]));
    return nested ? { worktree, decision: { remove: false, reason: `contains the kept nested worktree ${nested}` } } : { worktree, decision };
  });
}

function run(args, options = {}) {
  return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function tryRun(args) {
  try {
    return { ok: true, output: run(args) };
  } catch (error) {
    return { ok: false, output: String(error.stdout ?? '').trim(), error: String(error.stderr || error.message).trim() };
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
  if (!result.ok) throw new Error(`gh pr list failed for ${branch}: ${result.error}`);
  const [pr] = JSON.parse(result.output || '[]');
  if (!pr) return null;
  const headKnown = tryRun(['git', 'cat-file', '-e', `${pr.headRefOid}^{commit}`]).ok;
  return { number: pr.number, state: pr.state, headIsTipOrDescendant: pr.headRefOid === tip || (headKnown && isAncestor(tip, pr.headRefOid)) };
}

/**
 * ブランチを作った時刻。reflogの最も古い項目から取る。
 * Claudeデスクトップアプリが作るブランチのようにreflogが無ければnull。
 */
function branchCreatedAt(branch) {
  const result = tryRun(['git', 'reflog', 'show', '--date=unix', '--format=%gd', `refs/heads/${branch}`, '--']);
  return result.ok ? parseReflogCreatedAt(result.output) : null;
}

/**
 * worktreeを作った時刻。`.git/worktrees/<name>/commondir`は作成時に一度だけ書かれるので、その更新時刻を使う。
 * （同じ場所の`gitdir`はgitが使うたびに更新するので使わない。）
 */
function worktreeCreatedAt(path) {
  const gitDir = tryRun(['git', '-C', path, 'rev-parse', '--absolute-git-dir']);
  if (!gitDir.ok) return null;
  try {
    return statSync(join(gitDir.output, 'commondir')).mtimeMs;
  } catch {
    return null;
  }
}

export function processCwds() {
  const result = tryRun(['lsof', '-a', '-d', 'cwd', '-F', 'n']);
  // lsofは権限の無いプロセスがあると終了コード1になるが、読めた分は出力される。
  return {
    cwds: [...parseLsofCwds(result.output), process.cwd()].map(realPath),
    complete: result.ok,
  };
}

function main() {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
  run(['git', 'fetch', '--prune', '--quiet', 'origin']);
  const [mainCheckout, ...worktrees] = parseWorktrees(run(['git', 'worktree', 'list', '--porcelain']));
  // このスクリプト自身の作業場所も「使用中」に含める。実行中のworktreeは消さない。
  const { cwds, complete } = processCwds();
  const kept = new Set(mainCheckout.branch ? [mainCheckout.branch, 'main'] : ['main']);
  const now = Date.now();
  const actions = [];

  const plans = planWorktrees(
    worktrees.map((worktree) => ({ ...worktree, path: realPath(worktree.path), listedPath: worktree.path })),
    (worktree) => ({
      inMain: isAncestor(worktree.head, 'origin/main'),
      pr: worktree.branch ? pullRequestFor(worktree.branch, worktree.head) : null,
      dirty: run(['git', '-C', worktree.listedPath, 'status', '--porcelain']) !== '',
      processCwdsKnown: complete,
      inUse: isPathInUse(worktree.path, cwds),
      // 古いworktreeの中で新しいブランチを作った場合も作りたてとして扱うため、新しい方の時刻を使う。
      createdAt: latestCreatedAt(worktreeCreatedAt(worktree.listedPath), worktree.branch ? branchCreatedAt(worktree.branch) : null),
      now,
    }),
  );
  const removedWorktrees = [];
  for (const { worktree, decision } of plans) {
    console.log(`${decision.remove ? 'remove' : 'keep  '} worktree ${worktree.listedPath} [${worktree.branch ?? 'detached'}]: ${decision.reason}`);
    if (decision.remove) removedWorktrees.push(worktree.listedPath);
    else if (worktree.branch) kept.add(worktree.branch);
  }
  // 入れ子のworktreeを親より先に消し、親と一緒に消えたディレクトリの扱いをgitに頼らない。
  for (const path of removedWorktrees.sort((a, b) => b.length - a.length)) actions.push(['git', 'worktree', 'remove', path]);

  for (const line of run(['git', 'for-each-ref', 'refs/heads', '--format=%(refname:short) %(objectname)']).split('\n')) {
    const [branch, tip] = line.split(' ');
    if (!branch || kept.has(branch)) continue;
    const decision = decide({ inMain: isAncestor(tip, 'origin/main'), pr: pullRequestFor(branch, tip), createdAt: branchCreatedAt(branch), now });
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
