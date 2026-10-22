# Repository Guidelines

## Project Goal

このディレクトリは、ルートのWeb版と共通基盤を共有する、完全オフラインのiOS・iPadOSアプリです。[`DEVELOPMENT.md`](DEVELOPMENT.md)と[`SPECIFICATION.md`](SPECIFICATION.md)を実装上の基準とし、P0要件を勝手に緩和してはいけません。リポジトリ全体の構成・CI・Pages公開方針はルートの[`AGENTS.md`](../AGENTS.md)と[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)を正とします。

## Source Repository Boundary

Web版は別リポジトリの参照元ではなく、このリポジトリのルートに統合されています。`packages/editor-core`が盤面・記号の正本であり、`Web/src`へコピー同期しません。

- ルートの`dist/`、`ios/AppResources/Web/`、依存関係キャッシュは生成物であり、直接編集・コミットしない。
- 共通コードの変更はWebとiOSの両方を検証する。
- 記号定義は`packages/editor-core/stitches/catalog.ts`と`packages/editor-core/stitches/glyphs.ts`を一体として扱う。
- 永続記号IDを変更・再利用・配列位置から再採番しない。
- Web版の変更を機械的に全部コピーせず、SEO、GitHub Pages、分析、旧Safari移行などアプリ不要部分を除外する。

## Non-Negotiable Product Requirements

- 起動、編集、保存、PNG/PDF生成、`.knit`入出力、ヘルプをオフラインで完結させる。
- 公開Webサイト、CDN、外部フォント、分析、広告、リモート設定に実行時依存しない。
- SafariのIndexedDB、Cookie、`localStorage`の自動移行を実装しない。
- Web版とのデータ交換には`.knit`を使用し、双方向互換テストを維持する。
- 端末内の編み図を外部へ送信しない。
- iPhone・iPadの両方を対象とし、iPadの可変ウィンドウ幅を考慮する。
- packed盤面とCanvas仮想描画を維持し、セルごとのViewやDOM要素へ置き換えない。

これらを変更する必要がある場合は、実装前に理由、影響、代替案を提示し、ユーザーの確認を得てください。

## Repository Structure

現在の責務分離を維持します。

