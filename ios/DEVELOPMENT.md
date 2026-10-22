# 開発方針

## 1. 目的

Web版と同等の棒針編み図編集機能をiPhone・iPadへ移行し、通信できない環境でも作成、保存、出力、復元まで完了できるアプリを提供します。

初回リリースは機能互換とデータ保全を優先します。SwiftUIによる全面再実装は行わず、成熟しているWeb版の編集エンジンをローカル`WKWebView`へ同梱し、OS統合が必要な機能だけをSwiftで実装します。

## 2. 確定した判断

| 項目 | 方針 |
|---|---|
| 実行方式 | アプリバンドル内のHTML/JavaScriptを`WKWebView`で実行 |
| ネットワーク | 編集機能は完全オフライン。初期版は外部通信を実装しない |
| Safariデータ | IndexedDB・`localStorage`の自動移行は非対応 |
| Web版との交換 | `.knit`の書き出し・読み込みで対応 |
| アプリ内保存 | 初期版は永続`WKWebsiteDataStore`のIndexedDBを使用 |
| ファイル連携 | Files、共有シート、他アプリから開く処理をSwiftで提供 |
| 記号定義 | `packages/editor-core/stitches/`をWeb・iOS共通の正本とする |
| 分析 | Google Analyticsを同梱しない。初期版は利用分析通信なし |
| 対応端末 | iPhone・iPadの両方。縦横回転とiPadの可変ウィンドウに対応 |

## 3. 現在のアーキテクチャ

```text
SwiftUI application
├── App lifecycle
├── WKWebView container
├── Native bridge
│   ├── Web → Swift: exportFile / openBackup / webReady / commandState
│   └── Swift → Web: knittingEditorFlushPendingSave() / backup・result・command events / knittingEditorAppInfo
├── Files / document type integration
└── Local bundled web assets
    ├── React UI
    ├── Board model
    ├── Canvas renderer and gestures
    ├── stitch catalog and vector glyphs
    ├── IndexedDB persistence
    └── PNG / PDF generators
```

ブリッジのWeb→Swiftメッセージと、Swift→Webのイベント（バックアップの受け渡し、書き出しの結果、エラー、メニュー操作の`knittingEditorNativeCommand`）とアプリ情報（`knittingEditorAppInfo`）の詳細は[`docs/NATIVE_BRIDGE.md`](docs/NATIVE_BRIDGE.md)を参照します。保留中の保存を書き込む`knittingEditorFlushPendingSave()`の呼び出しは「6. 保存とデータ保全」で扱います。`exportFile`の保存・共有先はSwift側で扱います。

`project.yml`からXcodeGenで生成する`knittingEditor.xcodeproj`もリポジトリへ保存します。SwiftUIの入口は`App/KnittingEditorApp.swift`、ローカルWebコンテナは`App/WebViewContainer.swift`と`App/LocalWebSchemeHandler.swift`です。型付きファイル連携は`App/NativeBridgeMessage.swift`、`.knit`のUTTypeは`App/KnittingEditorUTType.swift`で定義します。Web資産はルートworkspaceの依存関係と`ios/Web`、`packages/editor-core`から生成し、`AppResources/Web/`を経由してアプリバンドルへコピーします。

対象OSはiOS 17.0以上、iPhone・iPad（`TARGETED_DEVICE_FAMILY=1,2`）です。確認済み端末と残る実機検証は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)へ記録します。

プロジェクト生成とコンパイルの基本コマンドは次のとおりです。

```sh
# リポジトリルートで実行
npm ci --ignore-scripts
xcodegen generate --spec ios/project.yml
xcodebuild -project ios/knittingEditor.xcodeproj -scheme knittingEditor \
  -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
xcodebuild -project ios/knittingEditor.xcodeproj -scheme knittingEditor \
  -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build-for-testing

ios/scripts/build-web.sh
(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)
(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)
ios/scripts/check-app-bundle.sh /path/to/knittingEditor.app

# 同一Bundle IDの更新ビルドでIndexedDBが復元されることを確認する
SIMULATOR_UDID=<booted-simulator-udid> ios/scripts/simulate-app-update.sh "iPhone 17"
```

公開中の`https://knittingeditor.com/`は読み込みません。Viteのアプリ用ビルドをXcodeバンドルへ格納し、HTML、JavaScript、記号、WorkerをローカルURLから読み込みます。

