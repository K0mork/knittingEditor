# App Storeメタデータ案

提出時にApp Store Connectへ転記するための下書き。文字数上限とURLは提出前にApp Store Connectで再確認する。Bundle IDは`com.k0mork.knittingEditor`で固定する。App名とホーム画面の表示名は2026-10-02に決めた（下記）。

## 基本情報

| 項目 | 下書き |
|---|---|
| App名 | 棒針編み図エディタ |
| ホーム画面の表示名 | 棒針編み図 |
| サブタイトル | オフラインで作れる棒針編み図 |
| 主カテゴリ | グラフィック／デザイン |
| 副カテゴリ | ライフスタイル |
| キーワード | 編み図,棒針,編み物,ニット,手芸,パターン,オフライン,PDF,PNG |
| 年齢制限 | 4+（質問票の回答は下記「年齢制限の質問票」） |

## App名とホーム画面の表示名

- App名は「棒針編み図エディタ」に決めた。Web版のタイトルと同じで、検索語の「棒針」「編み図」を含む。App名はApp Store全体で重複できず、使えるかはApp Store ConnectでAppを登録するときにしか確かめられない。使えなかった場合は、この節を更新してから登録する。
- ホーム画面の表示名（`App/Info.plist`の`CFBundleDisplayName`と`CFBundleName`）は「棒針編み図」にした。App名とは別の値で、アイコンの下に表示される。
- 表示名の長さには、Appleの文書に上限も推奨値もない（`CFBundleName`は15文字までとある）。切れるかどうかは文字の幅とアイコンの列幅で決まるため、2026-10-02にSimulatorのホーム画面で実測した。iPhone SE（第3世代、iOS 18.2）とiPhone 17（iOS 27.0）では、全角9文字の「棒針編み図エディタ」が標準の文字サイズで切れた。全角7文字は、標準では切れないが、文字サイズを大きくすると切れた（SEはアクセシビリティを使わない最大のサイズ、iPhone 17はアクセシビリティの最大サイズ）。全角6文字は、どの文字サイズでも切れなかった。iPhone 17 Pro MaxとiPad (A16)は列幅が広く、9文字でも切れなかった。
- このため、表示名は全角6文字以内とし、余裕のある5文字の「棒針編み図」を選んだ。`scripts/check-app-store-docs.sh`は、この表の値と`App/Info.plist`の表示名が一致し、6文字以内であることを検査する。
- 「拡大表示」（画面表示の拡大）と太字テキストはSimulatorでは確かめていない。実機の表示確認（#23）で、この2つでも切れないことを確かめる。

## 年齢制限の質問票

App Store Connectの年齢制限は、質問票への回答から決まる（2025年に区分が4+、9+、13+、16+、18+へ改定された）。2026-10-06に、Appleの[Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)を確認して回答を決めた。提出時は、その時点の質問票がこの表と同じ項目かを確かめてから入力する。

| 区分 | 項目 | 回答 | 理由 |
|---|---|---|---|
| アプリ内の管理機能 | ペアレンタルコントロール、年齢確認 | いいえ | どちらも無い |
| 機能 | 無制限のWebアクセス | いいえ | 下記 |
| 機能 | ユーザー生成コンテンツ、ソーシャルメディア、メッセージ・チャット、広告 | いいえ | アカウント、ユーザー間の交流、投稿、広告が無い |
| 成熟したテーマ | 下品な言葉、ホラー・恐怖、アルコール・タバコ・薬物 | なし | 編み図の編集と出力だけを扱う |
| 医療・ウェルネス | 医療・治療の情報、健康・ウェルネスの話題 | なし | 同上 |
| 性的表現・ヌード | すべて | なし | 同上 |
| 暴力 | すべて | なし | 同上 |
| 偶然性に基づく活動 | ギャンブル、疑似ギャンブル、コンテスト、ルートボックス | なし | 同上 |

- すべて「いいえ／なし」なので、年齢制限は4+になる。
- Appleは無制限のWebアクセスを、アプリ内で任意のページに移動したり、自由にWebを閲覧したりできることと定めている。このアプリのWKWebViewは同梱したページだけを表示し、`http`、`https`、`mailto`のリンクは`UIApplication.shared.open`で外部アプリ（Safariなど）に渡して、アプリ内では開かない（`App/WebViewContainer.swift`の`decidePolicyFor`）。このため該当しない。
- 次の変更をするときは、回答を見直す。
  - Pro（#38）を追加するとき。買い切りの課金はどの項目にも当たらない見込みだが、提出前に質問票を確かめ直す。
  - リンクをアプリ内で開くようにするなど、WKWebViewの表示範囲を変えるとき。
  - ユーザー間で編み図を共有する機能、広告、アカウントを加えるとき。

