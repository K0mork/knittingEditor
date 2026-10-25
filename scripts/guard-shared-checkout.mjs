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
// 後ろのコマンドを実行する前置コマンドと、そのオプション（GNU・BSDの両方）。
//   values: 値を取る短いオプション。`-uNAME`のように続けて書いた値も読む。
//   long: 値を取る長いオプション（`--unset NAME`と`--unset=NAME`）。
//   external: 後ろのコマンドを別プロセスで動かすので、そこでのcdはシェルの場所を変えない。
//   lookup: 指定するとコマンドを実行せず、場所や種類を表示するだけ（`command -v`）。
// ここにないオプションは値を取らないものとして飛ばす。
const PREFIX_COMMANDS = new Map([
  ['command', { values: '', long: [], external: false, lookup: 'vV' }],
  ['env', { values: 'CLPSUu', long: ['--chdir', '--split-string', '--unset'], external: true, lookup: '' }],
  ['exec', { values: 'a', long: [], external: true, lookup: '' }],
  ['nohup', { values: '', long: [], external: true, lookup: '' }],
  ['time', { values: 'fo', long: ['--format', '--output'], external: false, lookup: '' }],
]);
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
// pipeline内のcdでは不明状態を解除しない。pipeline外の絶対cd先やgit -Cで
// 場所が確定したら判定を再開する。完全なシェル解析ではない。
function changeDirectory(cwd, words, dynamic, start) {
  let index = start + 1;
  while (words[index] === '-L' || words[index] === '-P') index += 1;
  if (words[index] === '--') index += 1;
  const target = words[index];
  if (!target || target === '-' || target.startsWith('-') || dynamic[index] || index + 1 !== words.length) return null;
  return isAbsolute(target) ? resolve(target) : cwd === null ? null : resolve(cwd, target);
}

/** git -C・env -Cの移動先。展開を含む・省略した移動先は不明（null）。 */
function resolveDirectory(base, target, isDynamic, legacy) {
  if (!target || isDynamic) return null;
  if (isAbsolute(target)) return resolve(target);
  if (base) return resolve(base, target);
  return legacy ? target : null;
}

/**
 * 単語列の先頭の環境変数の代入と`env`などの前置コマンド（オプションを含む）を飛ばし、
 * 実際に実行されるコマンドを返す。`env -S`は文字列を単語に分けて差し込み、`env -C`は場所を変える。
 *   start: 実行されるコマンドの位置。`command -v`のように実行しない場合はwords.length
 *   dir: そのコマンドが動く場所（不明ならnull）
 *   external: cdが別プロセスで動き、シェルの場所を変えないならtrue
 */
function resolveCommand(initialWords, initialDynamic, initialDir, legacy) {
  let words = initialWords;
  let dynamic = initialDynamic;
  let dir = initialDir;
  let external = false;
  let index = 0;
  while (index < words.length) {
    const prefix = words[index];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(prefix)) {
      index += 1;
      continue;
    }
    const spec = PREFIX_COMMANDS.get(prefix);
    if (!spec) break;
    external ||= spec.external;
    index += 1;
    // 値を受け取ったオプションを反映し、次に読む位置を返す。valueIndexは値を含む単語の位置。
    // `env -S`は分けた単語を、元の位置に並べたオプションとして読み直す（env(1)と同じ）。
    const apply = (option, value, valueIndex, next) => {
      if (prefix === 'env' && (option === '-C' || option === '--chdir')) {
        dir = resolveDirectory(dir, value, dynamic[valueIndex], legacy);
      }
      if (prefix === 'env' && (option === '-S' || option === '--split-string') && value !== undefined) {
        const split = shellSegments(value).filter((segment) => segment.words.length > 0);
        words = [...words.slice(0, index), ...split.flatMap((segment) => segment.words), ...words.slice(next)];
        dynamic = [...dynamic.slice(0, index), ...split.flatMap((segment) => segment.dynamic), ...dynamic.slice(next)];
        return index;
      }
      return next;
    };
    while (index < words.length) {
      const option = words[index];
      if (option === '--') {
        index += 1;
        break;
      }
      if (option === '-' && prefix === 'env') {
        index += 1;
        continue;
      }
      if (!option.startsWith('-') || option === '-') break;
      if (option.startsWith('--')) {
        const equals = option.indexOf('=');
        const name = equals < 0 ? option : option.slice(0, equals);
        if (equals >= 0) index = apply(name, option.slice(equals + 1), index, index + 1);
        else if (spec.long.includes(name)) index = apply(name, words[index + 1], index + 1, index + 2);
        else index += 1;
        continue;
      }
      let next = index + 1;
      for (let position = 1; position < option.length; position += 1) {
        const flag = option[position];
        if (spec.lookup.includes(flag)) return { words, dynamic, start: words.length, dir, external };
        if (!spec.values.includes(flag)) continue;
        const rest = option.slice(position + 1);
        next = rest ? apply(`-${flag}`, rest, index, index + 1) : apply(`-${flag}`, words[index + 1], index + 1, index + 2);
        break;
      }
      index = next;
    }
  }
  return { words, dynamic, start: index, dir, external };
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
  let pipelineDepth = null;
  let groupDepth = 0;
  for (const { words: segmentWords, dynamic: segmentDynamic, separator } of shellSegments(command)) {
    // グループ内の区切りではpipelineを終了しない。右側のcdも親には伝播しない。
    const inPipeline = pipelineDepth !== null || separator === '|';
    if (separator === '|') pipelineDepth = pipelineDepth === null ? groupDepth : Math.min(pipelineDepth, groupDepth);
    else if ([';', '&&', '||', '&'].includes(separator) && pipelineDepth !== null && groupDepth <= pipelineDepth) pipelineDepth = null;
    if (separator === '(' || separator === '{') groupDepth += 1;
    else if (separator === ')' || separator === '}') groupDepth = Math.max(0, groupDepth - 1);
    const effectiveDirectory = directory;
    const parentDirectory = separator === ')' ? (stack.length ? stack.pop() : null) : null;
    if (separator === '(') stack.push(directory);
    else if (separator === ')') directory = parentDirectory;
    else if (separator === '||' || separator === '|' || separator === '&') directory = null;
    const legacy = cwd === undefined;
    const resolved = resolveCommand(segmentWords, segmentDynamic, legacy ? null : effectiveDirectory, legacy);
    const { words, dynamic, start } = resolved;
    const program = words[start];
    if (program === 'cd') {
      // `env cd`などは別プロセスのcdで、シェルの場所は変わらない。
      if (!resolved.external) directory = inPipeline ? null : changeDirectory(effectiveDirectory, words, dynamic, start);
      if (separator === ')') directory = parentDirectory;
      else if (separator === '||' || separator === '|' || separator === '&') directory = null;
      continue;
    }
    if (program === 'gh' && words[start + 1] === 'pr' && words[start + 2] === 'checkout') {
      invocations.push({ program: 'gh', dir: resolved.dir, subcommand: 'pr checkout', args: words.slice(start + 3) });
      continue;
    }
    if (program !== 'git' && !program?.endsWith('/git')) continue;
    let index = start + 1;
    let dir = resolved.dir;
    while (index < words.length && words[index].startsWith('-')) {
      const option = words[index];
      if (option === '-C') dir = resolveDirectory(dir, words[index + 1], dynamic[index + 1], legacy);
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