`knitting-local://bundle/index.html`という固定originを`WKURLSchemeHandler`で提供し、`WKWebsiteDataStore.default()`を使います。実行時に外部URLを許可しません。`AppResources/Web/`にはCanvas、Pointer Events、Blob、IndexedDB、module Worker、全29記号を含むVite成果物を同梱します。型付きブリッジを通じたFiles・共有シート・ネイティブ保存、Privacy Manifest、アプリ内のプライバシー／サポート説明も実装済みです。実機で確認済みの往復範囲と残作業は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)を正とします。

## 4. 共通実装と環境固有実装

次の実装は`packages/editor-core`を正本としてWeb版とiOS版で共有します。

- `packages/editor-core/model/Board.ts`: packed `Uint32Array`盤面、複数セル記号、構造変更、ブロック
- `packages/editor-core/canvas/`: 仮想Canvas描画、連続描画・消去、範囲選択、パン・ズーム
- `packages/editor-core/stitches/catalog.ts`: 永続ID、記号メタデータ、カタログバージョン
- `packages/editor-core/stitches/glyphs.ts`: Canvas、SVG、PDFに共通するベクター記号
- `packages/editor-core/export/`: PNG、1ページPDF、A4分割PDF
- `packages/editor-core/storage/database.ts`: IndexedDB、`.knit` v2のエンコード・検証
- `packages/editor-core/ui/`: 編集画面（`useEditorController.ts`・`EditorView.tsx`）、編み図管理、盤面編集、ブロック、出力画面。環境差分はダイアログ・ファイル受け渡し・分析・見出しを引数で受け取る

次はアプリ用に差し替えます。

- `<a download>`による保存 → SwiftブリッジとFiles／共有シート
- `<input type="file">`による復元 → Document PickerとOpen in Place
- 外部の使い方・プライバシーリンク → アプリ内同梱画面または明示的なSafari遷移
- `beforeunload`中心の保護 → scene phaseとバックグラウンド移行時の保存要求
- Google Analytics → 初期版では無効化・除去
- Safari旧データ移行処理 → アプリビルドでは実行しない

## 5. 記号カタログの変更規則

共通の記号定義はWeb版とアプリ版の互換性に直結します。手作業で同じ記号を別実装しません。

1. `packages/editor-core/stitches/catalog.ts`と`glyphs.ts`を同じ変更単位で更新する。
2. `STITCH_CATALOG_VERSION`、全記号の`id`、`key`、寸法、`consumes`、`produces`、カテゴリ、標準区分をスナップショットテストで固定する。
3. Web版とアプリ版の共通テスト、Canvas、PNG、PDF描画を検証する。
4. 形式やカタログバージョンを変える場合は既存fixtureとの互換試験を追加する。
5. 既存IDの変更・再利用を禁止する。追加記号には未使用IDを割り当てる。
6. `.knit`の`stitchCatalogVersion`がアプリより新しい場合は読み込みを拒否し、破損扱いにしない。

現在のカタログバージョンと永続IDの一覧は[`packages/editor-core/README.md`](../packages/editor-core/README.md)の「永続記号IDスナップショット」を正とします（リポジトリ統合時はカタログv3の26記号で、v4で3記号を足しました）。IDの並び順と表示順は同一とは限らないため、配列インデックスを永続IDとして扱ってはいけません。

## 6. 保存とデータ保全

- 通常編集はアプリ専用の永続IndexedDBへ400 ms程度のデバウンスで自動保存する。
- バックグラウンド移行、シーン切断、編み図切替の前には保留中の保存を完了させる。
- SwiftUIのscene phaseがinactive/backgroundへ変化したとき、Swift側がWebViewの`knittingEditorFlushPendingSave()`を呼び出し、保存Promiseの完了を待つ。ブラウザ単体・互換経路では従来の`knittingEditorAppWillResignActive`イベントも同じ保存処理へ接続する。
- アプリ更新でローカルWebアセットのURLが変わっても同じ永続データストアを使用できる構成にする。
- アプリ削除時に端末内データが消えることを明示し、`.knit`バックアップを案内する。
- `.knit`はWeb版と相互に読み書きできることをfixtureで検証する。
- Safari内データの探索、Cookie共有、IndexedDBコピーは実装しない。

