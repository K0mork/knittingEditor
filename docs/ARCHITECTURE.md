# Web・iOS共通基盤

このリポジトリは、GitHub Pagesで公開するWeb版と、`ios/`のSwiftUI・WKWebViewアプリを同じGit履歴で管理する。公開URL、Web版のルート配置、`public/CNAME`、`base: '/'`は変更しない。

## 共通コード

`packages/editor-core`は、Web版とiOS版が共有する盤面モデル、記号カタログとベクター記号、IndexedDBと`.knit`入出力、PNG/PDF出力、盤面Canvasコンポーネント、そして編集画面そのもの（状態と操作の`ui/useEditorController.ts`、画面の`ui/EditorView.tsx`）を提供する。Web版の`src/`とアプリ版の`ios/Web/src/`は共通コードを直接importし、環境固有の差分だけを持つ。再エクスポートだけのファイルは置かない。共通コードのテストもこのパッケージに置き、ルートの`npm test`が実行する。

`model/`はReactにもDOMにも依存させない。`export/`と`canvas/`はブラウザAPIを使うが、Web固有・iOS固有の分岐を持たない。共通化しないファイルとその理由は`ios/docs/WEB_SYNC.md`の表を正とする。

`packages/*`またはルートの依存・共通ビルド設定に変更がある場合は、WebとiOSの両方を検証する。Web固有コードはWeb検証、iOS固有コードはiOS検証を行う。IndexedDBのDB名、アプリの固定origin、`.knit`の形式・バージョン・カタログバージョン、永続記号IDは互換試験なしに変更しない。

## 実行環境の境界

- Web固有: SEO、CNAME、サイトマップ、分析、旧Safari `localStorage` 移行、ブラウザのダウンロード。
- iOS固有: `WKWebView`ブリッジ、Files・共有シート、Document Picker、scene phase、オフラインbundle検査。
- 生成物: Webの`dist/`とiOSの`ios/AppResources/Web/`。いずれもソースから生成し、Gitへ追加しない。

共通コードから環境固有の機能を呼ぶ必要がある場合は、`packages/editor-core/platform.ts`の`EditorPlatform`へ足して各ビルドのアダプタで実装する。現在の項目は生成ファイルの受け渡し（`saveFile`）だけで、Web版はダウンロード、iOS版は`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。呼び出し元のない項目を先に置かない。

入力ダイアログ（`askText`・`askConfirm`）と分析（`EditorAnalytics`）も`useEditorController`の引数として各ビルドが渡す。制作量の判定は共通の`packages/editor-core/chartProgress.ts`に置くが、Web版で解析が有効なときだけ動かし、iOS版では計測状態の作成・保存も行わない。分析の送信実装はWeb版の`src/analytics.ts`だけが持ち、iOS版は何も渡さないので共通の`NO_ANALYTICS`のまま一切送らない。ネイティブのバックアップ読込み、保留保存のflush、使い方ページ遷移前の保存はiOS版の`App.tsx`が扱い、実行時の外部依存・通信APIをアプリbundleへ含めない。同梱の使い方ページのサポートページ（HTTPS）、アプリのプライバシーポリシー（`https://knittingeditor.com/privacy/app/`）とメールのリンクは例外で、利用者が選んだ場合だけSafariまたはメールアプリを開く。編集・保存・ヘルプの閲覧はオフラインで完結する（`ios/AGENTS.md`、`ios/scripts/check-app-bundle.sh`）。

## ビルドと公開

ルートの`package.json`と`package-lock.json`をworkspaceの唯一のNode依存定義とする。iOSの`ios/scripts/build-web.sh`はルート依存を使って`ios/Web`をビルドし、`ios/AppResources/Web/`へコピーする。

`.github/workflows/ci.yml`は変更範囲を判定し、Web・共通コード・iOSの検証を必要な範囲で実行する。Markdownはどちらのビルド入力でもないため重い検証を起こさず、App Store提出文書とUIスモーク一覧の検査は変更範囲によらず常に実行する`app_store_docs`が受け持つ。常に実行される`ci-gate`が、`app_store_docs`の結果、変更範囲判定そのものの失敗、必要なジョブのskip・失敗・キャンセルを検査する。範囲を判定できないときは判定側がWeb・iOSの両方をtrueにして通す。Webまたは共通コードの`main`更新では、関連テスト成功後にPages artifactをデプロイし、iOS専用更新では再公開しない。

PRの検証（`.github/workflows/ci.yml`）は、変更範囲に応じてWeb E2E（Chromium・WebKit）、iOS Webの型検査・Vitest、iPhone 17の全単体テストと`ios/UITests/pr-smoke-ui-tests.txt`のUIスモークテスト、Debugオフラインbundle検査を実行する。App Store文書・UIスモーク一覧の静的検査は常時実行し、必要なジョブを`ci-gate`で必須にする。

全検証は別の`.github/workflows/ios-full.yml`で、関連するマージ後、毎晩（18:23 UTC）、手動実行時に行う。iPhone 17・iPad (A16)の全単体／UIテストとDebug bundle検査、両端末の`app_update`、unsigned Release Archiveとオフライン資産検査が対象で、Pagesのゲートには含めない。iPadのUI除外一覧は使わない。`main`・夜間の失敗は`bug`・`priority:P1`・`platform:ios`付きIssueを作成し、同名の未完了Issueがある場合は実行URLをコメントする。失敗は調査・修正する。

iOS・共通コードの完了確認には、マージ後のコミット、または変更を含む後続の`main`コミットで全検証の成功が必要。同じブランチの古いrunはキャンセルされるため、連続マージ時は変更を含む最新コミットで確認する。夜間runもその変更を含む必要がある。保存・移行、Files・共有、iPadのレイアウト・キーボード・回転、Swift・ビルド設定・依存、スモーク対象外テストなどリスクの高い変更は、マージ前にもfeatureブランチで全検証を手動実行し、そのSHAの全ジョブの成功を確認する。

本番公開後は、`CI and deploy Pages`の必要なゲートジョブと`deploy`・`smoke`、`https://knittingeditor.com/`のHTTPS応答、主要編集、PNG/PDF、`.knit`入出力を確認し、マージしたPRへのコメントで報告する（ルートの`AGENTS.md`の「Deployment Procedure」）。
