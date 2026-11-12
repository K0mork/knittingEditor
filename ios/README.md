# knittingEditor for iOS / iPadOS

Web版「棒針編み図エディタ」を、インターネット接続なしで利用できるiOS・iPadOSアプリとして配布するためのプロジェクトです。

正式な統合先: <https://github.com/K0mork/knittingEditor>

旧アプリリポジトリ <https://github.com/K0mork/knittingEditor_app> は削除せず、履歴参照用の読み取り専用リポジトリとして保持します。アプリ履歴は統合先の [`23d0f98`](https://github.com/K0mork/knittingEditor/commit/23d0f98) で `ios/` 以下へ取り込み、統合コミット [`53de110`](https://github.com/K0mork/knittingEditor/commit/53de110) で `main` に反映しました。

iOS 17.0以上のSwiftUIユニバーサルアプリで、固定originのローカル`WKWebView`へ同梱Web資産を読み込みます。編集画面はルートの`packages/editor-core`を共通コードとして使い、Web資産はルートworkspaceから生成して同梱します。

## 基本方針

- 編集、保存、PNG/PDF生成、バックアップ復元をすべて端末内で完結させる。
- 実行時にWebサイト、CDN、API、Google Analyticsへ接続しない。
- Web版のReact、盤面モデル、Canvas描画、記号定義、PDF生成をアプリへ同梱して再利用する。
- Files、共有シート、アプリのライフサイクルはSwift側で統合する。
- SafariのIndexedDB・`localStorage`は読み込まない。
- Web版とのデータ交換には`.knit`ファイルを使用する。

## ドキュメント

規則と方針:

- [AGENTS.md](AGENTS.md): このディレクトリで作業する開発者・エージェント向けの必須規則（リポジトリ全体の規則はルートの[AGENTS.md](../AGENTS.md)）
- [DEVELOPMENT.md](DEVELOPMENT.md): 開発方針、構成、テスト戦略、CIの確かめ方、リリース判定
- [SPECIFICATION.md](SPECIFICATION.md): 機能仕様、データ互換、非機能要件
- [docs/NATIVE_BRIDGE.md](docs/NATIVE_BRIDGE.md): WebとSwiftの間のメッセージとイベント
- [../docs/WEB_SYNC.md](../docs/WEB_SYNC.md): Web版と共通にするコード、分けるファイルとその理由
- [docs/PRO_PLAN.md](docs/PRO_PLAN.md): 有料機能（Pro）の検討メモ。まだ実装しない

リリース:

- [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md): 提出・公開の手順（初回だけの加入・署名・アプリの登録は済み。更新版は手順5〜10）
- [docs/APP_STORE_CHECKLIST.md](docs/APP_STORE_CHECKLIST.md): 提出前に確かめる項目
- [docs/DEVICE_TESTING.md](docs/DEVICE_TESTING.md): 版ごとに行う実機確認の時期と手順
- [docs/REAL_DEVICE_RELEASE_CHECKLIST.md](docs/REAL_DEVICE_RELEASE_CHECKLIST.md): v1.0の公開までに行った実機・TestFlightの確認の記録と、個別の測定手順
- [docs/RELEASE_VERIFICATION_RECORDS.md](docs/RELEASE_VERIFICATION_RECORDS.md): 実機などで確かめた日ごとの環境と結果
- [docs/APP_STORE_METADATA.md](docs/APP_STORE_METADATA.md)・[docs/APP_REVIEW_NOTES.md](docs/APP_REVIEW_NOTES.md)・[docs/SCREENSHOTS.md](docs/SCREENSHOTS.md)・[docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md): App Store Connectへ入力する値、審査メモ、スクリーンショット、プライバシーポリシーの正本の場所
- [docs/SIMULATOR_PERFORMANCE_BASELINE.md](docs/SIMULATOR_PERFORMANCE_BASELINE.md): 統合前に観測したSimulator／Webの基準値
- [design/app-icon/README.md](design/app-icon/README.md): アプリアイコンの素材と再生成の手順

記録と作業:

- [GitHub Issues](https://github.com/K0mork/knittingEditor/issues): 未完了の作業と完了条件（リリースごとの作業は版の名前の[マイルストーン](https://github.com/K0mork/knittingEditor/milestones)）
- [../docs/dev-log/](../docs/dev-log/README.md): PRごとの変更と検証の記録
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md): 統合前の変更と検証記録（凍結アーカイブ）

## 現在の状態

Web編集画面、端末内保存、Files・共有シート、`.knit`入出力のネイティブ連携、iPhone／iPadのUI、自動テストとCIは実装済みです。

App Storeではv1.0（2026-11-06）とv1.1（2026-11-07）を公開しています。Apple Developer Programへの加入、署名、App Store Connectへのアプリの登録は初回の提出で済んでおり、更新版は[`docs/RELEASE_RUNBOOK.md`](docs/RELEASE_RUNBOOK.md)の手順5〜10で提出・公開します。1.1の公開後の確認は[#438](https://github.com/K0mork/knittingEditor/issues/438)、次の版の提出・公開は[#439](https://github.com/K0mork/knittingEditor/issues/439)で扱います。

残っている作業は[GitHub Issues](https://github.com/K0mork/knittingEditor/issues)（リリースごとの作業は版の名前の[マイルストーン](https://github.com/K0mork/knittingEditor/milestones)）、版ごとの実機確認の手順は[`docs/DEVICE_TESTING.md`](docs/DEVICE_TESTING.md)、v1.0の公開までに実機で確かめた範囲と例外は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)、提出の準備は[`docs/APP_STORE_CHECKLIST.md`](docs/APP_STORE_CHECKLIST.md)を正とします。CIの構成は[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)の「ビルドと公開」にあります。
