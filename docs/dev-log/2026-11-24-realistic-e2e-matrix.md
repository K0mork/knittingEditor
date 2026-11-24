# 2026-11-24 — E2Eを、その状況が実在する端末・ブラウザだけで実行する

- 影響: これまで全E2EをChromium mobile（Pixel 7）・WebKit mobile（iPhone 14）・Chromium desktopの3つで流していた。テスト自身が画面幅や文字サイズを決めるものは、1280px幅のAndroidスマホや390px幅のPCのように、存在しない組み合わせまで流していた。テストにタグを付け、その状況があるプロジェクトだけで流すようにした（753件→508件）。
  - `@phone`（スマホの幅）はPCで、`@wide`（タブレット・PCの幅）はAndroidスマホで流さない。
  - `@webkit-only`（iOS版のCSS、iOSの折り返し配置、iPhoneのUser-Agent）はWebKitだけ、`@not-webkit`（Web版のルート文字の拡大。Safariは端末の文字サイズでWebページのルート文字を大きくしない）はChromiumだけで流す。
  - `@static`（配信されたHTML・ファイル・リンク・メタデータだけの確認）はChromium desktopだけ、`@engine`（CSP）はエンジンごとに1回流す。
  - iOS版の編集画面の文字をAX1（28px）で頭打ちにする決定に合わせ、文字拡大の確認を28pxまでにした。32〜53pxの確認と、スマホ横向き×大きな文字の確認を削除した。iOS版の使い方ページは読み物で上限を設けないため、AX3・AX5を残す。
  - 同じ経路を何度も通す確認を減らした。テンプレートの復元と出力は8種類から2種類（`cable-2x2`、`nordic`）、編み図操作の失敗通知は共通の`runManagementOperation`を通るので削除だけにした。
  - 存在しない画面幅を実在の幅に替えた（320→360px、429→428px、1024×1024と760×1024→820×1180と1280×800）。スマホにキーボードを付ける状況は想定しないので、キーボードのフォーカス表示は1280px幅だけで確かめる。
  - データを守るテスト（自動保存、切り替え、タブ間の競合、旧形式の移行、バックアップと復元、ストレージにだけある編み図の保持）は変えていない。
- 主なファイル: `playwright.config.ts`、`tests/e2e/*.spec.ts`（`larger-text.spec.ts`など24ファイル）、`AGENTS.md`
- テスト: プロジェクトごとの件数は、Chromium mobile 251→138件、WebKit mobile 251→188件、Chromium desktop 251→182件。
- 検証: `npm run typecheck`、`TZ=Asia/Tokyo npm test`（1214件）、`npm run build`、`npm run check:dist`、`npx playwright test`（全3プロジェクトで500件成功、8件は既存の条件でスキップ）が成功した。
- デプロイ影響: なし（テストだけの変更）。
