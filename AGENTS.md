# Repository Guidelines

## Project Goal

このリポジトリは、Web版「棒針編み図エディタ」を、完全オフラインで動作するiOS・iPadOSアプリとして配布するためのものです。`DEVELOPMENT.md`と`SPECIFICATION.md`を実装上の基準とし、P0要件を勝手に緩和してはいけません。

## Source Repository Boundary

Web版 `/Users/komorikouki/git/knittingEditor` は参照元です。ユーザーから明示的な変更指示がない限り、必ず読み取り専用で扱ってください。

- Web版でコマンドを実行する前に、生成物やキャッシュを書き込まないか確認する。
- Web版の`dist/`、依存関係、ソース、テスト、Git状態を変更しない。
- アプリ側への同期は、同期元コミットSHAを記録してから行う。
- 記号定義は`src/stitches/catalog.ts`と`src/stitches/glyphs.ts`を一体として扱う。
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
App/                 SwiftUI entry point and lifecycle
AppBridge/           WKWebView and typed native bridge
AppResources/Web/    generated local web bundle; do not edit directly
Web/                 app-specific React/TypeScript source
Tests/               Swift unit tests
UITests/             XCUITest
docs/                additional design and release records
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
- 正式なリモートは`https://github.com/K0mork/knittingEditor_app.git`とし、`origin`に設定する。
- 各作業で作成したコミットは、ユーザーから個別の指示がなくても同じ作業内で必ずGitHubへpushする。
- push後に`git status --short --branch`または同等の方法で、ローカルHEADとリモート追跡ブランチの一致を確認する。
- pushが失敗した場合は作業完了とせず、原因とリモート未反映であることを報告し、開発ログにも記録する。
- force-push、履歴改変、リモートブランチ削除は、ユーザーが対象と目的を明示した場合だけ行う。
- TestFlight upload、App Store提出、GitHub Release作成は、ユーザーの明示的な依頼なしに行わない。