SwiftDataへの移行は初回リリース後の選択肢とします。初回から二重保存すると不整合経路が増えるため採用しません。

## 7. オフライン要件

機内モードかつキャッシュを持たない新規インストール状態で、以下を完了できることをリリース条件にします。

- 起動
- 新規編み図作成
- 全記号の選択と描画
- 自動保存と再起動後の復元
- PNG/PDF生成
- `.knit`書き出し・読み込み
- アプリ内ヘルプの閲覧

ビルド成果物に実行時依存となる外部URL、CDN参照、外部フォント、分析タグ、リモート設定を含めません。利用者が選んだときだけ外部を開くリンクの例外は[`SPECIFICATION.md`](SPECIFICATION.md)の「3. オフライン・ネットワーク仕様」を正とします。編集・保存・ヘルプの閲覧には接続不要です。ネットワーク接続はテストで監視し、意図しないリクエストを失敗させます。

## 8. UI・デバイス対応

- iPhoneの狭い縦画面を最小基準とする。
- iPadは全画面だけでなくSplit View、Stage Manager相当の可変サイズでレイアウトする。
- Safe Area、ホームインジケータ、Dynamic Type、VoiceOver、外付けキーボード、マウス・トラックパッドを確認する。
- 1本指編集と2本指パン・ズームを維持する。
- Apple Pencilは初回リリースでは指と同じポインタ入力として扱い、筆圧などの専用機能は追加しない。
- `window.prompt`と`confirm`はアプリ内ダイアログへ置換済みであり、キーボード表示中と取り消し操作をXCUITestで回帰確認する。

## 9. テスト戦略

### Webロジック

- ルートの共通Vitestと、アプリ固有の`ios/Web` Vitestを実行する。
- 盤面、記号カタログ、保存形式、PNG/PDFを重点対象とする。
- 共通コードが更新されたときはWeb・iOSの両方と既存fixtureを確認する。

### iOS統合

- XCTest/XCUITestで起動、WebView読込み、ライフサイクル、Files、共有を検証する。
- iPhoneとiPadの代表Simulatorで実行する。
- ジェスチャー、Apple Pencil、巨大PNG/PDF、メモリ圧迫は実機で確認する。
- オフライン試験では通信を遮断し、全必須機能を操作する。
- PR・マージ後・夜間のCIの構成と、完了の確かめ方は[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)の「ビルドと公開」を正とする。

### UIテスト用のDEBUG設定：自動保存の遅延（#196）

XCUITestは起動前に`app.launchEnvironment["KNITTING_EDITOR_AUTOSAVE_DELAY_MS"] = "3600000"`を設定できる。単位はミリ秒で、0〜2147483647の整数だけを受け付ける。未指定・不正値は通常の400msのまま。1時間の指定で、テスト中の自動保存と、文書切替・Home移行の即時保存を区別する。即時保存の待ち時間は変えない。

`DebugEditorConfiguration`とWebViewへの登録はともに`#if DEBUG`内にあり、Releaseには環境変数の読み取り・設定の注入を含めない。DEBUGネイティブはメインフレームの文書開始時に`window.knittingEditorDebugConfiguration = Object.freeze({ autosaveDelayMs: 3600000 })`を渡す。iOS Webはこの値だけを検証してcontroller/sessionへ渡し、URL・localStorage・Webの環境変数からは設定しない。通常のWeb版はこの設定を読まない。

`testDocumentSwitchSavesWithoutAutosave`と`testHomeSavesWithoutAutosave`は編集後の「保存中」を確認し、切替・Home移行の後にDBから再起動復元する。前面へ戻るときも`inactive`を通って`flushPendingSave()`が呼ばれるため、Home移行のテストはアプリを前面へ戻さず、バックグラウンドのまま終了する。検証時には文書切替の`saveNow()`、ネイティブの`flushPendingSave()`経路（Home移行時には呼ばず、前面へ戻ったときだけ呼ぶ変更を含む）をそれぞれ一時的に外し、対応するテストが失敗することを確かめてから必ず戻す。実機でサスペンドまでに保存が完了する保証は別の確認とする。

### CIの結果の確かめ方

