import { describe, expect, it } from 'vitest';
import { decide, isPathInUse, parseLsofCwds, parseWorktrees } from './clean-worktrees.mjs';

describe('parseWorktrees', () => {
  it('reads branches and detached worktrees from porcelain output', () => {
    const porcelain = [
      'worktree /repo\nHEAD aaa\nbranch refs/heads/main',
      'worktree /repo/.claude/worktrees/x\nHEAD bbb\nbranch refs/heads/fix/x',
      'worktree /tmp/detached\nHEAD ccc\ndetached',
    ].join('\n\n');
    expect(parseWorktrees(porcelain)).toEqual([
      { path: '/repo', head: 'aaa', branch: 'main' },
      { path: '/repo/.claude/worktrees/x', head: 'bbb', branch: 'fix/x' },
      { path: '/tmp/detached', head: 'ccc', branch: null },
    ]);
  });
});

describe('decide', () => {
  const merged = { number: 7, state: 'MERGED', headIsTipOrDescendant: true };

  it('removes work that is in origin/main or matches a closed PR head', () => {
    expect(decide({ inMain: true, pr: null }).remove).toBe(true);
    expect(decide({ inMain: true, pr: merged }).remove).toBe(true);
    expect(decide({ inMain: false, pr: merged }).remove).toBe(true);
    expect(decide({ inMain: false, pr: { ...merged, state: 'CLOSED' } }).remove).toBe(true);
  });

  it('keeps open PRs, unpushed commits, uncommitted changes, and worktrees in use', () => {
    expect(decide({ inMain: true, pr: { ...merged, state: 'OPEN' } })).toEqual({ remove: false, reason: 'PR #7 is open' });
    expect(decide({ inMain: false, pr: { ...merged, headIsTipOrDescendant: false } }).remove).toBe(false);
    expect(decide({ inMain: false, pr: null }).remove).toBe(false);
    expect(decide({ inMain: true, pr: merged, dirty: true })).toEqual({ remove: false, reason: 'uncommitted changes' });
    expect(decide({ inMain: true, pr: merged, inUse: true })).toEqual({ remove: false, reason: 'in use by a running process' });
  });
});

describe('process working directories', () => {
  it('reads cwd lines from lsof -F n output', () => {
    expect(parseLsofCwds('p123\nfcwd\nn/repo/.claude/worktrees/x\np456\nfcwd\nn/tmp\n')).toEqual(['/repo/.claude/worktrees/x', '/tmp']);
  });

  it('treats a worktree as in use when a process works inside it', () => {
    expect(isPathInUse('/repo/.claude/worktrees/x', ['/repo/.claude/worktrees/x/src'])).toBe(true);
    expect(isPathInUse('/repo/.claude/worktrees/x', ['/repo/.claude/worktrees/x'])).toBe(true);
    expect(isPathInUse('/repo/.claude/worktrees/x', ['/repo/.claude/worktrees/x2', '/repo'])).toBe(false);
  });
});
