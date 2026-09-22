# Repository Guidelines

## Project Goal

このディレクトリは、ルートのWeb版と共通基盤を共有する、完全オフラインのiOS・iPadOSアプリです。`DEVELOPMENT.md`と`SPECIFICATION.md`を実装上の基準とし、P0要件を勝手に緩和してはいけません。リポジトリ全体の構成・CI・Pages公開方針はルートの`AGENTS.md`と`docs/ARCHITECTURE.md`を正とします。

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

## Planned Structure

実装開始後は、概ね次の責務分離を守ります。

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
- 外部リンクはユーザー操作時のみSafariで開き、編集機能の正常動作と分離する。
- リリースビルドにGoogle AnalyticsやGoogle Tag Managerを含めない。
- テストでは予期しないネットワーク要求を検出し、失敗として扱う。

## Data and Compatibility Rules

- `.knit`の`format`、`version`、`stitchCatalogVersion`、盤面寸法、セル長を検証する。
- 未知の新しいカタログは黙って読み込まず、ユーザーへ互換性エラーを示す。
- 復元は既存データを上書きせず、新しいIDで追加する。
- データ形式、記号ID、保存origin、IndexedDB schemaの変更には移行テストを追加する。
- Safari保存領域との互換処理を追加しない。旧データ移行コードがWeb版から混入した場合はアプリビルドから除外する。

## Development Log

`DEVELOPMENT_LOG.md`をすべてのユーザー可視変更、挙動変更、データ移行、記号同期、テスト・ビルド・署名・配布設定変更で更新してください。

新しい項目を先頭へ追加し、以下を必ず記録します。

- 日付と短い要約
- 影響する挙動・方針と主なファイル
- 追加・更新したテスト
- 実行したコマンドと成功・失敗
- 実行できなかった検証と理由
- TestFlight／App Storeへの影響と必要な事後確認

実際に実行していないテストを成功と記録してはいけません。

## TODO Maintenance

- 作業開始時に`TODO.md`の対象項目と完了条件を確認する。
- 完了した項目だけをチェックし、部分完了を完了扱いにしない。
- 新しい必須作業が判明した場合は、実装と同じコミットでTODOへ追加する。
- 仕様変更時は`DEVELOPMENT.md`、`SPECIFICATION.md`、`TODO.md`の不整合を残さない。

## Testing Requirements

変更した領域に応じて、最小でも次を実施します。

- TypeScriptモデル、記号、保存、出力: Web単体テスト
- JavaScript–Swiftブリッジ: Swift単体テストと不正入力テスト
- 保存・scene phase・Files・共有: XCUITestまたは明示した手動実機試験
- UI変更: iPhone狭幅、iPad全画面、iPad可変幅の目視確認
- 記号変更: 全記号の画面、PNG、PDF回帰確認
- データ形式変更: Web→アプリ、アプリ→Webの`.knit`往復試験
- リリース候補: 機内モードでP0フローを通すオフライン試験

## Simulator運用と容量管理

- 最新OSを確認するときは、各ランタイムにつき検証用のiPhone・iPadを原則1台ずつに限定する。Xcodeが自動生成した未使用デバイスは、UDIDを一覧で確認してから明示的に削除する。
- 検証前後に`xcrun simctl list runtimes`、`xcrun simctl list devices available`、`du -sh /Users/komorikouki/Library/Developer/CoreSimulator`、`df -h /`を記録する。
- 検証終了後は全Simulatorをshutdownする。最新OS用に新規作成したデバイスはテストデータを`erase`して保持し、既存のCI基準デバイスはユーザーの明示なしに消去しない。
- ランタイム自体、既存のユーザーデータ、実機データを容量都合で削除しない。XcodeBuildMCPの古い生成ログ・テスト成果物を整理する場合は、対象と保持する最新証跡を先に列挙し、復元可能なゴミ箱移動を優先する。

テストコマンドはXcodeプロジェクトとWebビルド基盤の作成時にこの文書へ追記します。対象が存在しない段階で架空のコマンドを定義しません。

## Generated Files and Secrets

- 生成されたWebバンドル、DerivedData、Archive、署名成果物を直接編集・コミットしない。
- App Store Connect API key、証明書、秘密鍵、Provisioning Profile、個人Team情報をコミットしない。
- `.gitignore`にない生成物が現れた場合は、内容と必要性を確認してから扱う。
- PNG、PDF、`.knit`のテスト出力はfixtureとして必要な最小ファイルだけを明示的に追加する。

## Commits

- コードベースを変更したら、指示がなくてもコミットする。
- 1コミット1目的とし、フォーマットだけの変更は分離する。
- Conventional Commit形式を使う。例: `docs: define offline app architecture`、`feat: add local web container`、`fix: flush saves on background`。
- コミット前に差分、未追跡ファイル、実行済みテスト、`DEVELOPMENT_LOG.md`を確認する。
- 統合先の正式なリモートは`https://github.com/K0mork/knittingEditor.git`とする。
- 各作業で作成したコミットは、ユーザーから個別の指示がなくても同じ作業内で必ずGitHubへpushする。
- push後に`git status --short --branch`または同等の方法で、ローカルHEADとリモート追跡ブランチの一致を確認する。
- pushが失敗した場合は作業完了とせず、原因とリモート未反映であることを報告し、開発ログにも記録する。
- **push後はCIの結果を必ず確認する。** 詳細は「CI確認」節に従う。
- force-push、履歴改変、リモートブランチ削除は、ユーザーが対象と目的を明示した場合だけ行う。
- TestFlight upload、App Store提出、GitHub Release作成は、ユーザーの明示的な依頼なしに行わない。

## CI確認

pushしたら、そのcommitのCIが完了するまで確認し、結果をユーザーへ報告する。**CIを確認しないまま作業完了と報告しない。**

```sh
RUN=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
until [ "$(gh run view "$RUN" --json status --jq .status)" = "completed" ]; do sleep 30; done
gh run view "$RUN" --json conclusion,jobs --jq '"RUN: \(.conclusion)", (.jobs[] | "  \(.name): \(.conclusion)")'
```

- 全ジョブ（`web`、`ios`×2、`app-update`×2、`release-archive`）の結果を個別に確認する。`RUN: success`だけを見て済ませない。
- 失敗したら、そのpushで完了とせずに原因を特定して直す。`gh run view <id> --log-failed`で失敗ジョブのログを読む。ローカルで再現できない場合は、CI環境（macos-14、Xcode 15.4）との差を疑う。
- ローカルのSimulatorが通ってもCIが落ちることがある。過去の実例は次のとおりで、いずれもローカルでは再現しなかった。
  - 入力欄の中央タップでキャレットが先頭に入り、削除が効かず初期値が残った（Xcode 15.4 Simulator）。
  - `-only-testing`の対象テストを誤って削除し、「Executed 0 tests」が成功扱いになった。テスト関数を消していないか、変更前コミットとの関数一覧の差分で確認する。
  - UIテストがランナーの遅さで実行時間の上限を超えた（`exceeded execution time allowance`）。`-retry-tests-on-failure`はタイムアウトを救ってくれないため、`-default-test-execution-time-allowance`／`-maximum-test-execution-time-allowance`とジョブの`timeout-minutes`を見直す。
- 断続的に失敗するテストは、原因を特定できるまで「直った」と記録しない。失敗時の診断情報と画面添付を仕込み、次の発生を待つ。
- CIが赤いまま別の作業へ移る場合は、赤であることと原因の切り分け状況をユーザーへ明示する。
