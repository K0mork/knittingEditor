# Web・iOS共通基盤

このリポジトリは、GitHub Pagesで公開するWeb版と、`ios/`のSwiftUI・WKWebViewアプリを同じGit履歴で管理する。公開URL、Web版のルート配置、`public/CNAME`、`base: '/'`は変更しない。

## 共通コード

`packages/editor-core`は、Web版とiOS版が共有する盤面モデル、記号カタログとベクター記号、IndexedDBと`.knit`入出力、PNG/PDF出力、盤面Canvasコンポーネント、そして編集画面そのもの（状態と操作の`ui/useEditorController.ts`、画面の`ui/EditorView.tsx`）を提供する。Web版の`src/`とアプリ版の`ios/Web/src/`は共通コードを直接importし、環境固有の差分だけを持つ。再エクスポートだけのファイルは置かない。共通コードのテストもこのパッケージに置き、ルートの`npm test`が実行する。

`model/`はReactにもDOMにも依存させない。`export/`と`canvas/`はブラウザAPIを使うが、Web固有・iOS固有の分岐を持たない。共通化しないファイルとその理由は[`WEB_SYNC.md`](WEB_SYNC.md)の表を正とする。

`packages/*`またはルートの依存・共通ビルド設定に変更がある場合は、WebとiOSの両方を検証する。Web固有コードはWeb検証、iOS固有コードはiOS検証を行う。IndexedDBのDB名、アプリの固定origin、`.knit`の形式・バージョン・カタログバージョン、永続記号IDは互換試験なしに変更しない。

## 実行環境の境界

- Web固有: SEO、CNAME、サイトマップ、分析、旧Safari `localStorage` 移行、ブラウザのダウンロード。
- iOS固有: `WKWebView`ブリッジ、Files・共有シート、Document Picker、scene phase、オフラインbundle検査。
- 生成物: Webの`dist/`とiOSの`ios/AppResources/Web/`。いずれもソースから生成し、Gitへ追加しない。

共通コードから環境固有の機能を呼ぶ必要がある場合は、`packages/editor-core/platform.ts`の`EditorPlatform`へ足して各ビルドのアダプタで実装する。現在の項目は生成ファイルの受け渡し（`saveFile`）だけで、Web版はダウンロード、iOS版は`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。呼び出し元のない項目を先に置かない。

入力ダイアログ（`askText`・`askConfirm`）と分析（`EditorAnalytics`）も`useEditorController`の引数として各ビルドが渡す。制作量の判定は共通の`packages/editor-core/chartProgress.ts`に置くが、Web版で解析が有効なときだけ動かし、iOS版では計測状態の作成・保存も行わない。分析の送信実装はWeb版の`src/analytics.ts`だけが持ち、iOS版は何も渡さないので共通の`NO_ANALYTICS`のまま一切送らない。ネイティブのバックアップ読込み、保留保存のflush、使い方ページ遷移前の保存はiOS版の`App.tsx`が扱い、実行時の外部依存・通信APIをアプリbundleへ含めない。利用者が選んだときだけ外部を開くリンクの例外は[`ios/SPECIFICATION.md`](../ios/SPECIFICATION.md)の「3. オフライン・ネットワーク仕様」を正とし、`ios/scripts/check-app-bundle.sh`が同梱資産を検査する。編集・保存・ヘルプの閲覧はオフラインで完結する。

## ビルドと公開

この節は実際のCIジョブ構成の正本である。CIの必須条件とデプロイ手順はルートの[`AGENTS.md`](../AGENTS.md)の「Hosting & Production Constraints」「Deployment Procedure」を正とし、ここではジョブの構成だけを書く。

ルートの`package.json`と`package-lock.json`をworkspaceの唯一のNode依存定義とする。iOSの`ios/scripts/build-web.sh`はルート依存を使って`ios/Web`をビルドし、`ios/AppResources/Web/`へコピーする。

`.github/workflows/ci.yml`は変更範囲を判定し、必要なジョブだけを実行する。

- `changes`: 変更範囲を判定する。判定できないときはWeb・iOSの両方をtrueにして通す。
- `web`: `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`を実行する。`npm test`は`packages/**`、`src/**`、`scripts/**`のテストを対象とし、Playwrightは`chromium-mobile`・`webkit-mobile`・`chromium-desktop`で実行する。
- `ios_web`: `ios/Web`の型検査とVitestを実行する。
- `ios`: iPhone 17で、`ios/project.yml`から得たすべての`bundle.unit-test`ターゲット、`ios/UITests/pr-smoke-ui-tests.txt`のUIスモークテスト、Debugオフラインbundle検査を実行する。
- `app_store_docs`: 変更範囲によらず常に実行し、App Store提出文書とPR UIスモーク一覧を検査する。
- `ci-gate`: `changes`、`app_store_docs`、変更範囲に応じた`web`・`ios_web`・`ios`の結果を検査する。必要なジョブのskip・失敗・キャンセルも失敗として扱う。
- `main`へのpushでWebまたは共通コードの変更を含むときは、`ci-gate`成功後にPages artifactをデプロイし、`deploy`の後に`smoke`で本番を確認する。iOS専用更新では再公開しない。

`.github/workflows/ios-full.yml`は、関連する`main`へのマージ後、毎晩（18:23 UTC）、手動実行時に、Pagesのゲートとは別に実行する。

- `ios_full`: iPhone 17・iPad (A16)の全単体／UIテストとDebug bundle検査。iPadのUI除外一覧は使わない。
- `app_update`: 両端末で更新後の復元を確認する。
- `release_archive`: unsigned Release Archiveを作り、同梱資産を検査する。
- `report_failure`: `main`・夜間の失敗時に、`bug`・`priority:P1`・`platform:ios`付きIssueを作成する。同名の未完了Issueがある場合は実行URLをコメントする。

iOS・共通コードの完了確認の条件（マージ後のコミットでの全検証、リスクの高い変更のマージ前実行を含む）は、[`AGENTS.md`](../AGENTS.md)の「Deployment Procedure」を正とする。

本番公開後は、`CI and deploy Pages`の必要なゲートジョブと`deploy`・`smoke`、`https://knittingeditor.com/`のHTTPS応答、主要編集、PNG/PDF、`.knit`入出力を確認し、マージしたPRへのコメントで報告する。
