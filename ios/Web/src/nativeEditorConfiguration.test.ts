import { afterEach, describe, expect, it } from 'vitest';
import { nativeAutosaveDelayMs } from './nativeEditorConfiguration';

afterEach(() => { delete window.knittingEditorDebugConfiguration; });

describe('nativeAutosaveDelayMs', () => {
  it('keeps the default without native configuration', () => {
    expect(nativeAutosaveDelayMs()).toBeUndefined();
  });
  it.each([0, 400, 3_600_000, 2_147_483_647])('accepts native delay %s', (value) => {
    window.knittingEditorDebugConfiguration = { autosaveDelayMs: value };
    expect(nativeAutosaveDelayMs()).toBe(value);
  });
  it.each([-1, 1.5, NaN, Infinity, 2_147_483_648, '400', undefined])('rejects invalid delay %s', (value) => {
    window.knittingEditorDebugConfiguration = { autosaveDelayMs: value };
    expect(nativeAutosaveDelayMs()).toBeUndefined();
  });
});
