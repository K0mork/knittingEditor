// Claude CodeのPreToolUseフック（`.claude/settings.json`）。リポジトリ直下のチェックアウトは
// 複数のセッションで共有し`main`に置いたままにするため、そこでブランチや作業内容を変える
// gitコマンドを止める（AGENTS.mdの「Branches, Worktrees & Cleanup」）。worktreeの中では何も止めない。
//   標準入力: フックの入力JSON（`tool_input.command`と`cwd`）
//   終了コード2: 止める（理由を標準エラーへ出し、Claudeに返す）
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '(', ')', '{', '}']);
const PREFIX_COMMANDS = new Set(['command', 'env', 'exec', 'nohup', 'time']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const ALWAYS_BLOCKED = new Set(['am', 'cherry-pick', 'clean', 'commit', 'merge', 'rebase', 'reset', 'restore', 'revert']);
const READ_ONLY_STASH = new Set(['list', 'show']);

/** シェルのコマンド文字列を、区切り記号で分けた単語列の並びにする（引用符だけを解釈する簡易版）。 */
export function splitSegments(command) {
  const segments = [[]];
  let word = '';
  let inWord = false;
  let quote = null;
  const pushWord = () => {
    if (inWord) segments[segments.length - 1].push(word);
    word = '';
    inWord = false;
  };
  const pushSeparator = () => {
    pushWord();
    if (segments[segments.length - 1].length > 0) segments.push([]);
  };
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && i + 1 < command.length) word += command[(i += 1)];
      else word += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      inWord = true;
    } else if (char === '\\' && i + 1 < command.length) {
      word += command[(i += 1)];
      inWord = true;
    } else if (char === '\n') {
      pushSeparator();
    } else if (/\s/.test(char)) {
      pushWord();
    } else {
      const pair = command.slice(i, i + 2);
      if (pair === '&&' || pair === '||') {
        pushSeparator();
        i += 1;
      } else if (SEPARATORS.has(char)) {
        pushSeparator();
      } else {
        word += char;
        inWord = true;
      }
    }
  }
  pushWord();
  return segments.filter((segment) => segment.length > 0);
}

/** 単語列の先頭の環境変数の代入と`env`などを飛ばし、実行されるコマンドの位置を返す。 */
function commandStart(words) {
  let index = 0;
  while (index < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]) || PREFIX_COMMANDS.has(words[index]))) {
    index += 1;
  }
  return index;
}

/**
 * コマンド文字列に含まれるgitと`gh pr checkout`の呼び出しを取り出す。
 * `dir`は`git -C`で指定した場所（無ければnull）。
 */
export function findInvocations(command) {
  const invocations = [];
  for (const words of splitSegments(command)) {
    const start = commandStart(words);
    const program = words[start];
    if (program === 'gh' && words[start + 1] === 'pr' && words[start + 2] === 'checkout') {
      invocations.push({ program: 'gh', dir: null, subcommand: 'pr checkout', args: words.slice(start + 3) });
      continue;
    }
    if (program !== 'git' && !program?.endsWith('/git')) continue;
    let index = start + 1;
    let dir = null;
    while (index < words.length && words[index].startsWith('-')) {
      const option = words[index];
      if (option === '-C') dir = dir ? resolve(dir, words[index + 1] ?? '') : (words[index + 1] ?? null);
      index += GIT_OPTIONS_WITH_VALUE.has(option) ? 2 : 1;
    }
    if (index >= words.length) continue;
    invocations.push({ program: 'git', dir, subcommand: words[index], args: words.slice(index + 1) });
  }
  return invocations;
}

/** `main`へ戻るだけの`git switch`・`git checkout`かどうか。 */
function isSwitchToMain(args, creatingOptions) {
  const operands = args.filter((arg) => !arg.startsWith('-'));
  const options = args.filter((arg) => arg.startsWith('-'));
  return operands.length === 1 && operands[0] === 'main' && !options.some((option) => creatingOptions.has(option));
}

/** 共有のチェックアウトで実行すると問題になる呼び出しなら、その理由を返す。問題なければnull。 */
export function violationOf({ program, subcommand, args }) {
  if (program === 'gh') return '`gh pr checkout` switches the branch';
  if (subcommand === 'switch') {
    return isSwitchToMain(args, new Set(['-c', '-C', '--create', '--force-create', '--detach', '-d', '--orphan', '-'])) ? null : '`git switch` to a branch other than `main`';
  }
  if (subcommand === 'checkout') {
    return isSwitchToMain(args, new Set(['-b', '-B', '--orphan', '--detach', '--', '-p', '--patch', '-'])) ? null : '`git checkout` other than switching to `main`';
  }
  if (subcommand === 'stash') {
    return READ_ONLY_STASH.has(args[0]) ? null : '`git stash` (the stash is shared by all worktrees)';
  }
  if (subcommand === 'pull') {
    return args.includes('--ff-only') ? null : '`git pull` without `--ff-only`';
  }
  if (ALWAYS_BLOCKED.has(subcommand)) return `\`git ${subcommand}\``;
  return null;
}

/** `dir`がリポジトリ直下のチェックアウト（worktreeではない方）ならtrue。gitの外ならfalse。 */
export function isMainCheckout(dir) {
  try {
    const [gitDir, commonDir] = execFileSync('git', ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n');
    return gitDir === commonDir;
  } catch {
    return false;
  }
}

/** フックの入力から、止める理由の一覧を返す。 */
export function blockedReasons(input, isMain = isMainCheckout) {
  const command = input?.tool_input?.command;
  const cwd = input?.cwd ?? process.cwd();
  if (typeof command !== 'string') return [];
  const reasons = [];
  for (const invocation of findInvocations(command)) {
    const reason = violationOf(invocation);
    if (reason && isMain(invocation.dir ? resolve(cwd, invocation.dir) : cwd)) reasons.push(reason);
  }
  return reasons;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const reasons = blockedReasons(input);
  if (reasons.length === 0) return;
  process.stderr.write(
    [
      `Blocked in the shared main checkout: ${[...new Set(reasons)].join('; ')}.`,
      'The checkout at the repository root is shared by several sessions and stays on `main` (AGENTS.md, "Branches, Worktrees & Cleanup").',
      'Do this work in your own worktree instead:',
      '  git fetch origin && git worktree add -b <branch> .claude/worktrees/<name> origin/main',
      'Switching the root checkout back to `main` (`git switch main`) and `git pull --ff-only` are allowed.',
    ].join('\n') + '\n',
  );
  process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
