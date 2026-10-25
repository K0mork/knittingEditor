// @vitest-environment node
import { expect, it } from 'vitest';
import { appBuild } from './app-build.mjs';

it('prefers the CI revision and truncates it to seven characters', () => {
  expect(appBuild('abcdef012345', () => { throw new Error(); })).toBe('abcdef0');
});
it('uses the local revision without a CI revision', () => {
  expect(appBuild('', () => '123456789')).toBe('1234567');
});
it('builds without git history', () => {
  expect(appBuild('', () => { throw new Error(); })).toBe('unknown');
  expect(appBuild('', () => '')).toBe('unknown');
});
