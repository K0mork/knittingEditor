// Claude CodeのPreToolUseフック（`.claude/settings.json`）。リポジトリ直下のチェックアウトは
// 複数のセッションで共有し`main`に置いたままにするため、そこでブランチや作業内容を変える
// gitコマンドを止める（AGENTS.mdの「Branches, Worktrees & Cleanup」）。worktreeの中では何も止めない。
//   標準入力: フックの入力JSON（`tool_input.command`と`cwd`）
//   終了コード2: 止める（理由を標準エラーへ出し、Claudeに返す）
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '(', ')', '{', '}']);
const PREFIX_COMMANDS = new Set(['command', 'env', 'exec', 'nohup', 'time']);
const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
const ALWAYS_BLOCKED = new Set(['am', 'cherry-pick', 'clean', 'commit', 'merge', 'rebase', 'reset', 'restore', 'revert']);
const READ_ONLY_STASH = new Set(['list', 'show']);

/** 引用符・エスケープと区切りを読む。展開を含む単語は実行せず、不明として扱う。 */
function shellSegments(command) {
  const segments = [];
  let words = [];
  let dynamic = [];
  let word = '';
  let inWord = false;
  let expanded = false;
  let quote = null;
  let substitutionDepth = 0;
  let backtick = false;
  const pushWord = () => {
    if (inWord) {
      words.push(word);
      dynamic.push(expanded || quote !== null);
    }
    word = '';
    inWord = false;
    expanded = false;
  };
  const pushSegment = (separator) => {
    pushWord();
    segments.push({ words, dynamic, separator });
    words = [];
    dynamic = [];
  };
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (substitutionDepth || backtick) {
      word += char;
      if (char === '\\') word += command[++i] ?? '';
      else if (backtick && char === '`') backtick = false;
      else if (!backtick && char === '(') substitutionDepth += 1;
      else if (!backtick && char === ')') substitutionDepth -= 1;
      continue;
    }
    if (char === '\\' && quote !== "'" && i + 1 < command.length) {
      word += command[++i];
      inWord = true;
    } else if (char === quote) {
      quote = null;
    } else if (!quote && (char === '"' || char === "'")) {
      quote = char;
      inWord = true;
    } else if (quote !== "'" && (char === '$' || char === '`')) {
      expanded = true;
      inWord = true;
      word += char;
      if (char === '`') backtick = true;
      else if (command[i + 1] === '(') {
        substitutionDepth = 1;
        word += command[++i];
      } else if (command[i + 1] === '{') {
        const end = command.indexOf('}', i + 2);
        word += command.slice(i + 1, end < 0 ? command.length : end + 1);
        i = end < 0 ? command.length : end;
      }
    } else if (quote) {
      word += char;
    } else if (char === '\n') {
      pushSegment(';');
    } else if (/\s/.test(char)) {
      pushWord();
    } else {
      const pair = command.slice(i, i + 2);
      if (pair === '&&' || pair === '||') {
        pushSegment(pair);
        i += 1;
      } else if (SEPARATORS.has(char)) {
        pushSegment(char);
      } else {
        // Glob・チルダ展開の結果やcdのディレクトリスタックは静的には分からない。
        if ('~*?['.includes(char)) expanded = true;
        word += char;
        inWord = true;
      }
    }
  }
  if (substitutionDepth || backtick) expanded = true;
  pushSegment(null);
  return segments;
}

/** 既存の単語列API。ディレクトリ追跡では区切り情報も使う。 */
export function splitSegments(command) {
  return shellSegments(command).map(({ words }) => words).filter((words) => words.length > 0);
}

// 対応範囲: リテラルのcd（-L/-P/--）、&&、;、改行、括弧のsubshell、波括弧。
// cdは成功した場合の場所を追う。||、pipeline/background、展開を含む/省略したcd先は
// 不明とし、mainの可能性がある破壊的操作を止める。シェル展開やcdは実行しない。
// 既知の絶対cd先やgit -Cで場所が確定したら判定を再開する。完全なシェル解析ではない。
function changeDirectory(cwd, words, dynamic, start) {
  let index = start + 1;
  while (words[index] === '-L' || words[index] === '-P') index += 1;
  if (words[index] === '--') index += 1;
  const target = words[index];
  if (!target || target === '-' || target.startsWith('-') || dynamic[index] || index + 1 !== words.length) return null;
  return isAbsolute(target) ? resolve(target) : cwd === null ? null : resolve(cwd, target);
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
 * cwdを渡すと`dir`はcdとgit -Cを反映した絶対パス（不明ならnull）。
 * cwdを省略した既存APIではgit -Cの指定を返す。
 */
export function findInvocations(command, cwd) {
  const invocations = [];
  let directory = cwd ?? null;
  const stack = [];
  for (const { words, dynamic, separator } of shellSegments(command)) {
    const effectiveDirectory = directory;
    const parentDirectory = separator === ')' ? (stack.length ? stack.pop() : null) : null;
    if (separator === '(') stack.push(directory);
    else if (separator === ')') directory = parentDirectory;
    else if (separator === '||' || separator === '|' || separator === '&') directory = null;
    const start = commandStart(words);
    const program = words[start];
    if (program === 'cd') {
      directory = changeDirectory(effectiveDirectory, words, dynamic, start);
      if (separator === ')') directory = parentDirectory;
      else if (separator === '||' || separator === '|' || separator === '&') directory = null;
      continue;
    }
    if (program === 'gh' && words[start + 1] === 'pr' && words[start + 2] === 'checkout') {
      invocations.push({ program: 'gh', dir: cwd === undefined ? null : effectiveDirectory, subcommand: 'pr checkout', args: words.slice(start + 3) });
      continue;
    }
    if (program !== 'git' && !program?.endsWith('/git')) continue;
    let index = start + 1;
    let dir = cwd === undefined ? null : effectiveDirectory;
    while (index < words.length && words[index].startsWith('-')) {
      const option = words[index];
      if (option === '-C') {
        const target = words[index + 1];
        dir = !target || dynamic[index + 1] ? null
          : isAbsolute(target) ? resolve(target)
            : dir ? resolve(dir, target) : cwd === undefined ? target : null;
      }
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
  for (const invocation of findInvocations(command, cwd)) {
    const reason = violationOf(invocation);
    if (reason && (invocation.dir === null || isMain(invocation.dir))) reasons.push(reason);
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
