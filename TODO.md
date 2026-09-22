# TODO

優先度はP0（初回リリース必須）、P1（品質向上）、P2（将来候補）です。完了時は該当項目を更新し、同じコミットで`DEVELOPMENT_LOG.md`へ検証結果を記録します。

実機・署名・TestFlightが必要な残項目は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)の手順と証跡欄に従い、Simulatorの結果だけで完了にしません。

## M0: 技術検証・基盤（P0）

- [ ] Apple Developer Team、署名方法を決定する（無料Personal Teamで実機導入とM3・M4の確認まで到達済み。M0の機内モード試験とM6には有料加入が必要）
- [x] Bundle IDを`com.k0mork.knittingEditor`として固定する
- [ ] App Store表示名（アプリ名）を確定する
- [x] 対象iOS・iPadOSの下限と対応端末を決定する（iOS 17.0以上、iPhone・iPad）
- [x] SwiftUIユニバーサルアプリのXcodeプロジェクトを作成する
- [x] ローカルWeb資産を読み込む`WKWebView`の最小実装を作る
- [x] ローカルoriginと永続`WKWebsiteDataStore`の更新耐性を確認する（固定originでWebView置換後のIndexedDB復元をSimulator／CIで検証）
- [x] module Worker、Blob、Canvas、IndexedDB、Pointer Eventsの実機PoCを行う（iPhone 17／iPadOS 27.0実機とiPad Air 第5世代で、盤面描画=Canvas・Pointer Events、自動保存と再起動復元=IndexedDB、PNG／PDFのネイティブ保存導線到達=Blob・PDF module Workerを確認。機内モードでの確認は別項目）
- [x] iPhone／iPad SimulatorでCanvas・Blob・PDF module Workerの保存導線をスモーク検証する（実機PoCは別途）
- [ ] 機内モードで起動でき、外部通信がないことを確認する（iPad Air 第5世代実機で、機内モードでのホーム画面からの起動、26記号の表示、編集、PNG／PDF保存、`.knit`往復を確認済み。機内モード前後の通信監視のみ未了。機内モードでの自動テストは開発ツールが再インストールを行うため無料Personal Teamでは実行できない）
- [x] アプリ用Webビルド方式とXcodeへのコピー方式を自動化する

完了条件: iPhone・iPad実機でローカル資産から編集画面が起動し、再起動後も試験データが残る。

## M1: Web機能の取り込み（P0）

- [x] Web版コミット`8d33857`を初期同期元として記録する
- [x] カタログv3の26記号と`glyphs.ts`を取り込む
- [x] 永続ID 1〜26のスナップショットテストを追加する
- [x] React UI、Board、Canvas、blocks、export、storageをアプリ用ビルドへ組み込む
- [x] Web版専用のSEO、CNAME、サイトマップ、分析処理を除外する
- [x] `localStorage`旧版移行をアプリビルドで無効化する
- [x] 使い方ページをオフライン資産として同梱する
- [x] Web版由来の単体テストをアプリ側で実行できるようにする

完了条件: ネイティブ連携を除く既存Web機能がSimulatorと実機で動作し、全記号が表示される。

## M2: 保存・ライフサイクル（P0）

- [x] IndexedDBの自動保存と編み図切替を検証する（iPhone 16／iPad (10th generation) Simulator。実機は別途）
- [x] scene phase変化をJavaScriptへ通知する
- [x] バックグラウンド移行時に保留中の保存をflushする
- [x] 保存完了、保存失敗、復旧案内を定義する
- [x] アプリ更新を模擬し、既存IndexedDBを読み直せることを確認する（同一Bundle IDのversion 2を上書きインストールするiPhone／iPad Simulator試験）
- [ ] 1000×1000盤面の保存・復元・メモリを実機測定する
- [x] アプリ削除でデータが消えることをヘルプに明記する

完了条件: 通常終了、バックグラウンド、強制終了に近い操作を含む試験で、確定済みデータが破損しない。

## M3: Files・共有・バックアップ（P0）

- [x] JavaScript–Swift間の型付きメッセージ仕様を決定する
- [x] PNG、PDF、`.knit`をSwiftへ渡す処理を実装する
- [x] Files保存と共有シートを実装する
- [x] `.knit`用の独自UTTypeとDocument Typeを登録する
- [x] Document Pickerから`.knit`を読み込む
- [x] Files／AirDrop／他アプリから`.knit`を開く
- [x] iPhone／iPad SimulatorでDocument Picker表示とキャンセル復帰を検証する（実機Files保存は別途）
- [x] Web版出力fixtureをアプリで復元する（Web側のfixture復元、Swift bridgeの同一payload搬送、WebView ready後配送を検証）
- [x] アプリ出力fixtureをWeb版で復元する（アプリWeb bundleのexport→native bridge payload→Web import往復を検証）
- [x] 不正形式、新しいカタログ、巨大解凍データを安全に拒否する

完了条件: Web版とアプリ版の双方向バックアップが成功し、PNG/PDFをFilesと共有先へ保存できる。

## M4: iPhone・iPad品質（P0）