```text
ios/App/             SwiftUI entry point and lifecycle
ios/AppResources/Web/ generated local web bundle; source is `ios/Web` and `packages/*`
ios/Web/             app-specific React/TypeScript entrypoint and native adapter
ios/Tests/           Swift unit tests
ios/UITests/         XCUITest
ios/docs/            additional app design and release records
```

実際のXcode生成構成が異なる場合は、コードと同じコミットでこの節を更新します。

## Offline and Network Rules

- 新しい外部URL、SDK、パッケージ、通信処理を追加する前に、オフライン要件への影響を説明する。
- Webアセットはアプリに同梱し、`https://knittingeditor.com/`を`WKWebView`へ読み込まない。
- 外部を開いてよいのは、[`SPECIFICATION.md`](SPECIFICATION.md)の「3. オフライン・ネットワーク仕様」に挙げた、利用者が選んだときだけ開くリンクに限る。新しく足すときは先に仕様を変える。
- リリースビルドにGoogle AnalyticsやGoogle Tag Managerを含めない。
- テストでは予期しないネットワーク要求を検出し、失敗として扱う。

## Data and Compatibility Rules

- `.knit`の`format`、`version`、`stitchCatalogVersion`、盤面寸法、セル長を検証する。
- 未知の新しいカタログは黙って読み込まず、ユーザーへ互換性エラーを示す。
- 復元は既存データを上書きせず、新しいIDで追加する。
- データ形式、記号ID、保存origin、IndexedDB schemaの変更には移行テストを追加する。
- Safari保存領域との互換処理を追加しない。旧データ移行コードがWeb版から混入した場合はアプリビルドから除外する。

## 非公開情報

リポジトリ、その履歴、GitHub上のIssue・PR・コメント・コミットメッセージ・CIログ・添付画像はすべて公開される。ルートの[`AGENTS.md`](../AGENTS.md)の「Confidential Information」に従い、利用分析・Search Console・App Store Connect・売上の数値、非公開のダッシュボードへのリンクやアカウントID、公開前の価格・収益試算・事業計画、個人情報を載せない。必要な数値や価格、未公表の予定、個人の税務・法務の情報はGit管理外のルート`private/`に置き、文書には定性的な結論とその置き場所だけを書く。`private/`はメインのチェックアウトのルートにだけあり（同期フォルダへのシンボリックリンクの場合がある）、worktreeからはメインのチェックアウトの`private/`を使う。App Storeの審査メモや提出資料の下書き（`docs/`）も同じ扱いとする。

## Development Log

記録の置き場所・書式・時期は、ルートの[`AGENTS.md`](../AGENTS.md)の「Development Log」と[`docs/dev-log/README.md`](../docs/dev-log/README.md)に従う。iOS側の変更も同じで、`ios/DEVELOPMENT_LOG.md`は統合前の凍結アーカイブとして追記しない。

iOS側の変更では、ルートの項目に加えて、TestFlight／App Storeへの影響と必要な事後確認を書く。記号の同期と、署名・配布設定の変更も記録の対象とする。実際に実行していないテストを成功と記録してはいけない。

## Issue Management

Issueの管理（ラベル、マイルストーン`iOS 1.0`、`Closes #番号`）はルートの[`AGENTS.md`](../AGENTS.md)の「GitHub Workflow」に従う。iOS版では加えて次を守る。

- `needs-device`のIssueはSimulatorの結果だけで閉じない。実機の手順は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)に従う。
- 仕様変更時は[`DEVELOPMENT.md`](DEVELOPMENT.md)、[`SPECIFICATION.md`](SPECIFICATION.md)、関係するIssueの不整合を残さない。

## Testing Requirements

変更した領域に応じて、最小でも次を実施します。

- TypeScriptモデル、記号、保存、出力: Web単体テスト
- JavaScript–Swiftブリッジ: Swift単体テストと不正入力テスト
- 保存・scene phase・Files・共有: XCUITestまたは明示した手動実機試験
- UI変更: iPhone狭幅、iPad全画面、iPad可変幅の目視確認
- 記号変更: 全記号の画面、PNG、PDF回帰確認
- データ形式変更: Web→アプリ、アプリ→Webの`.knit`往復試験
- リリース候補: 機内モードでP0フローを通すオフライン試験

CIの構成、PR・マージ後に確かめるジョブ、ローカルで行う検査は、ルートの[`AGENTS.md`](../AGENTS.md)の「Change-specific Test Requirements」と[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)の「ビルドと公開」を正とする。具体的なコマンドと端末は両ワークフローを正とする。

## Simulator運用と容量管理

- 最新OSを確認するときは、各ランタイムにつき検証用のiPhone・iPadを原則1台ずつに限定する。Xcodeが自動生成した未使用デバイスは、UDIDを一覧で確認してから明示的に削除する。
- 検証前後に`xcrun simctl list runtimes`、`xcrun simctl list devices available`、`du -sh ~/Library/Developer/CoreSimulator`、`df -h /`を記録する。
- 検証終了後は全Simulatorをshutdownする。最新OS用に新規作成したデバイスはテストデータを`erase`して保持し、既存のCI基準デバイスはユーザーの明示なしに消去しない。
- ランタイム自体、既存のユーザーデータ、実機データを容量都合で削除しない。XcodeBuildMCPの古い生成ログ・テスト成果物を整理する場合は、対象と保持する最新証跡を先に列挙し、復元可能なゴミ箱移動を優先する。

## Generated Files and Secrets

- 生成されたWebバンドル、DerivedData、Archive、署名成果物を直接編集・コミットしない。
- App Store Connect API key、証明書、秘密鍵、Provisioning Profile、個人Team情報をコミットしない。
- `.gitignore`にない生成物が現れた場合は、内容と必要性を確認してから扱う。
- PNG、PDF、`.knit`のテスト出力はfixtureとして必要な最小ファイルだけを明示的に追加する。

## Commits

コミットの粒度・メッセージ、PRのレビューとマージ、force-pushの禁止は、ルートの[`AGENTS.md`](../AGENTS.md)の「Commit & Pull Request Guidelines」「Deployment Procedure」「Branches, Worktrees & Cleanup」に従う。iOS版では加えて次を守る。

- コードベースを変更したら、指示がなくてもコミットし、同じ作業内でGitHubへpushする。push後に`git status --short --branch`などで、ローカルHEADとリモート追跡ブランチの一致を確かめる。
- pushが失敗した場合は作業完了とせず、原因とリモート未反映であることを報告し、開発ログにも記録する。
- **push後はCIの結果を必ず確認する。** 詳細は「CI確認」節に従う。
- TestFlight upload、App Store提出、GitHub Release作成、タグ作成は、ユーザーの明示的な依頼なしに行わない。

## CI確認

featureブランチをpushしたら、PRを作成してから、そのcommitのCIが完了するまで確認し、結果をユーザーへ報告する。既存PRへのpushも対象とする。`ci.yml`のイベントは`pull_request`、`main`へのpush、`workflow_dispatch`だけなので、PR作成前のfeatureブランチへのpushではrunを待たない。**CIを確認しないまま作業完了と報告しない。**

runの待ち方のコマンド、runが現れないときの調べ方、ローカルでは再現しなかった過去の失敗例は[`DEVELOPMENT.md`](DEVELOPMENT.md)の「CIの結果の確かめ方」にある。ワークフローのイベント条件は変更しない。

runは、pushしたコミットのSHA（完全な40桁）と`ci.yml`で絞って選ぶ。`gh run list --limit 1`だけでは、CodeQLのrunや、別のブランチ・別のセッションのrunを拾い、他人の結果を見て完了と報告してしまう。

- `changes`、`app_store_docs`、変更範囲に応じた`web`、`ios_web`、`ios`（iPhone 17）、`ci-gate`を個別に確認する。Web影響のある`main`更新では`deploy`と`smoke`も確認する。`RUN: success`だけを見て済ませない。
- マージ後は`gh run list --workflow ios-full.yml --commit <SHA>`で変更を含むコミットのrunを選び、`gh run view <id> --json headSha,conclusion,jobs`で`ios_full`×2、`app_update`×2、`release_archive`の成功を個別に確認する。PRゲートだけでiOS作業完了としない。
- 失敗したら、そのpushで完了とせずに原因を特定して直す。
- 断続的に失敗するテストは、原因を特定できるまで「直った」と記録しない。失敗時の診断情報と画面添付を仕込み、次の発生を待つ。
- CIが赤いまま別の作業へ移る場合は、赤であることと原因の切り分け状況をユーザーへ明示する。