確かめる対象と完了の条件は[`AGENTS.md`](AGENTS.md)の「CI確認」に従う。PRのCIは次の手順で待つ。

PRが存在することを`gh pr view --json url,headRefOid,state`で確認し、次を実行する。runの出現は最大5分待ち、取得失敗または期限超過なら確認を中断して原因を調べる。

```sh
SHA=$(git rev-parse HEAD)
RUN=''
DEADLINE=$(( $(date +%s) + 300 ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  RUN=$(gh run list --workflow ci.yml --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId // empty') || break
  [ -z "$RUN" ] || break
  sleep 10
done
if [ -n "$RUN" ]; then
  gh run watch "$RUN" --compact --interval 30 > /dev/null
  gh run view "$RUN" --json headSha,conclusion,jobs --jq '"RUN: \(.conclusion) (\(.headSha))", (.jobs[] | "  \(.name): \(.conclusion)")'
else
  echo '対象SHAのCI runを取得できませんでした。PR、push先、Actionsの状態を確認してください。' >&2
fi
```

runが現れない場合は、`gh pr view --json url,headRefOid,state`でPRがopenか、headが対象SHAかを確認する。`git status --short --branch`でpush先を、`gh run list --workflow ci.yml --limit 10`とGitHub Actions画面でイベント・承認待ち・ワークフロー無効化・取得エラーを調べる。原因を報告し、CI未確認のまま完了としない。ワークフローのイベント条件は変更しない。

失敗したら`gh run view <id> --log-failed`で失敗ジョブのログを読む。ローカルで再現できない場合は、CI環境（`.github/workflows/ci.yml`・`ios-full.yml`の`runs-on`と`DEVELOPER_DIR`、Simulatorは`OS=latest`）との差を疑う。

ローカルのSimulatorが通ってもCIが落ちることがある。過去の実例は次のとおりで、いずれもローカルでは再現しなかった。

- 入力欄の中央タップでキャレットが先頭に入り、削除が効かず初期値が残った（Xcode 15.4 Simulator）。
- `-only-testing`の対象テストを誤って削除し、「Executed 0 tests」が成功扱いになった。テスト関数を消していないか、変更前コミットとの関数一覧の差分で確認する。
- UIテストがランナーの遅さで実行時間の上限を超えた（`exceeded execution time allowance`）。`-retry-tests-on-failure`はタイムアウトを救ってくれないため、`-default-test-execution-time-allowance`／`-maximum-test-execution-time-allowance`とジョブの`timeout-minutes`を見直す。

### 互換性

- Web版が出力した`.knit`をアプリで復元する。
- アプリが出力した`.knit`をWeb版で復元する。
- 全記号を含むfixtureについて、ID、色、占有範囲、PNG/PDF表現を照合する。

## 10. 現在の実装状況

ローカルWebView、共通編集基盤、永続保存、scene phase、Files、UTType、共有、PNG/PDF、`.knit`、iPhone／iPad UI、自動テスト、unsigned Release Archive、プライバシー文書は実装済みです。未完了の実機検証、署名、TestFlight、App Store提出準備はマイルストーン[iOS 1.0](https://github.com/K0mork/knittingEditor/milestone/1)のIssueで管理し、実機での手順と証跡は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)に従います。

## 11. リリース判定

以下がすべて満たされるまでApp Store提出を行いません。

- [`SPECIFICATION.md`](SPECIFICATION.md)のP0要件を満たす。
- PRのci-gateに加え、変更を含むマージ後のコミットまたは後続のmainコミットでFull iOS validationの全端末テスト・更新復元・Release Archiveが成功し、指定実機確認も成功する。
- オフライン試験で外部通信が発生しない。
- Web版との`.knit`往復試験が成功する。
- 1000×1000盤面で編集・保存が破綻しない。
- 大きなPNGは安全に拒否され、PDFへ誘導される。
- プライバシーポリシー、App Privacy、審査用説明が実装内容と一致する。
- `docs/dev-log/`の記録に、実行した検証と未検証項目が書かれている。

## 12. GitHub運用

コミット・push・PR・マージの規則は[ルートの`AGENTS.md`](../AGENTS.md)と[`AGENTS.md`](AGENTS.md)に従う。GitHubへのpushやPRのマージはソース管理上の反映であり、TestFlightやApp Storeへの配布完了とはみなさない。
