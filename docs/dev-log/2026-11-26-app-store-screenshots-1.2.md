# 2026-11-26 — App Storeのスクリーンショットを1.2の画面で撮り直す（#503）

- 影響: App Store Connectに登録するスクリーンショットと製品ページ用画像を、1.2の画面で撮り直した。iPhone 6.9インチとiPad 13インチの5画面には、ツールバーの「線」（#296）、iPadの盤面設定の背景色の見本の並び（#96）、出力パネルの「クレジットを入れる」（#487）が写る。iPhone Duoは外側の5枚と内側の03を撮り直した。外側の01・02・04・05は#503では今の画面と同じとしていたが、撮ると記号のボタンの「表目」が2行に折り返して写り、古い画像と違ったので撮り直した（記号名を省略せず折り返すようにした2026-11-04の変更による）。内側の01・02・04・05は今の画面と見え方が同じなので、そのまま使う。説明文と枠の決まりは変えていない。アプリとWebの動作は変えていない。
- 主なファイル:
  - `ios/design/app-store-screenshots/screens/`: iPhone 6.9インチとiPad 13インチの5枚、iPhone Duoの外側5枚と内側の03。
  - `ios/docs/screenshots/`: 作り直した枠付きの21枚（6.3インチの5枚を含む）と`app-store-creative-universal.png`。iPhone Duoの内側の01・02・04・05は、作り直しても同じ画像になった。
  - `ios/docs/SCREENSHOTS.md`: 取得条件を今回の撮影に合わせた。
- テスト: なし（画像と文書だけ）。
- 検証（Node v26.8.1、Xcode 27.2（27B52））:
  - 撮影: `main`の`cd59d8c`をRelease設定でSimulator向けにビルドした。iPhone 18 Pro MaxとiPad Pro 13-inch (M5)（どちらもiOS 27.2）は撮影用に作り、撮影のあとで削除した。iPhone Duoは使い回しの「KE verify iPhone Duo」（iOS 27.2）で撮り、撮影のあとでアプリを消した。
  - `node scripts/generate-app-store-screenshots.mjs`と、`SCREENSHOTS.md`の`npx playwright screenshot`のコマンドで作り直し、端末ごとに5枚を並べて目で確かめた。
  - `sh ios/scripts/check-app-store-docs.sh`: 成功。
  - `sh ios/scripts/check-release-assets.sh <上のReleaseの.app>`: 成功。
  - `node scripts/check-pr-smoke-ui-tests.mjs`、`git diff --check`: 成功。
  - `npm test -- scripts`: 24ファイル・333件成功。
  - App Store Connectの1.2の版（提出準備中）で、「Dynamic Island搭載iPhone（中型ディスプレイ）」に6.3インチの5枚、「iPad 13インチディスプレイ」に13インチの5枚、「iPhone Duo」に外側の5枚を、古い画像と入れ替えて登録した。読み込み直して、3つの欄に5枚ずつが順に登録されていることを確かめた。デバイスプレビューで、iPhone・iPad・iPhone Duoの製品ページに新しい画像が出て、説明文と枠が切れていないことを確かめた。製品ページ用画像（ヘッダと検索結果）は、1.0のときの判断のまま登録していない。
- デプロイ影響: なし。文書と画像だけで、Pagesの配信物もアプリも変わらない。App Store Connectの1.2の版の画像は差し替え済み。
