import re
import sys
import xml.etree.ElementTree as ET

text = open(sys.argv[1], encoding='utf-8').read()
root = ET.fromstring(text[text.index('<?xml'):])
ids = {e.attrib['id']: e for e in root.iter() if 'id' in e.attrib}
resolve = lambda e: ids[e.attrib['ref']] if 'ref' in e.attrib else e
columns = [c.find('mnemonic').text for c in root.iter('col')]
peaks = {}
for row in root.iter('row'):
    cells = dict(zip(columns, (resolve(c) for c in row)))
    match = re.match(r'(.*) \((\d+)\)$', cells['process'].attrib.get('fmt', ''))
    if not match:
        continue
    name, pid = match.group(1), int(match.group(2))
    footprint = int(cells['memory-physical-footprint'].text)
    if footprint > peaks.get((name, pid), 0):
        peaks[(name, pid)] = footprint
apps = sorted(pid for name, pid in peaks if name == 'knittingEditor')
if not apps:
    sys.exit('ERROR: knittingEditor was not recorded in the trace')
print('最大メモリ（物理フットプリント）')
for app in apps:
    print(f'  knittingEditor ({app}): {peaks[("knittingEditor", app)] / 2**20:.1f} MiB')
print('WebKit全候補（他アプリ由来を含み得る。PIDの近接だけでは所属を断定しない）')
for (name, pid), footprint in sorted(peaks.items(), key=lambda item: item[0][1]):
    if name.startswith('com.apple.WebKit.'):
        print(f'  {name} ({pid}): {footprint / 2**20:.1f} MiB')
