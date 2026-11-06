# v1.0 提出・公開の手順

v1.0をApp Storeへ提出・公開するまで、次の順に進める。Apple Developer Programへの個人での加入と有料のTeamでの署名（手順1〜3）は2026-11-02に、App Store Connectでのアプリの登録から審査への提出まで（手順4〜7）は2026-11-03に済んだ。v1.0は2026-11-05にガイドライン5.2.5で却下され、サブタイトルを直して同日に再提出した（[手順7](#7-審査に提出する再提出済み審査待ち)）。[手順8](#8-審査と並行してtestflightで提出ビルドを実機で確かめる)の提出ビルドの実機確認も2026-11-03に済んだ。次は承認を待って[手順9](#9-承認後に公開し確認と記録を残す)へ進む。全項目の管理は[提出チェックリスト](APP_STORE_CHECKLIST.md)、入力値の正本は[メタデータ](APP_STORE_METADATA.md)、実機の手順と証跡は[実機リリースゲート](REAL_DEVICE_RELEASE_CHECKLIST.md)を使う。v1.1以降の更新版は[手順10](#10-更新版を提出する)を加えて進める。

個人情報・Team ID・App Store ConnectのApp ID・登録画面の無加工画像を、公開リポジトリやGitHubへ載せない。非公開の入力値はメインチェックアウトのルートの `private/APP_STORE_CONNECT.md` を参照する。worktreeに別の `private/` は作らない。

## 1. 提出前の準備を確認する（済み）

[実装・資産](APP_STORE_CHECKLIST.md#実装資産)のチェック済み項目を短く確認する。アイコン、提出サイズのスクリーンショット、Privacy Manifest、同梱ヘルプ、公開ポリシーとサポートページ、メタデータ・審査メモの下書き、輸出コンプライアンス設定、ライセンス表記は準備済み。過去のCI・開発ビルドの実機確認も記録済みである。

- **完了の目安:** 準備済みの資産と文書の場所が分かり、提出ビルドの実機確認とApp Store Connectへの登録が残っていると確認できた。
- **関係するIssue／項目:** [#27](https://github.com/K0mork/knittingEditor/issues/27)、提出チェックリストの「実装・資産」のチェック済み項目と[検証・配布](APP_STORE_CHECKLIST.md#検証配布)。

## 2. 個人で加入する（済み）

Apple Developer Programへ個人で加入し、2026-11-02に有効になったことを確かめた（[#17](https://github.com/K0mork/knittingEditor/issues/17)）。販売元の表示は[販売元と著作権表記](APP_STORE_METADATA.md#販売元と著作権表記)の決定に従う。本人確認・問い合わせ・契約・支払いの経緯と時刻付きの履歴は、メインチェックアウトの `private/ACCOUNTS.md` にある。

- **完了の目安:** 加入が承認され、有料のDeveloper TeamをXcodeで選べる。
- **関係するIssue／項目:** [#17の決定](https://github.com/K0mork/knittingEditor/issues/17#issuecomment-5947707637)、提出チェックリスト「Apple Developer Team、Bundle ID、署名証明書、Provisioning Profile」。

## 3. XcodeでAutomatic署名を設定する（済み）

2026-11-02に、有料のTeamのAutomatic署名で`com.k0mork.knittingEditor`の証明書とProvisioning Profileが解決し、iPhone・iPadへ入れて起動し、再起動後もデータが残ることを確かめた（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-02-有料teamでの署名と実機導入iphone-17--ios-272ipad-air-第5世代--ipados-272有線)）。開発ビルドは機内モードで自動テストを起動できないため、M0の機内モードの確認は、TestFlightで配る提出ビルドで行う（手順8）。

Macや端末を替えて設定し直すときは、次のとおりにする。

1. XcodeのAccountsへ加入したApple Accountを追加する。プロジェクト未生成なら、リポジトリルートで `xcodegen generate --spec ios/project.yml` を実行して開く。
2. `knittingEditor`ターゲットのSigning & Capabilitiesで「Automatically manage signing」を維持し、加入したTeamを選ぶ。設定の基準は[project.yml](../project.yml)（`CODE_SIGN_STYLE: Automatic`）。
3. Bundle IDが `com.k0mork.knittingEditor` のままで、そのTeamのIdentifiersに登録され、証明書・Provisioning Profileが解決されることを確かめる。既存の登録との衝突があれば、別のBundle IDに変えず原因を確認する。
4. [実施前の固定情報・接続確認](REAL_DEVICE_RELEASE_CHECKLIST.md#実施前の固定情報)に従い、接続確認スクリプトとiPhone・iPadへの署名済みビルドの導入を行う。Team IDや署名情報はリポジトリへ保存しない。

CIは署名なしのまま変更しない。CIのXcode更新は[#289](https://github.com/K0mork/knittingEditor/issues/289)で別管理されており、提出のために待つ必要はない。

- **完了の目安:** Automaticで署名が解決し、iPhone・iPadでローカル資産から起動して再起動後もデータが残る。
- **関係するIssue／項目:** [#17](https://github.com/K0mork/knittingEditor/issues/17)、#289、提出チェックリストの署名項目、実機ゲートM0。

## 4. App Store Connectでアプリを登録する（済み）

2026-11-03に、App Store Connectで次のとおり新規Appを作成し、v1.0が「提出準備中」になったことを確かめた（[#18](https://github.com/K0mork/knittingEditor/issues/18)）。App名「棒針編み図エディタ」は重複せずに使えたので、App名の文書は直していない。SKUの値はルートの `private/APP_STORE_CONNECT.md` に記録した。

- プラットフォーム: iOS
- App名: 棒針編み図エディタ
- プライマリ言語: 日本語
- Bundle ID: `com.k0mork.knittingEditor`（手順3でXcodeのAutomatic署名が登録したもの）
- ユーザアクセス: アクセス制限なし

アプリを登録し直すときは、次のとおりにする。

App Store Connectの「マイApp」から新規Appを作り、プラットフォームはiOS、主言語は日本語、Bundle IDは手順3の登録を選ぶ。App名は[基本情報](APP_STORE_METADATA.md#基本情報)に従う。重複で使えない場合は、[App名とホーム画面の表示名](APP_STORE_METADATA.md#app名とホーム画面の表示名)のとおり文書を更新してから登録する（#18）。

SKUは製品管理用の一意な文字列を利用者が決め、登録値はルートの `private/APP_STORE_CONNECT.md` に記録する。App Store Connectが発行するApp IDやTeam IDと混同しない。

- **完了の目安:** 目的のBundle IDとApp名でアプリのレコードが作成され、v1.0の入力・ビルド登録へ進める。
- **関係するIssue／項目:** [#18の残件](https://github.com/K0mork/knittingEditor/issues/18#issuecomment-5947707284)、[#27](https://github.com/K0mork/knittingEditor/issues/27)、メタデータの基本情報・App名。

## 5. 提出用Release Archiveを作成し、検査・アップロードする（済み）

2026-11-03に、`main`の`b0a7f26`（`ci-gate`とFull iOS validationの全ジョブが成功）から手元のXcode 27.2（`27B52`）でArchiveを作り、`check-release-assets.sh`が通り、`DTSDKName`が`iphoneos27.2`であることを確かめてアップロードした。App Store Connectに登録されたのは版1.0のビルド1（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-提出用アーカイブのアップロードと審査への提出)）。2026-11-04に、`b0a7f26`へタグ`ios-v1.0-build1`を付けた。

更新版や作り直しのときは、次のとおりにする。


1. 提出するソースのコミットを固定する。[検証・配布](APP_STORE_CHECKLIST.md#検証配布)に従い、提出候補PRの `ci-gate` と、その候補を含むmainコミットの `Full iOS validation`（iPhone・iPad全テスト、両端末のapp_update、unsigned Release Archive・資産検査）の成功を確認する。失敗Issueがあれば調査・修正する。
2. **手元のXcode 27.1（iOS 27.1 SDK）以降**を使う。Xcode 26.6固定のCIアーカイブは提出に使わない。iPhone Duoでの全画面表示（#96）に加え、2027年4月からはiOS 27 SDK以降でのビルドがAppleの必須要件になる。版の根拠と検査条件は提出チェックリストの「提出用のアーカイブ」、CIとの違いは[#289](https://github.com/K0mork/knittingEditor/issues/289)を参照する。
3. Xcodeでscheme `knittingEditor`、実機向けの汎用destination（Simulatorではない）を選び、Archiveの構成がReleaseであることを確認して、Product > Archiveを実行する。構成・destination・検査の参照元は[`release_archive`ジョブ](../../.github/workflows/ios-full.yml)とする。ただし、ローカルの提出用署名を有効にし、CIの `CODE_SIGNING_ALLOWED=NO`／`CODE_SIGNING_REQUIRED=NO` は付けない。
4. Organizerで対象ArchiveをFinderに表示し、リポジトリルートから次を実行する。パスは実際のArchiveへ置き換える。

   ```sh
   ios/scripts/check-release-assets.sh "/path/to/knittingEditor.xcarchive/Products/Applications/knittingEditor.app"
   /usr/libexec/PlistBuddy -c 'Print :DTSDKName' "/path/to/knittingEditor.xcarchive/Products/Applications/knittingEditor.app/Info.plist"
   /usr/libexec/PlistBuddy -c 'Print :DTXcodeBuild' "/path/to/knittingEditor.xcarchive/Products/Applications/knittingEditor.app/Info.plist"
   ```

   資産検査の成功に加え、`DTSDKName` が `iphoneos27.1` 以降、`DTXcodeBuild` がXcode 27.1以降のビルド番号であることを確認する（27.1正式版は `27A9275`）。Xcodeの選択表示だけで済ませない。
5. [バージョンとビルド番号](APP_STORE_METADATA.md#バージョンとビルド番号)に従い、OrganizerのDistribute AppからApp Store Connectへアップロードする。「Manage Version and Build Number」をオンにし、前回より大きいビルド番号を使う。`project.yml` の `MARKETING_VERSION` は提出する版の番号（v1.0なら`1.0`、v1.1なら`1.1`）、`CURRENT_PROJECT_VERSION` は `1` のままとする。コマンドラインのArchiveでは同節のビルド番号指定に従う。
6. App Store Connectで処理完了を待ち、実際に登録されたバージョン・ビルド番号を記録する。内部テストからApp Reviewへ提出できるビルドとしてアップロードする（内部テスト専用の配布に限定しない）。
7. Archiveを作ったコミット（1で固定したコミット）に、登録されたバージョンとビルド番号を名前にした注釈付きタグを付けて、GitHubへpushする。記録を書いたコミットやマージ先の新しいコミットには付けない。TestFlightだけで配ったビルドも含め、App Store Connectに登録されたビルドごとに1つ付ける。

   ```sh
   git tag -a ios-v<バージョン>-build<ビルド番号> <コミット> -m "iOS <バージョン> (<ビルド番号>): uploaded to App Store Connect on YYYY-MM-DD"
   git push origin ios-v<バージョン>-build<ビルド番号>
   ```

   pushしたタグは動かしたり消したりしない。同じコミットから作り直してアップロードしても、ビルド番号が変わるので新しいタグを付ける。タグの名前は手順8以降の記録にも書く。

- **完了の目安:** SDK・Xcode・同梱資産の検査が通り、対象コミットに対応するビルドがApp Store Connectで処理済みになり、そのコミットにバージョンとビルド番号のタグが付いた。
- **関係するIssue／項目:** [#25](https://github.com/K0mork/knittingEditor/issues/25)、#289、提出チェックリストの候補CI・提出用アーカイブ・ビルド番号、実機ゲート[M6](REAL_DEVICE_RELEASE_CHECKLIST.md#m6-testflightapp-store)。

## 6. App Store Connectの提出情報を入力する（済み）

2026-11-03に入力し、登録画面を下の参照先と照合した。任意のヘッダと検索結果の画像は入れず、質を上げてから次の版以降で入れる。アクセシビリティの表示は、2026-11-03に提出ビルドと同じアプリで確かめて回答を決めた（[確認の記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-アクセシビリティの表示の確認)、[提出の記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-提出用アーカイブのアップロードと審査への提出)）。


入力値は次の参照先から転記し、画面の必須項目・質問が変わっていないかを提出時に確認する。

| 入力・確認するもの | 参照先と進め方 |
|---|---|
| App名、カテゴリ、サブタイトル、キーワード等 | [基本情報](APP_STORE_METADATA.md#基本情報)、[説明文案](APP_STORE_METADATA.md#説明文案)、[製品ページの任意項目](APP_STORE_METADATA.md#製品ページの任意項目)。文字数を実画面で確認する |
| App Privacy、第三者コンテンツ、サインイン、審査連絡先 | [App Store Connectの質問への回答](APP_STORE_METADATA.md#app-store-connectの質問への回答)。Privacy Manifestと照合し、データ収集なしとする。連絡先の値はルートの `private/APP_STORE_CONNECT.md` |
| Privacy Policy URL・サポートURL | [URLと提出メモ](APP_STORE_METADATA.md#urlと提出メモ)、[Privacy Policyの正本](PRIVACY_POLICY.md)、[サポート窓口](APP_STORE_METADATA.md#サポート窓口)。公開HTTPSページを確認してから登録する。サポートメールの外部からの受信・返信は確認済み（提出チェックリスト） |
| 年齢制限 | [年齢制限の質問票](APP_STORE_METADATA.md#年齢制限の質問票)。回答後に4+になることを確認する |
| 配信地域・DSA | [配信地域](APP_STORE_METADATA.md#配信地域)と[質問への回答](APP_STORE_METADATA.md#app-store-connectの質問への回答)。EU加盟国と中国本土を外し、DSA申告も済ませる |
| 価格 | [質問への回答](APP_STORE_METADATA.md#app-store-connectの質問への回答)のv1.0無料を設定する |
| 販売元・著作権 | [販売元と著作権表記](APP_STORE_METADATA.md#販売元と著作権表記)。販売元の表示を確認し、著作権欄は同節の公開表記にする |
| 審査メモ | [質問への回答](APP_STORE_METADATA.md#app-store-connectの質問への回答)から[審査メモ](APP_REVIEW_NOTES.md)の英語・日本語を転記する |
| スクリーンショット | [スクリーンショットの説明文](APP_STORE_METADATA.md#スクリーンショットの説明文)から[最終版の画面・順・ファイル](SCREENSHOTS.md#app-store-connect提出用最終版)へ進み、iPhoneの欄には6.3インチ（1206×2622）、iPadの欄には13インチの5枚を登録する。iPhoneの欄はmedium displayの大きさしか受け付けず、6.9インチの画像は使えない。2027年4月以降の提出では、[iPhone Duo](SCREENSHOTS.md#iphone-duo)の外側か内側の片方の5枚も登録する（iOS 27.1 SDK以降のアプリで必須、#353） |
| ヘッダと検索結果（任意） | [製品ページのヘッダと検索結果](SCREENSHOTS.md#製品ページのヘッダと検索結果)の共通の画像を「Header and Search Results」のHeaderに入れ、Search Resultsで「Use header asset in search results」をオンにする。Previewで見え方を確かめる |
| 輸出コンプライアンス | [輸出コンプライアンス（暗号化）](APP_STORE_METADATA.md#輸出コンプライアンス暗号化)。アップロードしたビルドの設定と質問の有無を確認する |
| アクセシビリティの表示 | [アクセシビリティの表示](APP_STORE_METADATA.md#アクセシビリティの表示accessibility-nutrition-labels)。表の回答どおりに入力する。回答は版を出さずに変えられる |

MacとApple Vision Proは[#86の決定コメント](https://github.com/K0mork/knittingEditor/issues/86#issuecomment-6010786273)に従い、**v1.0では既定のまま配信を止めない**。両環境の動作確認はv1.0の必須条件に追加しない。提出チェックリストの未チェック欄は、この決定への参照とともに扱いを記録する。

- **完了の目安:** #27の入力がそろい、[提出チェックリストの「検証・配布」](APP_STORE_CHECKLIST.md#検証配布)と実機ゲートM6の登録内容照合を終え、手順8で審査と並行して確かめる提出ビルドの実機確認のほかに、未解決の必須項目がない。
- **関係するIssue／項目:** [#27](https://github.com/K0mork/knittingEditor/issues/27)、[#86](https://github.com/K0mork/knittingEditor/issues/86)、提出チェックリストのApp Privacyから配信地域までの各登録項目、実機ゲートM6。

## 7. 審査に提出する（再提出済み、審査待ち）

2026-11-03 11:14（JST）に、ビルド1を選び、手動公開にして提出した（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-提出用アーカイブのアップロードと審査への提出)）。2026-11-05に、ガイドライン5.2.5（法的事項：知的財産）で却下された。サブタイトルの「iPhone」「iPad」が、Appleの製品名の不適切な使い方とされた。指摘はメタデータだけなので、ビルド1のまま、App Store Connectの「App情報」でサブタイトルを「編み図を簡単に作成・印刷」に替え、2026-11-05 17:22（JST）に再提出した（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-05-審査の却下ガイドライン525とサブタイトルの変更)）。承認されるまで、この手順は完了にしない。


1. 手順5でアップロードし、処理済みになったビルド番号をv1.0に選ぶ。[提出チェックリスト](APP_STORE_CHECKLIST.md)を再確認し、任意項目・将来対応と、手順8で審査と並行して確かめる提出ビルドの実機確認とを区別する。それ以外の必須の未完了があれば先に解消する。
2. 公開方法は**手動公開**にして、提出前にApp Store Connectへ設定する。手順8の確認が承認より後に終わっても、確認の前に公開されないようにするためである。内容を保存して審査へ追加し、最終の提出操作まで進める。
3. 審査は通常1〜2日を目安にするが、追加確認等で長くなる場合もある（[Appleの審査案内](https://developer.apple.com/jp/help/app-review/after-submitting-for-review/request-expedited-review/)）。App Store Connectの状態とAppleからの連絡を確認する。
4. リジェクトされたら、指摘された条項と再現手順を読み、再提出する前に、App Store Connectでアプリの状態を確かめて対応を選ぶ。Appleの案内は状態ごとに違う（[App and submission statuses](https://developer.apple.com/help/app-store-connect/reference/app-and-submission-statuses)、2026-11-05に確認）。審査担当者への返信は再提出するまでしか送れない（[Reply to App Review messages](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages/)）ので、返信が要るときは再提出の前に送る。アプリの説明と確認手順は[審査メモ](APP_REVIEW_NOTES.md)にある。
   - 状態が「Metadata Rejected」（メタデータの却下）なら、メタデータを直してから審査担当者に返信し、直したことを伝える。Appleはこの状態では再提出ではなく返信を案内している。
   - 状態が「Rejected」（却下）なら、指摘された項目を直し、提出の詳細画面の「Resubmit to App Review」で再提出する（[Manage a submission with unresolved issues](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/manage-a-submission-with-unresolved-issues/)）。メタデータだけの指摘なら、同じビルドのまま出せる。
   - コードの修正が要るなら、新しいビルド番号で手順5〜8をやり直して再提出する。
   - メタデータを直したときは、正本の[メタデータ](APP_STORE_METADATA.md)も直す。
   - 2026-11-05のv1.0の却下（ガイドライン5.2.5）では、状態を確かめないまま再提出した。この手順は案内に沿っているが、状態がMetadata Rejectedだったなら、返信だけで審査が続いた可能性がある。再提出した後で審査から取り下げると、状態は「Developer Rejected」になって再提出し直すしかなく、返信の道には戻れない。

- **完了の目安:** 提出が受理され、最終的に承認を確認できた。審査待ち・審査中・リジェクトは承認として扱わない。
- **関係するIssue／項目:** [#27](https://github.com/K0mork/knittingEditor/issues/27)、提出チェックリストの全必須項目と「提出後の承認」、実機ゲートM6。

## 8. 審査と並行して、TestFlightで提出ビルドを実機で確かめる

2026-11-03に、TestFlightの1.0 (1)をiPhone 17とiPad Air 第5世代へ入れ、下の2〜5を確かめた。公開を止める問題は無かった（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-testflightでの提出ビルドの確認2526)）。オフラインのiCloud Driveの`.knit`で理由の分かる表示にならないことは、v1.0では合格とし#387で扱う。同日、TestFlightのビルドでは確かめられない読み込み直前のファイル削除（M3）を、アプリのコードが同じ開発ビルドで両端末で確かめた（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-読み込み直前のファイル削除の確認m3)）。

手順7で提出したら、審査の結果を待たずに始める。提出ビルドの実機確認は、提出の条件ではなく公開の条件とする（2026-11-02の決定。提出を早めるため）。Appleは提出の前にTestFlightを通すことを求めていない。手順5でアップロードしたビルドはそのままTestFlightにも出るので、確認のために別のビルドを作らない。

1. 処理済みビルドを内部テストグループへ追加し、iPhone・iPadへTestFlightからインストールする（#25）。以降は**審査に出したのと同じビルド番号**で確認する。
2. [M0](REAL_DEVICE_RELEASE_CHECKLIST.md#m0-オフライン起動とweb-api-poc)・[M6](REAL_DEVICE_RELEASE_CHECKLIST.md#m6-testflightapp-store)に従い、機内モードでホーム画面から起動し、編集、自動保存、再起動後の復元、PNG／PDF、`.knit`保存・復元、ヘルプを確認する。開発ビルドのチェック済み実績で提出ビルドの確認を省略しない。
3. [M3: Files・共有・外部バックアップ](REAL_DEVICE_RELEASE_CHECKLIST.md#m3-files共有外部バックアップ)の往復・異常系を両端末で確認する。機内モードのローカル保存を先に行い、AirDrop等は必要な通信を戻して確認する。存在しないファイル等の未確認項目は、未確認のまま記録し、完了扱いにしない。
4. #26として、[M2の測定手順と判定](REAL_DEVICE_RELEASE_CHECKLIST.md#m2-保存復元大規模盤面)を参照して1000×1000盤面、PNG上限超過の拒否、PNG／PDF出力時間、クラッシュログ・メモリ警告を提出ビルドで確認する。開発ビルドを再インストールする測定スクリプトの結果を、TestFlightビルドの結果として扱わない。
5. [M4](REAL_DEVICE_RELEASE_CHECKLIST.md#m4-画面入力アクセシビリティ)・M6の最終画面（AppIcon、起動画面、iPhone縦横、iPad全画面・可変幅）を確認して証跡を残す。製品ページへ登録する画像は[最終版スクリーンショット](SCREENSHOTS.md#app-store-connect提出用最終版)を使い、実際の提出ビルドとの一致を確かめる。
6. 問題が見つかったら公開しない。審査中なら審査から取り下げ、承認後の公開待ちならそのビルドを却下して、直した新しいビルド番号で手順5からやり直す。

- **完了の目安:** 両端末で提出ビルドの確認が完了し、ビルド番号・コミット・端末／OS・結果・未実施項目とM6の証跡がそろった。これがそろうまで手順9の公開操作をしない。問題を直して再アップロードした場合は、手順5から戻り、新しいビルドで再提出し、必要な確認をやり直す。
- **関係するIssue／項目:** [#25](https://github.com/K0mork/knittingEditor/issues/25)、[#26](https://github.com/K0mork/knittingEditor/issues/26)、提出チェックリストの機内モード・Files／AirDrop・大規模盤面・クラッシュ、実機ゲートM0・M2・M3・M4・M6と[記録ルール](REAL_DEVICE_RELEASE_CHECKLIST.md#記録ルール)。

## 9. 承認後に公開し、確認と記録を残す

公開方法は手順7のとおり手動公開にする（[Appleの公開オプション](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)）。承認後、公開待ちの状態で、手順8の確認が完了し問題がないことを確かめてから、利用者が公開操作を行う。自動公開（日時指定を含む）を使いたい版は、手順8を提出の前に終えてから提出する。自動公開では、手順8の確認より先に公開されることがあるためである。

アクセシビリティの表示は、版がリリースされるまで下書きのまま公開できない。v1.0では2026-11-03に下書きとして入力済みなので、リリースされたら「アプリのアクセシビリティ」で公開する。

公開操作・自動公開の後、ストアへの反映を待つ。Appleの案内では表示まで最大24時間かかる場合がある。対象地域の製品ページで説明・画像・無料表示・リンクを確認し、App StoreからインストールしたiPhone・iPadで起動、保存・復元、PNG／PDF・`.knit`の主要フローを確認する。承認前に「App Store配布完了」と報告しない。承認後も、公開待ち・反映待ち・公開確認済みを区別して記録する。

[実機ゲートの記録ルール](REAL_DEVICE_RELEASE_CHECKLIST.md#記録ルール)と[開発ログの書式](../../docs/dev-log/README.md)に従い、実施日、コミット、提出・公開したビルド番号、端末／OS、結果、残件、配布影響、証跡の場所を残す。提出チェックリストとM6を実施結果に合わせて更新する。個人情報・テスターの識別情報・登録画面等の非公開証跡は公開せず、ルートの `private/` 内の保管場所だけを記す。

変更・確認の記録は該当PRの `docs/dev-log/` に含め、マージ後に行った確認はそのPRへのコメントで残す。結果の追記だけのPRは作らない。Issueの古い本文が凍結済みの [`DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md) を指していても、新しい記録は `docs/dev-log/` を使う。完了条件を満たしたIssueだけを、完了するPRの `Closes #番号` で閉じる。

- **完了の目安:** 承認とストア公開を確認し、公開版の主要フローとチェックリストの証跡・記録がそろった。未実施項目は明示されている。
- **関係するIssue／項目:** [#25](https://github.com/K0mork/knittingEditor/issues/25)・[#26](https://github.com/K0mork/knittingEditor/issues/26)・[#27](https://github.com/K0mork/knittingEditor/issues/27)、提出チェックリスト末尾の承認確認、実機ゲートM6・記録ルール。

## 10. 更新版を提出する

v1.1以降の更新版も、手順5〜9に従ってビルド・確認・入力・提出・公開する。2027年4月以降の提出では、iOS 27 SDK以降でのビルドとiPhone Duoのスクリーンショットが必要になる（手順5・6）。UIを変えた版では、iPhone Duoの画像も撮り直す。バージョン番号は[バージョンとビルド番号](APP_STORE_METADATA.md#バージョンとビルド番号)に従って上げる。App Review Guidelinesは、新しい機能を審査メモに具体的に書くよう求めており（2.3.1(a)。一般的な説明はリジェクトの対象になる）、説明のない機能を禁じている（2.5.19）。このため、手順6で審査メモを転記する前に、次のとおり[審査メモ](APP_REVIEW_NOTES.md)を直す。

1. 前に公開した版のタグ（`ios-v1.0-build1`など、手順5の7）から提出するコミットまでの、マージ済みPRと `docs/dev-log/` の記録を読み、利用者が使える機能・操作で増えたものと変わったものを書き出す。不具合の修正だけで、操作が変わらないものは除いてよい。
2. 審査メモの英語・日本語の両方に、その版で増えた機能・変わった操作と、審査担当者が確かめる手順を具体的に書く。「不具合の修正と改善」のような一般的な説明だけにしない。アプリ内課金を加える版では、購入・復元を確かめる手順も書く（[#38](https://github.com/K0mork/knittingEditor/issues/38)）。
3. 画面のボタンに出ない操作（ジェスチャー、キーボードショートカット、Apple Pencil、システムが出す画面など）を足したり変えたりしたときは、アプリ内の「使い方」と、審査メモの「Other input methods」「画面のボタン以外の操作」の両方に書く。
4. 無効にしたまま同梱する機能や、審査のあとで機能を出し入れするリモートの切り替えを入れていないことを確かめる（2.5.19）。
5. 審査メモの英語・日本語を合わせた転記範囲が4000文字に収まることを、`ios/scripts/check-app-store-docs.sh` で確かめる。超えたら、前の版の変更点を消すか、既存の手順に含めて短くする。
6. App Store Connectの版のページの「このバージョンの新機能」の文を、[メタデータ](APP_STORE_METADATA.md#このバージョンの新機能)に書き、手順6でそこから転記する。
7. `ios/project.yml` の `MARKETING_VERSION` を提出する版の番号に上げ、XcodeGenで `ios/knittingEditor.xcodeproj` を作り直して、両方をコミットする。

- **完了の目安:** 審査メモの英語・日本語の両方に、前の版から増えた機能・変わった操作と確認手順が書かれ、`ios/scripts/check-app-store-docs.sh` が通る。
- **関係するIssue／項目:** [#352](https://github.com/K0mork/knittingEditor/issues/352)、[#38](https://github.com/K0mork/knittingEditor/issues/38)、提出チェックリストの[検証・配布](APP_STORE_CHECKLIST.md#検証配布)。
