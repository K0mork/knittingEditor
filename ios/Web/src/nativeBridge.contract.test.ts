// @vitest-environment node
import { describe, expect, it } from 'vitest';
import swiftCommands from '../../App/EditorCommands.swift?raw';
import swiftMessages from '../../App/NativeBridgeMessage.swift?raw';
import swiftHost from '../../App/WebViewContainer.swift?raw';
import tsBridge from './nativeBridge.ts?raw';

const swiftApp = Object.values(import.meta.glob('../../App/*.swift', {
  query: '?raw', import: 'default', eager: true,
})).join('\n');

function requiredMatch(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  expect(match, `契約定義が見つからない: ${pattern}`).not.toBeNull();
  return match![1];
}

function names(source: string, pattern: RegExp): string[] {
  const result = [...new Set([...source.matchAll(pattern)].map((match) => match[1] ?? match[2]))].sort();
  expect(result.length, '空の契約一覧を比較しない').toBeGreaterThan(0);
  return result;
}

describe('Swift / TypeScript native bridge contract', () => {
  it('matches EditorCommand raw values against NATIVE_COMMANDS', () => {
    const cases = requiredMatch(swiftCommands, /enum EditorCommand:[^{]+\{([\s\S]*?)static let eventName/);
    const commands = requiredMatch(tsBridge, /export const NATIVE_COMMANDS\s*=\s*\[([\s\S]*?)\] as const/);
    // 別名を付ける場合も実際の送信値を比較する。
    expect(names(cases, /^\s*case\s+\w+\s*=\s*"([^"]+)"|^\s*case\s+(\w+)/gm))
      .toEqual(names(commands, /'([^']+)'/g));
  });

  it('matches every native event name in both implementations', () => {
    expect(names(swiftApp, /["'](knittingEditorNative\w+)["']/g))
      .toEqual(names(tsBridge, /["'](knittingEditorNative\w+)["']/g));
  });

  it('matches Web-to-native message types and the handler name', () => {
    const types = requiredMatch(tsBridge, /interface NativeBridgeMessage\s*\{[\s\S]*?type:\s*([^;]+);/);
    expect(names(swiftMessages, /case "([^"]+)":/g)).toEqual(names(types, /'([^']+)'/g));
    expect(requiredMatch(swiftHost, /static let messageHandlerName = "([^"]+)"/))
      .toBe(requiredMatch(tsBridge, /return window\.webkit\?\.messageHandlers\?\.(\w+)/));
  });
});
