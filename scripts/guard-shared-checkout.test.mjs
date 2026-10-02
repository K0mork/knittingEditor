import { describe, expect, it } from 'vitest';
import { blockedReasons, findInvocations, splitSegments, violationOf } from './guard-shared-checkout.mjs';

const ROOT = '/repo';
const WORKTREE = '/repo/.claude/worktrees/feature';
const isMain = (dir) => dir === ROOT;
const reasonsAt = (cwd, command) => blockedReasons({ cwd, tool_input: { command } }, isMain);

describe('splitSegments', () => {
  it('splits on shell separators and keeps quoted text together', () => {
    expect(splitSegments('git fetch && git switch -c "my branch"; echo "a && b" | cat')).toEqual([
      ['git', 'fetch'],
      ['git', 'switch', '-c', 'my branch'],
      ['echo', 'a && b'],
      ['cat'],
    ]);
  });

  it('splits on newlines and subshell parentheses', () => {
    expect(splitSegments('cd x\n(git reset --hard)')).toEqual([['cd', 'x'], ['git', 'reset', '--hard']]);
  });
});

describe('findInvocations', () => {
  it('reads git global options, -C, and environment prefixes', () => {
    expect(findInvocations('GIT_PAGER=cat git -C ../other -c core.x=1 --no-pager switch feature')).toEqual([
      { program: 'git', dir: '../other', subcommand: 'switch', args: ['feature'] },
    ]);
  });

  it('finds gh pr checkout and ignores git mentioned as an argument', () => {
    expect(findInvocations('gh pr checkout 54 && echo git reset')).toEqual([
      { program: 'gh', dir: null, subcommand: 'pr checkout', args: ['54'] },
    ]);
  });
});

describe('violationOf', () => {
  const git = (subcommand, ...args) => violationOf({ program: 'git', subcommand, args });

  it('allows returning to main, fast-forward pulls, and read-only commands', () => {
    expect(git('switch', 'main')).toBeNull();
    expect(git('switch', '-q', 'main')).toBeNull();
    expect(git('checkout', 'main')).toBeNull();
    expect(git('pull', '--ff-only')).toBeNull();
    expect(git('stash', 'list')).toBeNull();
    for (const subcommand of ['status', 'log', 'diff', 'fetch', 'worktree', 'branch', 'push']) expect(git(subcommand)).toBeNull();
  });

  it('blocks switching to or creating other branches', () => {
    expect(git('switch', 'feature')).not.toBeNull();
    expect(git('switch', '-c', 'main')).not.toBeNull();
    expect(git('switch', '-')).not.toBeNull();
    expect(git('checkout', '-b', 'feature')).not.toBeNull();
    expect(git('checkout', 'main', '--', 'file.ts')).not.toBeNull();
    expect(git('checkout', '--', 'file.ts')).not.toBeNull();
    expect(violationOf({ program: 'gh', subcommand: 'pr checkout', args: ['54'] })).not.toBeNull();
  });

  it('blocks commands that rewrite the branch, the stash, or the working tree', () => {
    for (const subcommand of ['reset', 'rebase', 'merge', 'commit', 'cherry-pick', 'revert', 'restore', 'clean', 'am']) {
      expect(git(subcommand)).not.toBeNull();
    }
    expect(git('stash')).not.toBeNull();
    expect(git('stash', 'pop')).not.toBeNull();
    expect(git('pull')).not.toBeNull();
  });
});

describe('blockedReasons', () => {
  it('blocks in the main checkout only', () => {
    expect(reasonsAt(ROOT, 'git switch feature')).toHaveLength(1);
    expect(reasonsAt(WORKTREE, 'git switch feature')).toEqual([]);
    expect(reasonsAt(WORKTREE, 'git commit -m "x" && git rebase origin/main')).toEqual([]);
  });

  it('resolves git -C against the session directory', () => {
    expect(reasonsAt(WORKTREE, 'git -C /repo reset --hard')).toHaveLength(1);
    expect(reasonsAt(ROOT, 'git -C .claude/worktrees/feature commit -m x')).toEqual([]);
  });

  it('allows the cleanup steps in the main checkout', () => {
    expect(reasonsAt(ROOT, 'git switch main && git pull --ff-only && git worktree remove .claude/worktrees/x && git branch -d x')).toEqual([]);
  });

  it('ignores input without a command', () => {
    expect(blockedReasons({ cwd: ROOT, tool_input: {} }, isMain)).toEqual([]);
  });
});
