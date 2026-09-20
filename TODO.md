# TODO

優先度はP0（初回リリース必須）、P1（品質向上）、P2（将来候補）です。完了時は該当項目を更新し、同じコミットで`DEVELOPMENT_LOG.md`へ検証結果を記録します。

## M0: 技術検証・基盤（P0）

- [ ] Apple Developer Team、Bundle ID、アプリ名、署名方法を決定する
- [x] 対象iOS・iPadOSの下限と対応端末を決定する（iOS 17.0以上、iPhone・iPad）
- [x] SwiftUIユニバーサルアプリのXcodeプロジェクトを作成する
- [x] ローカルWeb資産を読み込む`WKWebView`の最小実装を作る
- [ ] ローカルoriginと永続`WKWebsiteDataStore`の更新耐性を確認する
- [ ] module Worker、Blob、Canvas、IndexedDB、Pointer Eventsの実機PoCを行う
- [ ] 機内モードで起動でき、外部通信がないことを確認する
- [ ] アプリ用Webビルド方式とXcodeへのコピー方式を自動化する

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

- [ ] IndexedDBの自動保存と編み図切替を検証する
- [x] scene phase変化をJavaScriptへ通知する
- [x] バックグラウンド移行時に保留中の保存をflushする
- [x] 保存完了、保存失敗、復旧案内を定義する
- [ ] アプリ更新を模擬し、既存IndexedDBを読み直せることを確認する
- [ ] 1000×1000盤面の保存・復元・メモリを実機測定する
- [ ] アプリ削除でデータが消えることをヘルプに明記する

完了条件: 通常終了、バックグラウンド、強制終了に近い操作を含む試験で、確定済みデータが破損しない。

## M3: Files・共有・バックアップ（P0）

- [ ] JavaScript–Swift間の型付きメッセージ仕様を決定する
- [ ] PNG、PDF、`.knit`をSwiftへ渡す処理を実装する
- [ ] Files保存と共有シートを実装する
- [ ] `.knit`用の独自UTTypeとDocument Typeを登録する
- [ ] Document Pickerから`.knit`を読み込む
- [ ] Files／AirDrop／他アプリから`.knit`を開く
- [ ] Web版出力fixtureをアプリで復元する
- [ ] アプリ出力fixtureをWeb版で復元する
- [ ] 不正形式、新しいカタログ、巨大解凍データを安全に拒否する

完了条件: Web版とアプリ版の双方向バックアップが成功し、PNG/PDFをFilesと共有先へ保存できる。

## M4: iPhone・iPad品質（P0）

- [ ] iPhoneの狭幅・縦横レイアウトを確認する
- [ ] iPad全画面・Split View・可変ウィンドウを確認する
- [ ] Safe Areaとキーボード表示時のレイアウトを修正する
- [ ] タッチ、ピンチ、パン、マウス、トラックパッドを実機確認する
- [ ] Apple Pencilを通常入力として確認する
- [ ] `prompt`／`confirm`をアプリ内ダイアログへ置換する
- [ ] VoiceOverラベル、フォーカス順、状態通知を整える
- [ ] Dynamic Typeと44 pt以上の操作領域を確認する
- [ ] 大規模PNG/PDFの上限とエラー表示を実機検証する

完了条件: 対象となるiPhone・iPad実機で主要操作、アクセシビリティ、出力が完了する。

## M5: 自動テスト・CI（P0）

- [ ] Web単体テストをCIへ追加する
- [ ] Swift単体テストを追加する
- [ ] XCUITestで起動、編集、再起動復元を検証する
- [ ] XCUITestでFiles入出力と共有導線を検証する
- [ ] 全記号fixtureのCanvas・PNG・PDF回帰テストを追加する
- [ ] ネットワーク要求を検出するオフライン試験を追加する
- [ ] iPhone・iPad SimulatorのCI matrixを作る
- [ ] リリースビルドのローカル資産完全性を検証する

完了条件: クリーン環境で全テスト、Archive、オフライン資産検査が再現可能に成功する。

## M6: TestFlight・App Store（P0）

- [ ] アイコン、起動画面、App Storeスクリーンショットを用意する
- [ ] アプリ内プライバシーポリシーとサポート導線を用意する
- [ ] App Privacyを「端末内のみ」の実装と一致させる
- [ ] Privacy Manifestと利用API理由を確認する
- [ ] TestFlight内部テストを実施する
- [ ] クラッシュ、メモリ警告、出力時間を確認する
- [ ] App Review 4.2向けにネイティブ統合内容を審査メモへ記載する
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
