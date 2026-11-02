import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

const script = 'ios/scripts/summarize-bridge-intervals.py';

function withFile(name, content, run) {
  const directory = mkdtempSync(join(tmpdir(), 'bridge-intervals-'));
  try {
    const file = join(directory, name);
    writeFileSync(file, content);
    return run(file);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

const python = (args) => execFileSync('/usr/bin/python3', ['-B', script, ...args], { encoding: 'utf8' });

it('summarizes the interval file by name with counts, totals, maxima, and bytes of each occurrence', () => {
  const tsv = [
    'BridgeExportWrite\t2000.500\t42\timage/png\t2026-11-02T00:00:01.000Z',
    'BridgeExportWrite\t1000.250\t7\tapplication/pdf\t2026-11-02T00:00:02.000Z',
    'BridgeBackupRead\t12.000\t3959865\tapplication/gzip\t2026-11-02T00:00:03.000Z',
    'broken line',
    '',
  ].join('\n');
  const result = withFile('intervals.tsv', tsv, (file) => python([file]));
  expect(result).toContain('BridgeExportWrite: count=2 total=3000.750ms max=2000.500ms bytes=[42(image/png), 7(application/pdf)]');
  expect(result).toContain('BridgeBackupRead: count=1 total=12.000ms max=12.000ms bytes=[3959865(application/gzip)]');
  expect(result).toContain('読めない行: 1');
  expect(result.indexOf('BridgeBackupRead')).toBeLessThan(result.indexOf('BridgeExportWrite'));
});

it('fails when the interval file is missing or has no valid rows', () => {
  expect(() => python([join(tmpdir(), 'missing-bridge-io-intervals.tsv')])).toThrow();
  expect(() => withFile('intervals.tsv', 'BridgeExportWrite\tnot-a-number\t1\tx\ty\n', (file) => python([file]))).toThrow();
});

it('lists hang rows of the app and WebKit with durations and never fails on unreadable tables', () => {
  const xml = `<?xml version="1.0"?><trace-query-result><node><schema name="potential-hangs">
<col><mnemonic>start</mnemonic></col><col><mnemonic>duration</mnemonic></col><col><mnemonic>process</mnemonic></col>
<row><start-time fmt="00:12.345">12345</start-time><duration>250000000</duration><process id="1" fmt="knittingEditor (501)"/></row>
<row><start-time fmt="00:20.000">20000</start-time><duration>500000000</duration><process fmt="com.apple.WebKit.WebContent (502)"/></row>
<row><start-time fmt="00:21.000">21000</start-time><duration>900000000</duration><process fmt="SpringBoard (34)"/></row>
<row><start-time fmt="00:22.000">22000</start-time><duration>100000000</duration><process ref="1"/></row>
</schema></node></trace-query-result>`;
  const result = withFile('potential-hangs.xml', xml, (file) => python(['--hangs', file]));
  expect(result).toContain('potential-hangs.xml: 4行');
  expect(result).toContain('knittingEditor (501) duration=250.000ms start=00:12.345');
  expect(result).toContain('com.apple.WebKit.WebContent (502) duration=500.000ms');
  expect(result).toContain('knittingEditor (501) duration=100.000ms');
  expect(result).not.toContain('SpringBoard');

  const noDuration = withFile('hang-risks.xml', '<root><col><mnemonic>process</mnemonic></col><row><process fmt="knittingEditor (1)"/></row></root>',
    (file) => python(['--hangs', file]));
  expect(noDuration).toContain('hang-risks.xml: 1行');
  expect(noDuration).toContain('Instrumentsで確認');
  expect(withFile('broken.xml', '<root', (file) => python(['--hangs', file]))).toContain('Instrumentsで確認');
});
