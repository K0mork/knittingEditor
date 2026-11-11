# アプリアイコン

アプリアイコンは、Icon Composerの形式で[`ios/App/AppIcon.icon`](../../App/AppIcon.icon)に置く。iOS 26以降はLiquid Glassの層として描かれ、通常・ダーク・クリア・色付きの外観に対応する。XcodeはAppIconのアセットカタログの代わりにこのファイルを使い、大きさごとの画像とiOS 26より前に使う画像をビルド時に作る（[Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer)、[App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)）。

## 構成

- 背景は層にせず、`icon.json`で色を指定する。通常は深緑`#18482b`、ダークは`#0e2618`で、どちらもシステムの自動グラデーションを使う。
- 前景は1つのグループ`knitting`に、層`needles.svg`（針）と`yarn.svg`（糸）を入れる。どちらも1024×1024のSVGで、輪郭にした図形だけを描く。影・ぼかし・光沢は描かず、Liquid Glassに任せる。
- 糸は1本で、中央の輪はその糸のループ。2本の針がループを貫き、糸は輪の下で交差して左右へ抜ける。交差の上下は、下になる側の形を切り抜いて表す。針と糸を別のグループにすると、手前のグループの影が上下の関係と食い違うので、同じグループにする。
- Liquid Glassは層ごとに使う（グループは`individual`、光沢あり、影`neutral`0.5）。半透明は0.2に抑え、針と糸の色を保つ。

| 外観 | 背景 | 針 | 糸 |
|---|---|---|---|
| 通常 | `#18482b` | `#f8eed8` | `#ce683f` |
| ダーク | `#0e2618` | `#ece1c8` | `#d9774b` |
| モノ（クリア・色付き） | システム | 白 | 灰色（明るさ0.55） |

背景を画面のヘッダーの緑`#346f42`にしないのは、糸と背景の明るさの差が2.8:1から1.6:1に下がり、小さいサイズで糸が背景に沈むため（#433）。App Storeの画像（`../app-store-creative/universal.html`）は、アイコンと同じ深緑とクリームを使う。

CIのXcode 26.6で読めるよう、Icon Composer 2.0で加わった項目（`features`、`refractivity`、`blur-material`、`specular-highlight-placement`）は使わない。

## 編集と確認

Icon Composer（Xcodeの Open Developer Tool > Icon Composer）で`AppIcon.icon`を開いて編集する。層の形を変えるときは、1024×1024のSVGを書き出して差し替える。

```sh
node ios/scripts/check-app-icons.mjs
```

各外観は`ictool`で書き出して目で確かめる。`--rendition`は`Default`・`Dark`・`ClearLight`・`ClearDark`・`TintedLight`・`TintedDark`。

```sh
"/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool" ios/App/AppIcon.icon \
  --export-image --output-file /tmp/AppIcon-Default.png --platform iOS --rendition Default --width 1024 --height 1024 --scale 1
```

ビルドしたアプリは、`ios/scripts/check-app-bundle.sh`が、Liquid Glassの層（通常・ダーク・色付き）とiOS 26より前に使う画像が入っていることを確かめる。

## Webのアイコン

WebのfaviconとアイコンはLiquid Glassを使えないので、背景色の上に層を平らに重ねて作る。macOSでリポジトリルートから実行する。

```sh
node scripts/generate-web-icons.mjs
```

アイコンを変えたら、App Storeの画像も[`../../docs/SCREENSHOTS.md`](../../docs/SCREENSHOTS.md#製品ページのヘッダと検索結果)の手順で作り直す。