- [x] iPhone／iPad Simulatorで縦横回転、キーボード表示中のダイアログ、主要操作のアクセシブルな名前・選択状態を回帰検証する（実機確認は別途）
- [x] iPhone 16／iPad (10th generation) Simulatorの狭幅・縦横レイアウトを回帰検証する（実機確認は別途必要）
- [x] 最新iOS／iPadOS 27.0 Simulator（iPhone 18 Pro／iPad Pro 11-inch）でローカルWebView、主要UI、オフライン資産を確認する（実機・Split Viewは別途）
- [x] iPad全画面・Split View・可変ウィンドウを確認する（iPad Air 第5世代／iPadOS 27.0実機。全画面954×1373、可変ウィンドウ584×861、Split View 681.5×954の3配置で主要操作・パネル開閉・ダイアログ入力・盤面描画を確認）
- [x] Safe Areaを考慮したレイアウトとキーボード表示時のダイアログをSimulatorで回帰検証する（実機確認は別途必要）
- [ ] タッチ、ピンチ、パン、マウス、トラックパッドを実機確認する
- [ ] Apple Pencilを通常入力として確認する
- [x] `prompt`／`confirm`をアプリ内ダイアログへ置換する
- [x] VoiceOverラベル、パネル／ダイアログのフォーカス順・復帰、モード／保存状態通知を整える（実機VoiceOver確認は別途必要）
- [x] Canvasと保存状態へアクセシブルな名前・状態通知を付与する（実機VoiceOver確認は別途必要）
- [x] Dynamic Type対応のiOS system text style・rem縮尺と主要操作領域44px以上を実装し、最大アクセシビリティサイズをSimulatorで回帰検証する（実機表示確認は別途必要）
- [ ] Dynamic Type、VoiceOverフォーカス順、全画面レイアウトを実機確認する（Dynamic Type最大と全画面レイアウトはiPhone 17／iPad Air 第5世代実機で確認済み。横向きでヘッダー操作が画面外へ出る不具合を修正した。VoiceOverのフォーカス順が未実施）
- [ ] 大規模PNG/PDFの上限とエラー表示を実機検証する

完了条件: 対象となるiPhone・iPad実機で主要操作、アクセシビリティ、出力が完了する。

## M5: 自動テスト・CI（P0）

- [x] Web単体テストをCIへ追加する
- [x] Swift単体テストを追加する
- [x] XCUITestコードで起動、WebView、保存導線のスモーク検証を定義し、iPhone 16／iPad (10th generation) Simulatorで実行する
- [x] XCUITestで編集、再起動復元を検証する（iPhone 16／iPad (10th generation) Simulator。実機は別途）
- [x] XCUITestでFiles入出力と共有導線を検証する（ローカルiPhone／iPad Simulatorで`.knit`のDocument Picker、PNG/PDFのFiles操作、共有ボタンを確認。Xcode 15.4 CIではgzip生成UIテストのみ除外）
- [x] 全記号fixtureのCanvas・PNG・PDF回帰テストを追加する（実機のPNG表示確認は別途必要）
- [x] ネットワーク要求を検出するオフライン試験を追加する（Swift XCTestでローカルWeb起動中のfetch／XHR／WebSocket／EventSource呼び出しを検出し、CIで静的bundle検査と併用。機内モード実機確認は別途）
- [x] 生成アプリbundleの通信API・外部実行参照を静的検査する（実機の通信監視は別途必要）
- [x] 署名なしRelease Archiveとローカル資産検査をCIで再現する（Apple署名済みArchiveは別途必要）
- [x] iPhone・iPad SimulatorのCI matrixを作る
- [x] リリースビルドのローカル資産完全性を検証する

完了条件: クリーン環境で全テスト、Archive、オフライン資産検査が再現可能に成功する。

## M6: TestFlight・App Store（P0）

- [x] AppIcon 1024px資産を用意する（起動画面・App Storeスクリーンショットは別途必要）
- [x] `UILaunchScreen`へasset catalogの起動画面背景色を設定する（実機目視は別途必要）
- [x] iPhone／iPad SimulatorのApp Storeスクリーンショット下書きを`docs/screenshots/`へ保存する（実機最終版・起動画面は別途）
- [ ] 起動画面とApp Storeスクリーンショットを用意する
- [x] アプリ内プライバシーポリシーとサポート導線を用意する
- [x] App Privacyを「端末内のみ」の実装と一致させる
- [x] Privacy Manifestと利用API理由を確認する
- [ ] TestFlight内部テストを実施する
- [ ] クラッシュ、メモリ警告、出力時間を確認する
- [x] App Review 4.2向けにネイティブ統合内容を審査メモへ記載する
- [ ] App Store提出前チェックリストを完了する

完了条件: 承認されたビルドを提出でき、審査担当者がオフラインで主要機能を確認できる。

## P1: 初回リリース後

- [ ] Undo/Redoを設計する
- [ ] 複数ウィンドウ対応を評価する
- [ ] SwiftDataまたはドキュメントベース保存への移行価値を評価する
- [ ] iCloud同期をオプトイン機能として評価する
- [ ] Apple Pencil向け操作を評価する
- [ ] App Store Connectのプライバシー保護された分析だけで十分か評価する

## P2: 将来候補

- [ ] 共同編集
- [ ] 複数言語
- [ ] Android版との共有設計
