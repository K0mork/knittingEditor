import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('encodes a known value', () => {
    expect(bytesToBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=');
    expect(new TextDecoder().decode(base64ToBytes('aGVsbG8='))).toBe('hello');
  });

  it('round-trips bytes larger than one conversion chunk', () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 17 }, (_, index) => index % 256);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('rejects malformed input', () => {
    expect(() => base64ToBytes('%%%')).toThrow();
  });
});
