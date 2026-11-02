import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('resolves xctrace references and reports interval durations and safe metadata', () => {
  const code = `import importlib.util, xml.etree.ElementTree as ET
spec = importlib.util.spec_from_file_location('summary', 'ios/scripts/summarize-bridge-intervals.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
root = ET.fromstring('<root><col><mnemonic>name</mnemonic></col><col><mnemonic>duration</mnemonic></col><col><mnemonic>message</mnemonic></col><row><s id="1">BridgeExportWrite</s><duration>2000000000</duration><s>bytes=42 mime=image/png</s></row><row><s ref="1"/><duration>1000000000</duration><s/></row></root>')
print(m.summarize(root))
print(m.summarize(ET.fromstring('<root/>')))
`;
  const result = execFileSync('/usr/bin/python3', ['-B', '-c', code], { encoding: 'utf8' });
  expect(result).toContain('count=2 total=3.000000s max=2.000000s');
  expect(result).toContain('bytes=42 mime=image/png');
  expect(result).toContain('未集計');
});

it('fails the CLI when a signpost table has no supported intervals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bridge-intervals-'));
  try {
    const file = join(directory, 'signposts.xml');
    writeFileSync(file, '<root/>');
    expect(() => execFileSync('/usr/bin/python3', ['-B', 'ios/scripts/summarize-bridge-intervals.py', file])).toThrow();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
