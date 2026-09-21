# Simulator／Web基準値

M6の実機・TestFlight検証へ進む前に、WebロジックとSimulator向け資産の回帰基準を記録する。ここに記載する時間は開発Mac上のVitest（jsdom、fake-indexeddb）での観測値であり、iPhone／iPad実機の性能保証やTestFlightのクラッシュ・メモリ検証を代替しない。

## 2026-09-21の観測

| 対象 | コマンド | 結果 |
| --- | --- | --- |
| Web全テスト | `cd Web && npm test -- --run` | 6 files、39 testsが成功。Vitest全体2.31秒 |
| Web資産の初回生成 | `scripts/build-web.sh` | 0.82秒。`AppResources/Web`へ生成 |
| Web資産の不変再実行 | `scripts/build-web.sh` | 0.04秒。ハッシュ一致でビルドとコピーを省略 |
| iOS 27 iPhoneのキャッシュ済みBuild & Run | XcodeBuildMCP `build_run_sim` | 6.2秒。既に起動済みのSimulator・DerivedDataを使用 |
| iOS 27 iPhoneの起動UIスモーク | `testLaunchShowsLocalEditorContainer` | テストケース7.3秒、テストランナー込み20.9秒 |
| iOS 18.2 iPadの縦横UI試験 | `testPrimaryControlsRemainUsableInPortraitAndLandscape` | テストケース29.1秒、テストランナー込み63.7秒 |
| iPadOS 27のクリーン端末での初期化上限（初回観測） | iPad Pro 11-inch (M5)の実UI起動 | WebKitのHTML読込は約2.1秒。IndexedDB初期化が30秒超で完了しない試行があり、10秒でエラー表示へ切り替える対策を追加 |
| iPadOS 27のクリーン端末再起動 | erase後の`build_run_sim`と手動起動 | 78.4秒はSimulatorブート・インストール込み。初回スプラッシュ後の手動再起動は18秒で編み図を表示、主要UIテストは34.0秒 |
| 1000×1000密集PDF | `cd Web && npm test -- --run src/export/pdf.worker.test.ts --reporter=verbose` | 4 tests成功。密集PDF生成の観測値1,511ms、20MB未満のサイズ検査も成功 |
| 1000×1000保存・復元 | `cd Web && npm test -- --run src/storage/database.test.ts --reporter=verbose` | 9 tests成功。保存・復元テストの観測値14ms |
| App Store／Archive資産 | `scripts/check-release-assets.sh <Simulator app path>` | ローカルWeb資産、Privacy Manifest、AppIcon、起動画面下書き、申請資料、画像解像度が成功 |

## 解釈と未実施

- 観測値は同一環境での比較用であり、固定SLAではない。
- iPadOS 27のクリーンSimulatorでは、WebKitのページ読込完了後もIndexedDBを含むアプリ初期化が停止する事象を確認した。これは通常のビルド待ちではなく、アプリが無期限スピナーにならないための10秒タイムアウトを実装した。実機での保存初期化性能は未確認である。
- `build_run_sim`の初回66.6秒はiOS 27ランタイムのブート・アプリインストールを含む。通常の再実行6.2秒とは分けて評価する。XCUITestのテストランナー時間にはビルド、Runner起動、アクセシビリティ階層の取得が含まれる。
- jsdomとfake-indexeddbの結果なので、実機WebKitのCanvas、Worker、IndexedDB、メモリピークを測定していない。
- PNGの大規模出力、実機メモリ警告、クラッシュログ、TestFlightビルドの出力時間は未確認である。
- 実機測定時は[`REAL_DEVICE_RELEASE_CHECKLIST.md`](REAL_DEVICE_RELEASE_CHECKLIST.md)へ端末、ビルド、ピークメモリ、出力ファイル、再現手順を記録する。
