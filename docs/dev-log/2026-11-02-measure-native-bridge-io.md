# 2026-11-02 — ネイティブブリッジの変換・ファイル入出力を実機で測る準備

- 影響: 通常の保存・復元経路に永続signpostを追加。空のテスト用コンテナに限り、DEBUG設定で固定seedの1000×1000編み図を生成する。ReleaseのWeb bundleから生成処理を除外する。
- 主なファイル: `ios/App/BridgeSignposts.swift`、`NativeBridgeMessage.swift`、`ExportSession.swift`、`PickedBackupFile.swift`、`WebViewModel.swift`、`ios/Web/src/debugBridgeIO.ts`、`packages/editor-core/storage/bridgeMeasurementData.ts`、`ios/scripts/measure-bridge-io.sh`。XcodeGenでprojectも再生成した。
- テスト: 生成データの再現性・サイズ、既存文書へのseed拒否、区間名、DEBUG設定の許可リスト、xctrace XML集計。実機UIテスト`testBridgeIOOnRealDevice`を追加し、環境変数がないCIではskip、PR smokeは変更なし。
- 検証: Node v26.8.1、Xcode 27.2 (27B52)。`npm ci --ignore-scripts`、`npm run typecheck`、`npm test`（79 files / 972 tests）、`npm run build`、`npm run check:dist`成功。`npm test -- packages/editor-core/storage/bridgeMeasurementData.test.ts --silent=false`（2 tests）、`npm test -- scripts/summarize-bridge-intervals.test.mjs`（1 test）成功。`ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`、`../../node_modules/.bin/vitest run`（18 files / 149 tests）成功。`VITE_BRIDGE_IO_DEBUG=0 ../../node_modules/.bin/vite build`後に生成コードの文字列がないこと、同じDEBUG=1ビルドには専用chunkがあることを確認。
- 検証（続き）: `xcodegen generate --spec ios/project.yml`、`sh -n ios/scripts/measure-bridge-io.sh ios/scripts/measure-large-board.sh`、`bash -n ios/scripts/build-web.sh`、`node scripts/check-pr-smoke-ui-tests.mjs`、`sh ios/scripts/check-app-store-docs.sh`、`git diff --check`成功。
- 未検証: 指定の`xcodebuild -project ios/knittingEditor.xcodeproj -scheme knittingEditor -destination 'generic/platform=iOS Simulator' build`はDerivedDataの書込権限で失敗。`-derivedDataPath /tmp/bridge-io-derived`で再試行したが、既存のObservationマクロのpluginがmalformed responseとなりビルド失敗。Swift単体試験、UI試験、実機計測、ブラウザ/E2Eはこのサンドボックスでは実施できない。PR/full CIとリードによる実機検証が必要。
- 制約: Webの圧縮上限32 MiBのため100〜120 MBの通常復元は不可能。上限を変更せずsmall/medium/largeを1/4/8編み図（約4/16/32 MB）にした。128 MiB近傍は未達。実機測定結果はpending。xctrace helpの`--instrument`は確認できたがinstrument一覧は空で、os_signpost/Hangsの併用とXML schemaは実機側で要確認。WebKit候補の所属はInstrumentsで確認する。
- デプロイ影響: Pagesのユーザー動作変更なし。TestFlight/App Storeへの提出なし。Releaseにもsignpostは残す。マージ前に実機の新規コンテナで3サイズの往復、PNG/PDF保存先までの表示、各区間・プロセスメモリ・Hangs・端末のクラッシュ/Jetsamを確認する。実機結果が出るまで#26は完了扱いにしない。

通常のバックアップ復元で有効な最大サイズはWeb側の圧縮後32 MiB（`packages/editor-core/storage/backupCodec.ts:21` の `BACKUP_LIMITS.maxCompressedBytes`）。largeはその直下の約30.2 MiBとする。ネイティブの128 MiBはブリッジ自体の上限であり、通常の復元経路では到達しない。

- レビュー修正: pickerの複製読込から不要なsecurity scope操作を除去。既存large-boardスクリプトを変更前へ戻し、新規スクリプトではsignpost表欠落・集計不能を失敗にした。`docs/WEB_SYNC.md`にDEBUG初期化とCONFIGURATIONを記録。
- レビュー再検証: `npm run typecheck`、`npm test`（79 files / 973 tests）、ios/Webで`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`と`../../node_modules/.bin/vitest run`（18 files / 149 tests）、`npm test -- scripts/summarize-bridge-intervals.test.mjs`（2 tests）、上記shell構文・文書・smoke検査と`git diff --check`成功。Release Web再ビルドと生成コード文字列の不在、XcodeGen再生成前後の一致を確認。指定iOSビルドは再度DerivedData権限で失敗。実機・UI・Swift単体試験とE2Eはsandbox制約のため未実施。
