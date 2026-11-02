// @vitest-environment node
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decide, isPathInUse, parseLsofCwds, parseWorktrees, planWorktrees, processCwds } from './clean-worktrees.mjs';

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

describe('planWorktrees', () => {
  const parent = { path: '/repo/.claude/worktrees/parent', head: 'aaa', branch: null };
  const child = { path: '/repo/.claude/worktrees/parent/.claude/worktrees/child', head: 'bbb', branch: null };
  const sibling = { path: '/repo/.claude/worktrees/parent-2', head: 'ccc', branch: null };
  const removable = { inMain: true, pr: null };

  it('keeps a removable worktree that contains a kept nested worktree', () => {
    const plans = planWorktrees([parent, child], (worktree) => (worktree === child ? { ...removable, dirty: true } : removable));
    expect(plans).toEqual([
      { worktree: parent, decision: { remove: false, reason: `contains the kept nested worktree ${child.path}` } },
      { worktree: child, decision: { remove: false, reason: 'uncommitted changes' } },
    ]);
  });

  it('keeps every ancestor of a kept worktree, whatever the listing order', () => {
    const grandchild = { path: `${child.path}/.claude/worktrees/grandchild`, head: 'ddd', branch: null };
    const plans = planWorktrees([grandchild, child, parent], (worktree) => (worktree === grandchild ? { ...removable, inUse: true } : removable));
    expect(plans.map(({ decision }) => decision.remove)).toEqual([false, false, false]);
    expect(plans[2].decision.reason).toBe(`contains the kept nested worktree ${grandchild.path}`);
  });

  it('still removes parents whose nested worktrees are removed too, and ignores sibling paths that share a prefix', () => {
    expect(planWorktrees([parent, child], () => removable).map(({ decision }) => decision.remove)).toEqual([true, true]);
    const plans = planWorktrees([parent, sibling], (worktree) => (worktree === sibling ? { ...removable, dirty: true } : removable));
    expect(plans.map(({ decision }) => decision.remove)).toEqual([true, false]);
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

describe('processCwds with a fake lsof', () => {
  let fakeBin;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (fakeBin) rmSync(fakeBin, { recursive: true, force: true });
    fakeBin = undefined;
  });

  function fakeLsof(output, exitCode) {
    fakeBin = mkdtempSync(join(tmpdir(), 'clean-worktrees-lsof-'));
    writeFileSync(join(fakeBin, 'lsof'), `#!/bin/sh\nprintf '%s' '${output}'\nexit ${exitCode}\n`, { mode: 0o755 });
    vi.stubEnv('PATH', fakeBin);
  }

  function decisionFor(path, result) {
    return decide({
      inMain: true,
      pr: null,
      inUse: isPathInUse(path, result.cwds),
      processCwdsKnown: result.complete,
    });
  }

  it('keeps partial stdout and skips removal when lsof exits with 1', () => {
    fakeLsof('p123\nfcwd\nn/repo/.claude/worktrees/x\n', 1);
    const result = processCwds();
    expect(result.complete).toBe(false);
    expect(result.cwds).toContain('/repo/.claude/worktrees/x');
    expect(decisionFor('/repo/.claude/worktrees/x', result).remove).toBe(false);
    expect(decisionFor('/repo/.claude/worktrees/unreported', result)).toEqual({
      remove: false,
      reason: 'process working directories could not be determined',
    });
    expect(result.cwds).toContain(realpathSync(process.cwd()));
  });

  it('skips removal when lsof fails without stdout', () => {
    fakeLsof('', 1);
    const result = processCwds();
    expect(result.complete).toBe(false);
    expect(decisionFor('/repo/.claude/worktrees/x', result).remove).toBe(false);
  });

  it('skips removal when lsof cannot be executed', () => {
    fakeBin = mkdtempSync(join(tmpdir(), 'clean-worktrees-lsof-'));
    vi.stubEnv('PATH', fakeBin);
    const result = processCwds();
    expect(result.complete).toBe(false);
    expect(result.cwds).toContain(realpathSync(process.cwd()));
    expect(decisionFor('/repo/.claude/worktrees/x', result).remove).toBe(false);
  });

  it('preserves normal decisions and always protects its own working directory', () => {
    fakeLsof('p123\nfcwd\nn/repo/.claude/worktrees/x\n', 0);
    const result = processCwds();
    expect(result.complete).toBe(true);
    expect(decisionFor('/repo/.claude/worktrees/x', result).remove).toBe(false);
    expect(decisionFor('/repo/.claude/worktrees/unused', result).remove).toBe(true);
    expect(decisionFor(realpathSync(process.cwd()), result).remove).toBe(false);
  });
});
