# App Storeメタデータ案

提出時にApp Store Connectへ転記するための下書き。文字数上限、表示名、URLは提出前にApp Store Connectで再確認する。Bundle IDは`com.k0mork.knittingEditor`で固定し、App Store表示名はこの案をもとに提出前に確定する。確定までは`App/Info.plist`の内部表示名と同一視しない。

## 基本情報

| 項目 | 下書き |
|---|---|
| App名 | 棒針編み図エディタ |
| サブタイトル | オフラインで作れる棒針編み図 |
| 主カテゴリ | グラフィック／デザイン |
| 副カテゴリ | ライフスタイル |
| キーワード | 編み図,棒針,編み物,ニット,手芸,パターン,オフライン,PDF,PNG |
| 年齢制限 | 4+相当（アカウント、広告、ユーザー投稿なし） |

## 説明文案

棒針編みの編み図を、iPhoneとiPadで作成・保存・出力できるアプリです。

インターネット接続なしで、26種類の編み目記号を使ったCanvas編集、パン・ピンチズーム、複数の編み図管理、自動保存を利用できます。完成した編み図はPNGまたはPDF（1ページ／A4分割）で保存・共有できます。

編み図データは端末内に保存し、Web版や別の端末とは`.knit`バックアップで交換します。アカウント登録、サーバー同期、広告、利用分析はありません。

## URLと提出メモ

- サポートURL: `https://github.com/K0mork/knittingEditor/issues`（公開リポジトリが利用可能なことを提出前に確認）
- プライバシーポリシーURL候補: `https://github.com/K0mork/knittingEditor/blob/main/ios/docs/PRIVACY_POLICY.md`（App Store Connect登録前に公開状態と表示を確認）
- 審査メモ: [`APP_REVIEW_NOTES.md`](APP_REVIEW_NOTES.md)の4.2説明と機内モード手順を転記する。
- スクリーンショット: iPhone縦、iPhone横、iPad全画面、iPad可変幅を実機またはTestFlightで撮影して差し替える。

## 申請前確認

- [ ] App名、サブタイトル、説明文、キーワードの文字数をApp Store Connectで確認する。
- [ ] App Privacyの回答をPrivacy Manifestと照合する。
- [x] Privacy Policy本文を`docs/PRIVACY_POLICY.md`へ用意する。
- [ ] 公開Privacy Policy URLをApp Store Connectへ登録し、審査端末から表示できることを確認する。
- [ ] スクリーンショットとアイコンを最終版へ差し替える。
