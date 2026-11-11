// アプリアイコン（Icon Composerの`App/AppIcon.icon`）が、Liquid Glassの層と外観の決まりを満たすか確かめる。
//   node ios/scripts/check-app-icons.mjs
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// 色を指定する外観。モノ（クリア・色付き）は`tinted`。
const APPEARANCES = ['dark', 'tinted'];

export function checkLayerSvg(svg, name) {
  if (!/<svg\b[^>]*\bviewBox="0 0 1024 1024"/.test(svg)) throw new Error(`${name} must use the 1024x1024 canvas`);
  // 文字・画像・効果は層に入れず、輪郭にした図形だけにする（効果はLiquid Glassに任せる）。
  if (/<(text|image|mask|filter|foreignObject|linearGradient|radialGradient)\b/.test(svg)) throw new Error(`${name} must contain only outlined vector shapes`);
}

export function checkIconDocument(directory) {
  const document = JSON.parse(readFileSync(resolve(directory, 'icon.json'), 'utf8'));
  const fills = document['fill-specializations'] ?? [];
  if (!fills.some(entry => !entry.appearance && typeof entry.value === 'object')) throw new Error('Missing background fill');
  if (!fills.some(entry => entry.appearance === 'dark' && typeof entry.value === 'object')) throw new Error('Missing dark background fill');
  const squares = document['supported-platforms']?.squares;
  if (squares !== 'shared' && !(Array.isArray(squares) && squares.includes('iOS'))) throw new Error('The icon must support iOS');
  const groups = document.groups ?? [];
  if (groups.length < 1 || groups.length > 4) throw new Error('Expected one to four layer groups');
  for (const group of groups) {
    if (!group.layers?.length) throw new Error(`Group ${group.name} has no layers`);
    for (const layer of group.layers) {
      const image = layer['image-name'];
      if (!image?.endsWith('.svg')) throw new Error(`${layer.name} must use an SVG layer`);
      if (layer.glass !== true) throw new Error(`${layer.name} must use Liquid Glass`);
      for (const appearance of APPEARANCES) {
        if (!layer['fill-specializations']?.some(entry => entry.appearance === appearance)) throw new Error(`${layer.name} is missing a ${appearance} fill`);
      }
      const path = resolve(directory, 'Assets', image);
      if (!existsSync(path)) throw new Error(`Missing layer image ${image}`);
      checkLayerSvg(readFileSync(path, 'utf8'), image);
    }
  }
}

export function checkProject(iosRoot) {
  // Icon Composerのファイルがあると、XcodeはAppIconのアセットカタログを使わない。残すと取り違えるので置かない。
  if (existsSync(resolve(iosRoot, 'App/Assets.xcassets/AppIcon.appiconset'))) throw new Error('Remove AppIcon.appiconset; App/AppIcon.icon replaces it');
  const project = readFileSync(resolve(iosRoot, 'knittingEditor.xcodeproj/project.pbxproj'), 'utf8');
  if (!project.includes('/* AppIcon.icon in Resources */')) throw new Error('AppIcon.icon is not in the app resources; run xcodegen generate');
  if (!project.includes('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;')) throw new Error('The app icon name must be AppIcon');
  checkIconDocument(resolve(iosRoot, 'App/AppIcon.icon'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkProject(fileURLToPath(new URL('..', import.meta.url)));
  console.log('AppIcon.icon has Liquid Glass layers with dark and tinted appearances');
}