## 説明文案

棒針編みの編み図を、iPhoneとiPadで作成・保存・出力できるアプリです。

インターネット接続なしで、26種類の編み目記号を使ったCanvas編集、パン・ピンチズーム、複数の編み図管理、自動保存を利用できます。完成した編み図はPNGまたはPDF（1ページ／A4分割）で保存・共有できます。

編み図データは端末内に保存し、Web版や別の端末とは`.knit`バックアップで交換します。アカウント登録、サーバー同期、広告、利用分析はありません。

## URLと提出メモ

- サポートURL: `https://github.com/K0mork/knittingEditor/issues`（公開リポジトリが利用可能なことを提出前に確認）。アカウント無しで非公開に連絡できる窓口へ替える予定（#75）
- プライバシーポリシーURL候補: `https://github.com/K0mork/knittingEditor/blob/main/ios/docs/PRIVACY_POLICY.md`（App Store Connect登録前に公開状態と表示を確認）
- 審査メモ: [`APP_REVIEW_NOTES.md`](APP_REVIEW_NOTES.md)の4.2説明と機内モード手順を転記する。
- スクリーンショット: iPhone縦、iPhone横、iPad全画面、iPad可変幅を実機またはTestFlightで撮影して差し替える。

## 配信地域

- EU加盟国のストアでは配信しない（決定済み）。v1.0の無料版も、v1.1以降のPro（[`PRO_PLAN.md`](PRO_PLAN.md)）を含む版も対象にする。
- App Store Connectの「価格および配信状況」で、EU加盟国をすべて配信対象から外す。
- EUで配信しないため、デジタルサービス法（DSA）の事業者（trader）申告と、それに伴うEUのストアページでの連絡先の公開は求められない。
- EUで配信する方針に変えるときは、配信地域を変える前に、trader申告と公開する連絡先を決める。
- 中国本土のストアでも配信しない（2026-10-06に決定）。中国本土で配信するには、App Store ConnectへICP備案（ICP Filing）の番号を登録する必要があり、個人の開発者は取得できない。「価格および配信状況」で中国本土を配信対象から外す。

## 輸出コンプライアンス（暗号化）

- `App/Info.plist`に`ITSAppUsesNonExemptEncryption`を`false`で入れてある。アプリは通信を行わず、独自の暗号化も実装していないため、輸出規制の対象となる暗号化を使っていない。
- この値があると、App Store Connectはビルドをアップロードするたびの暗号化の質問を省く。`scripts/check-release-assets.sh`が値を検査する。
- 通信や暗号化を加える機能（iCloud同期、#30 など）を入れるときは、この判断を見直す。

## 第三者ソフトウェアのライセンス表記

- アプリにはReact、react-dom、scheduler、fflate（MIT）とidb（ISC）が入る。これらのライセンスは、配布物に著作権表示とライセンス文を含めることを条件にしている。
- ビルド時にリポジトリのルートの`scripts/third-party-notices.mjs`が、バンドルに実際に入ったパッケージのライセンス文から`/third-party-notices/`のページを作る。アプリ内の「使い方」の「ライセンス」から開ける。ライセンス文の無いパッケージが入るとビルドが失敗する。
- `scripts/check-app-bundle.sh`が、ページの同梱と主要なパッケージの記載を検査する。

## バージョンとビルド番号

- バージョン（`MARKETING_VERSION`、App Storeに表示される`1.0`など）は、リリースごとに`project.yml`で上げる。
- ビルド番号（`CURRENT_PROJECT_VERSION`）は`project.yml`では`1`のままにする。App Store Connectは、同じバージョンの中で前回より大きいビルド番号しか受け付けない。
- XcodeのOrganizerからアップロードするときは、配布オプションの「Manage Version and Build Number」をオンにする。Xcodeが、App Store Connectにあるビルドより大きい番号を付けてアップロードする。
- コマンドラインでArchiveするときは、`xcodebuild archive ... CURRENT_PROJECT_VERSION=<番号>`で、前回より大きい番号を指定する。
- アップロードしたビルド番号は、`REAL_DEVICE_RELEASE_CHECKLIST.md`のM6の証跡と`docs/dev-log/`の記録に書く。

## 申請前確認

- [ ] App名、サブタイトル、説明文、キーワードの文字数をApp Store Connectで確認する。
- [ ] App Privacyの回答をPrivacy Manifestと照合する。
- [x] Privacy Policy本文を`docs/PRIVACY_POLICY.md`へ用意する。
- [ ] 公開Privacy Policy URLをApp Store Connectへ登録し、審査端末から表示できることを確認する。
- [ ] スクリーンショットとアイコンを最終版へ差し替える。
