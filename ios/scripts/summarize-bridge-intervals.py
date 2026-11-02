"""ブリッジ計測の結果を集約する。

  summarize-bridge-intervals.py <bridge-io-intervals.tsv>
      DEBUGビルドのアプリが書いた区間ファイル（BridgeIntervalLog）を区間名ごとに集計する。
      ファイルが無い、または有効な行が無いときは失敗する。
  summarize-bridge-intervals.py --hangs <xctraceのhang表のXML>...
      アプリとWebKitのプロセスの行を表示する。表示できなくても失敗しない。

xctraceのos_signpost表は開始・終了のイベント表で所要時間の列を持たず、UIテスト中は
XCUITestのsignpostでアプリのバッファがあふれて前半の区間が落ちるため、所要時間は区間ファイルから読む。
"""
import collections
import re
import sys
import xml.etree.ElementTree as ET

PROCESS_PREFIXES = ('knittingEditor', 'com.apple.WebKit')


def parse_intervals(text):
    """`名前<TAB>ミリ秒<TAB>バイト数<TAB>MIME<TAB>終了時刻`の行を読む。読めない行は数だけ返す。"""
    rows, invalid = [], 0
    for line in text.splitlines():
        if not line.strip():
            continue
        fields = line.split('\t')
        try:
            if len(fields) != 5 or not fields[0]:
                raise ValueError(line)
            rows.append({'name': fields[0], 'ms': float(fields[1]), 'bytes': int(fields[2]),
                         'mime': fields[3], 'end': fields[4]})
        except ValueError:
            invalid += 1
    return rows, invalid


def summarize_intervals(text):
    rows, invalid = parse_intervals(text)
    if not rows:
        return None
    groups = collections.defaultdict(list)
    for row in rows:
        groups[row['name']].append(row)
    lines = ['ブリッジ区間（DEBUGの区間ファイル、ms）']
    for name, items in sorted(groups.items()):
        values = [item['ms'] for item in items]
        occurrences = ', '.join(f"{item['bytes']}({item['mime']})" for item in items)
        lines.append(f'  {name}: count={len(items)} total={sum(values):.3f}ms max={max(values):.3f}ms '
                     f'bytes=[{occurrences}]')
    if invalid:
        lines.append(f'  読めない行: {invalid}')
    return '\n'.join(lines)


def _load_xml(path):
    text = open(path, encoding='utf-8').read()
    start = text.find('<?xml')
    return ET.fromstring(text[start:] if start >= 0 else text)


def summarize_hangs(root, label):
    """アプリとWebKitのプロセスの行を表示する。durationの生値はns。"""
    ids = {e.attrib['id']: e for e in root.iter() if 'id' in e.attrib}
    resolve = lambda e: ids.get(e.attrib['ref'], e) if 'ref' in e.attrib else e
    columns = [c.findtext('mnemonic') or '' for c in root.iter('col')]
    duration_key = next((key for key in columns if 'duration' in key), None)
    rows = list(root.iter('row'))
    lines = [f'{label}: {len(rows)}行']
    if duration_key is None:
        lines.append('  duration列がありません。Instrumentsで確認してください。')
        return '\n'.join(lines)
    matched = 0
    for row in rows:
        cells = dict(zip(columns, (resolve(c) for c in row)))
        process = cells.get('process')
        name = process.get('fmt', '') if process is not None else ''
        if not re.sub(r' \(\d+\)$', '', name).startswith(PROCESS_PREFIXES):
            continue
        matched += 1
        duration = cells.get(duration_key)
        raw = (duration.text or '').strip() if duration is not None else ''
        value = f'{int(raw) / 1e6:.3f}ms' if raw.isdigit() else (duration.get('fmt', '?') if duration is not None else '?')
        start = cells.get('start')
        when = f" start={start.get('fmt', '')}" if start is not None else ''
        lines.append(f'  {name} duration={value}{when}')
    if not matched:
        lines.append('  knittingEditor/WebKitの行はありません。')
    return '\n'.join(lines)


def main(argv):
    if len(argv) >= 2 and argv[0] == '--hangs':
        for path in argv[1:]:
            try:
                print(summarize_hangs(_load_xml(path), path.rsplit('/', 1)[-1]))
            except (OSError, ET.ParseError) as error:
                print(f'{path}: 読めません（{error}）。Instrumentsで確認してください。')
        return 0
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        text = open(argv[0], encoding='utf-8').read()
    except OSError as error:
        print(f'ERROR: 区間ファイルを読めません: {error}', file=sys.stderr)
        return 1
    result = summarize_intervals(text)
    if result is None:
        print('ERROR: 区間ファイルに有効な行がありません。', file=sys.stderr)
        return 1
    print(result)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
