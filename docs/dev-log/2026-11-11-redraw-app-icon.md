# 2026-11-11 — アプリアイコンをIcon ComposerのLiquid Glass対応の形で描き直す

- 影響: アプリアイコンを、アセットカタログの1024×1024の画像3枚（Any・Dark・Tinted）から、Icon Composerの`ios/App/AppIcon.icon`に変えた。iOS 26以降は、針と糸の層にLiquid Glassが効き、通常・ダーク・クリア・色付きの外観で描かれる。iOS 26より前のiOS向けの画像は、Xcodeがビルド時にこのファイルから作る。絵は#433の決定に沿って描き直した。糸を1本につなげ、中央の輪をその糸のループ（朱色）にした。2本の針は直線にし、ループを貫く重なりにした。背景は深緑`#18482b`のまま。App Storeの画像の緑とクリームはアイコンにそろえた。Webのfavicon・192px・apple-touch-iconも、同じ層から作り直した。
- 主なファイル: `ios/App/AppIcon.icon/`、`ios/knittingEditor.xcodeproj/project.pbxproj`（XcodeGenで再生成）、`ios/scripts/check-app-icons.mjs`、`ios/scripts/check-app-bundle.sh`、`ios/scripts/check-release-assets.sh`、`scripts/generate-web-icons.mjs`、`ios/design/app-icon/README.md`、`ios/design/app-store-creative/universal.html`、`ios/docs/screenshots/app-store-creative-universal.png`、`public/favicon.ico`、`public/icon-192.png`、`public/apple-touch-icon.png`。`ios/App/Assets.xcassets/AppIcon.appiconset/`、`ios/design/app-icon/*.svg`、`scripts/generate-app-icons.mjs`は削除した。
- テスト: `scripts/check-app-icons.test.mjs`を書き換えた。`.icon`の検査で、ダークの背景、層のダーク・モノの色、Liquid Glass、グループ数（1〜4）、層のSVG（1024×1024、文字・画像・効果なし）、AppIconのアセットカタログが残っていないことを確かめる。`check-app-bundle.sh`は、ビルドしたアプリの`Assets.car`に、AppIconのLiquid Glassの層（通常・ダーク・色付き）と、iOS 26より前に使う`AppIcon60x60@2x.png`があることを確かめる。PRのCIのXcode 26.6でも、この検査が走る。
- 検証:
  - `node ios/scripts/check-app-icons.mjs`、`npx vitest run scripts/check-app-icons.test.mjs`（6件成功）、`sh ios/scripts/check-app-store-docs.sh`が成功した。
  - `xcodegen generate --spec ios/project.yml`（2.46.0）のあと、Xcode 27.2で`xcodebuild -scheme knittingEditor -destination 'generic/platform=iOS Simulator' build`が成功した。XcodeGenは`.icon`を`wrapper.icon`の種別で登録するが、actoolがアイコンとしてコンパイルした。ビルドしたアプリで`ios/scripts/check-app-bundle.sh`が成功した。
  - `ictool`で、通常・ダーク・クリア（ライト・ダーク）・色付き（ライト・ダーク）を、iOS 26と27の描き方で書き出して目で確かめた。KE verify iPhone（iOS 27.2 Simulator）のホーム画面で、通常の外観のアイコンを確かめた。
  - `node scripts/generate-web-icons.mjs`でWeb用アイコンを作り直した。App Storeの画像は`ios/docs/SCREENSHOTS.md`の手順で作り直し、5244×2950・透過なしであることを`sips`で確かめた。
  - `npm run typecheck`、`npm test`（1087件成功）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（647件成功、37件は対象外の構成でスキップ）が成功した。`dist/`にfavicon・192px・apple-touch-icon・`CNAME`が入っていることを確かめた。
  - 手元で確かめていないこと: Xcode 26.6でのビルド（PRのCIに任せる）。ホーム画面でのダーク・クリア・色付きと、iOS 26より前のiOSでの表示は、1.2のTestFlightで実機で確かめる（#439、`ios/docs/APP_STORE_CHECKLIST.md`）。
- デプロイ影響: Pagesのfavicon・192px・apple-touch-iconが変わる。配信後、`https://knittingeditor.com/`でfaviconが新しい絵になっていることを確かめる。アプリのアイコンは次のビルドの提出（1.2）で変わる。App Storeの画像は登録していない。
