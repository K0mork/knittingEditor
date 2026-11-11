// App Store Connectに登録するスクリーンショットを、画面の画像（ios/design/app-store-screenshots/screens/）と
// Appleの製品ベゼルから作り直す。CIでは実行せず、生成したファイルをコミットする。
// ベゼルはAppleのデザインリソース（https://developer.apple.com/design/resources/）の「iPhone 18」「iPhone Duo」
// 「iPad Pro (M5)」をダウンロードし、ディスクイメージを開いて利用許諾に同意したうえで、開いたボリュームから読む。
// ベゼルはリポジトリに入れない。文字はヒラギノ丸ゴを使い、6.3インチは sips で縮小するため macOS で実行する。
//   node scripts/generate-app-store-screenshots.mjs
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCREENS = fileURLToPath(new URL('../ios/design/app-store-screenshots/screens/', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../ios/docs/screenshots/', import.meta.url));
const BACKGROUND = '#f8eed8';
const TEXT = '#18482b';
// 画面の上の説明文の領域の高さと、端末の下の余白（画像の高さに対する割合）。
const CAPTION_AREA = 0.16;
const BOTTOM_MARGIN = 0.035;

// bezel: ベゼルの画像 / opening: ベゼルの中の画面の位置と大きさ / radius: 画面の角（左上・右上・右下・左下）。
// 画面の画像はopeningの角で切り取る。角がベゼルの外へはみ出さず、ベゼルの穴より内側に収まる大きさにしてある。
// font: 説明文の大きさ（幅1500未満は幅の6.8%、それ以上は5%）。
const DEVICES = {
  'iphone-6.9': {
    canvas: [1320, 2868],
    bezel: '/Volumes/Bezel-iPhone-18/PNG/iPhone 18 Pro Max/iPhone 18 Pro Max - Black - Portrait.png',
    opening: [75, 66, 1320, 2868],
    radius: [170, 170, 170, 170],
    font: 90,
  },
  'ipad-13': {
    canvas: [2064, 2752],
    bezel: '/Volumes/Bezel-iPad-Pro-(M5)/PNG/iPad Pro (M5) 13" - Space Black - Portrait.png',
    opening: [118, 124, 2064, 2752],
    radius: [50, 50, 50, 50],
    font: 103,
  },
  'iphone-duo-outer': {
    canvas: [1398, 2034],
    bezel: '/Volumes/Bezel-iPhone-Duo/PNG/iPhone Duo - Night Sky - Outer Closed Portrait.png',
    opening: [88, 80, 1398, 2034],
    radius: [20, 150, 150, 20],
    font: 95,
  },
  'iphone-duo-inner': {
    canvas: [2007, 2853],
    bezel: '/Volumes/Bezel-iPhone-Duo/PNG/iPhone Duo - Night Sky - Inner Open Portrait.png',
    opening: [120, 120, 2007, 2853],
    radius: [140, 140, 140, 140],
    font: 100,
  },
};

const SHOTS = {
  '01-editor': '29種類の編み目記号で作る',
  '02-stitches': '記号は一覧から選ぶだけ',
  '03-export': 'PDFにしてA4で印刷',
  '04-background': '背景色を変えて見やすく',
  '05-dark': 'ダークモードにも対応',
};

if (process.platform !== 'darwin') {
  throw new Error('スクリーンショットはヒラギノ丸ゴと sips を使うため macOS で生成してください');
}
for (const { bezel } of Object.values(DEVICES)) {
  if (!existsSync(bezel)) {
    throw new Error(`ベゼルが見つかりません: ${bezel}\nAppleのデザインリソースからダウンロードし、ディスクイメージを開いてください（ios/docs/SCREENSHOTS.md）`);
  }
}

const dataUrl = path => 'data:image/png;base64,' + readFileSync(path).toString('base64');

function pngSize(path) {
  const png = readFileSync(path);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function page(device, shot) {
  const { canvas: [width, height], bezel, opening: [x, y, w, h], radius, font } = DEVICES[device];
  const [bezelWidth, bezelHeight] = pngSize(bezel);
  const captionArea = Math.round(height * CAPTION_AREA);
  // 端末は説明文の下に、縦横比を保って縮小し、左右中央に置く。ベゼルは切り取らない。
  const scale = Math.min((height - captionArea - height * BOTTOM_MARGIN) / bezelHeight, (width * 0.9) / bezelWidth);
  const px = value => `${value * scale}px`;
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;width:${width}px;height:${height}px;background:${BACKGROUND};position:relative;overflow:hidden}
    .caption{position:absolute;left:0;right:0;top:${captionArea / 2}px;transform:translateY(-50%);text-align:center;color:${TEXT};font:${font}px "Hiragino Maru Gothic ProN"}
    .device{position:absolute;left:${(width - bezelWidth * scale) / 2}px;top:${captionArea}px;width:${px(bezelWidth)};height:${px(bezelHeight)}}
    .device img{position:absolute}
  </style>
  <div class="caption">${SHOTS[shot]}</div>
  <div class="device">
    <img src="${dataUrl(join(SCREENS, `${device}-${shot}.png`))}" style="left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};border-radius:${radius.map(px).join(' ')}">
    <img src="${dataUrl(bezel)}" style="left:0;top:0;width:${px(bezelWidth)};height:${px(bezelHeight)}">
  </div>`;
}

const browser = await chromium.launch();
try {
  for (const device of Object.keys(DEVICES)) {
    const [width, height] = DEVICES[device].canvas;
    const tab = await browser.newPage({ viewport: { width, height } });
    for (const shot of Object.keys(SHOTS)) {
      await tab.setContent(page(device, shot));
      await tab.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode()));
      });
      const output = join(OUTPUT, `app-store-${device}-${shot}.png`);
      await tab.screenshot({ path: output });
      console.log(output);
    }
    await tab.close();
  }
} finally {
  await browser.close();
}

// App Store ConnectのiPhoneの欄に登録する6.3インチは、6.9インチを縮小して幅を1ピクセル削る（縦横比がほぼ同じ）。
for (const shot of Object.keys(SHOTS)) {
  const output = join(OUTPUT, `app-store-iphone-6.3-${shot}.png`);
  execFileSync('sips', ['--resampleHeight', '2622', join(OUTPUT, `app-store-iphone-6.9-${shot}.png`), '--out', output], { stdio: 'ignore' });
  execFileSync('sips', ['--cropToHeightWidth', '2622', '1206', output], { stdio: 'ignore' });
  console.log(output);
}
