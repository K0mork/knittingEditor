"""xctraceの区間表を集約する。未対応の列を0件成功と取り違えない。"""
import collections
import re
import sys
import xml.etree.ElementTree as ET

NAMES = ('BridgeExportDecode', 'BridgeExportWrite', 'BridgeBackupRead',
         'BridgeBackupEncode', 'BridgeBackupJavaScript')


def summarize(root, hangs=False):
    ids = {e.attrib['id']: e for e in root.iter() if 'id' in e.attrib}
    columns = [c.findtext('mnemonic') for c in root.iter('col')]
    groups = collections.defaultdict(list)
    metadata = collections.defaultdict(set)
    for row in root.iter('row'):
        cells = dict(zip(columns, (ids.get(c.get('ref'), c) for c in row)))
        text = ' '.join((c.get('fmt', '') + ' ' + (c.text or '')) for c in cells.values())
        name = next((n for n in NAMES if n in text), None)
        if not name and (hangs or 'hang' in text.lower()):
            name = 'Hangs'
        if not name:
            continue
        duration = next((c for key, c in cells.items() if key and 'duration' in key), None)
        if duration is None or not (duration.text or '').isdigit():
            continue
        # xctrace durationの生値はns。fmtのローカライズ値は計算に使わない。
        groups[name].append(int(duration.text) / 1e9)
        metadata[name].update(re.findall(r'bytes=\d+(?: mime=[\w/+.-]+)?', text))
    if not groups:
        return '未集計: 対応する区間/duration列がありません。TOCと生XMLをInstrumentsで確認してください。'
    if 'Hangs' in groups:
        metadata['Hangs'].add('durationsSeconds=' + ','.join(f'{v:.6f}' for v in groups['Hangs']))
    return '\n'.join(f'{name}: count={len(values)} total={sum(values):.6f}s max={max(values):.6f}s '
                     f'metadata={sorted(metadata[name])}' for name, values in sorted(groups.items()))


if __name__ == '__main__':
    hangs = 'hang' in sys.argv[1].lower()
    result = summarize(ET.parse(sys.argv[1]).getroot(), hangs=hangs)
    print(result)
    if result.startswith('未集計:') and not hangs:
        sys.exit(1)
