# 2026-11-06 — Web版からiPhone・iPad版アプリへの導線を足す

- 影響: 2026-11-06にApp Storeで公開したiPhone・iPad版アプリへ、Web版から行けるようにした。iOS版の画面と同梱の使い方は変えていない。
  - 編集画面: iPhone・iPadのブラウザ（Safari以外も）で、道具の列と盤面の間（書き出しを勧める帯と同じ段）に「iPhone・iPad版のアプリがあります。Web版の編み図は.knitバックアップで移せます。」と「App Storeで見る」「閉じる」を出す。案内が出ている間は書き出しの勧めを出さず、閉じると勧めが出る。保存失敗の警告は案内より優先し、パネルを開いている間と処理中は勧めと同じく出さない。「閉じる」か「App Storeで見る」を押したら日時を端末内の設定（IndexedDB）へ記録し、その端末では二度と出さない。User-Agentからアプリが動かない古いiOS（17未満）と読めるときと、自動操作のブラウザ（`navigator.webdriver`）では出さない。App Storeは編集中のタブを残すため新しいタブで開く。AndroidとPCには出さない。
  - 「編み図」パネル: 一覧の下のプライバシーポリシーへのリンクの上に「iPhone・iPad版アプリ（App Store）」のリンクを足した（全端末）。
  - 使い方（`/guide/`）とサポート（`/support/`）: 「iPhone・iPadのアプリ」の節を足し、`.knit`での編み図の移し方と、Apple公式の日本語の「App Storeからダウンロード」バッジ（黒、高さ44px）を置いた。フッターにAppleの商標の表記を足した。`llms.txt`にもアプリを1行足した。
  - AppleのSmart App Banner（`apple-itunes-app`のmeta）は、ページから表示中か閉じたかを知れず書き出しの勧めと排他にできないため使わない（利用者の判断）。
  - 共通の`EditorView`に、盤面の上の段へ出すホストの案内`notice`を足した。`documentsNote`は段落で渡す形に変え、包む要素を`<p>`から`<div>`にした。iOS版はどちらも渡さない。
- 主なファイル: `src/appStoreNotice.tsx`、`src/appleDevice.ts`、`src/App.tsx`、`src/platform.ts`、`src/styles.css`、`packages/editor-core/ui/EditorView.tsx`、`packages/editor-core/styles/base.css`、`public/app-store-badge.svg`、`public/guide/index.html`、`public/support/index.html`、`public/llms.txt`、`scripts/check-dist.mjs`、`scripts/check-live-site.mjs`、`docs/WEB_SYNC.md`、`packages/editor-core/README.md`
- テスト:
  - `src/appStoreNotice.test.tsx`（追加）: iOSの版の読み取り（OSの版が固定されたSafari、iPadOSのMacの名乗り、Chrome）、案内を出す端末、`ios/project.yml`の`deploymentTarget`との一致、閉じた記録と再表示しないこと、記録を読めないときに出さないこと。
  - `packages/editor-core/ui/BackupReminderBar.test.tsx`（追加）: ホストの案内がある間は書き出しの勧めを出さず、パネルを開くと案内も隠れ、案内を閉じたその場で勧めが出る。
  - `tests/e2e/app-store-links.spec.ts`（追加）: iPhoneで盤面の上に案内が出て、閉じると記録され再読み込み後も出ないこと、App Storeを新しいタブで開いても編集中のタブが残り二度と出ないこと、AndroidとPCには出ないこと、「編み図」パネルのリンク、使い方・サポートのバッジ（1個、高さ40px以上、縦横比）と商標の表記、バッジがSVGとして配信されること。
  - `tests/e2e/seo.spec.ts`（更新）: `llms.txt`のサイトの外へのリンクは、App Storeの製品ページだけを許す。
- 検証:
  - `npm run typecheck`（成功）、`npm test`（83ファイル・1082件成功）、`npm run build`と`npm run check:dist`（成功。`dist/app-store-badge.svg`と`dist/CNAME`の`knittingeditor.com`を確認）、`npm run test:e2e`（644件成功、37件はほかのブラウザ設定のためスキップ）。
  - iOS Web: `ios/Web`で`tsc -p tsconfig.app.json --noEmit`（成功）と`vitest run --config vite.config.ts`（18ファイル・151件成功）。iOSのSimulatorのテストはPRのCIと`ios-full.yml`に任せる。
  - PlaywrightのWebKit（iPhone 14、iPad Pro 11の横向き）とChromium（デスクトップ）で、編集画面の案内（ライト・ダーク）、「編み図」パネル、使い方・サポートのバッジとフッターのスクリーンショットを撮って見た。案内は盤面に重ならず、iPadの横向きでは1行に収まる。
  - PlaywrightのWebKitは、App Storeの製品ページへのリンクを押しても移動せず、新しいタブも開かない（Safariと同じくApp Storeへ渡す動き）。新しいタブで開くことはChromiumで確かめ、WebKitでは案内が閉じて編集中のタブが残ることを確かめた。実機でApp Storeのアプリが開くことは確かめていない。
- デプロイ影響: Pagesへ配信される。配信後、`smoke`がバッジ（`/app-store-badge.svg`）の配信も確かめる。iPhone・iPadの実機のSafariで、編集画面の案内の表示・閉じたあとの非表示・「App Storeで見る」でApp Storeのアプリが開くことを確かめる。
