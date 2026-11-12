// @vitest-environment node
import { expect, it } from 'vitest';
import { appBuild } from './app-build.mjs';

it('prefers the CI revision and truncates it to seven characters', () => {
  expect(appBuild('abcdef012345', () => { throw new Error(); })).toBe('gabcdef0');
});
it('uses the local revision without a CI revision', () => {
  expect(appBuild('', () => '123456789')).toBe('g1234567');
});
it('never yields a value that reads as a number', () => {
  for (const revision of ['8e13233abc', '250e612abc', '1234567abc']) {
    const build = appBuild(revision, () => { throw new Error(); });
    expect(build).toBe(`g${revision.slice(0, 7)}`);
    expect(Number.isNaN(Number(build))).toBe(true);
  }
});
it('builds without git history', () => {
  expect(appBuild('', () => { throw new Error(); })).toBe('unknown');
  expect(appBuild('', () => '')).toBe('unknown');
});
