# アプリアイコン素材

元のアイコンの緑・クリーム色の針・朱色の糸を、背景`background.svg`と前景`foreground.svg`に書き起こした。前景には針と糸のグループがあり、交差する部分の隙間を小サイズでも保つ。

macOSで、Node.js 24以降、Playwright Chromium、macOS標準の`sips`を用意し、リポジトリルートで次を実行する。`generate-web-icons.mjs`は`sips`で縮小するため、macOS以外では実行できない。

```sh
npm ci
npx playwright install chromium
node scripts/generate-app-icons.mjs
node scripts/generate-web-icons.mjs
node ios/scripts/check-app-icons.mjs
```

- Any: 緑の背景を合成したRGB。iOS 17とWebの共通デザイン。
- Dark: 背景が透明なRGBA。背景の描画はシステムへ任せる。
- Tinted: 黒背景に白い針と灰色の糸を描いたRGB。システムが色を付けるため、全画素でR=G=B。

`AppIcon.appiconset`のSingle Size方式を使用し、小サイズはXcodeが生成する。Webのfavicon（16/32/48px）・192px・apple-touch-icon（180px）はAnyから再生成する。PNGは納品用の登録アセットとしてコミットする。

Issue #78で認められているAny/Dark/Tinted方式を採用した。Icon Composerの`.icon`とクリア専用レイヤーは含まない。iOS 26以降のクリア外観はシステムの変換に依存し、専用対応として検証済みとは扱わない。

参考: [Apple: Configuring your app icon using an asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)、[App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)。
