# v1.0 加入・提出・公開の手順

個人でApple Developer Programへ加入し、v1.0をApp Storeへ提出・公開するまで、次の順に進める。全項目の管理は[提出チェックリスト](APP_STORE_CHECKLIST.md)、入力値の正本は[メタデータ](APP_STORE_METADATA.md)、実機の手順と証跡は[実機リリースゲート](REAL_DEVICE_RELEASE_CHECKLIST.md)を使う。

個人情報・Team ID・App Store ConnectのApp ID・登録画面の無加工画像を、公開リポジトリやGitHubへ載せない。非公開の入力値はメインチェックアウトのルートの `private/APP_STORE_CONNECT.md` を参照する。worktreeに別の `private/` は作らない。

## 1. 加入前の準備を確認する

[実装・資産](APP_STORE_CHECKLIST.md#実装資産)のチェック済み項目を短く確認する。アイコン、提出サイズのスクリーンショット、Privacy Manifest、同梱ヘルプ、公開ポリシーとサポートページ、メタデータ・審査メモの下書き、輸出コンプライアンス設定、ライセンス表記は準備済み。過去のCI・開発ビルドの実機確認も記録済みである。

- **完了の目安:** 準備済みの資産と文書の場所が分かり、署名・提出ビルドの実機確認・App Store Connectへの登録は加入後に残ると確認できた。
- **関係するIssue／項目:** [#27](https://github.com/K0mork/knittingEditor/issues/27)、提出チェックリストの「実装・資産」のチェック済み項目と[検証・配布](APP_STORE_CHECKLIST.md#検証配布)。

## 2. 個人で加入し、承認を待つ

1. [Appleの加入案内](https://developer.apple.com/help/account/membership/program-enrollment/)から、個人として申し込む。Apple Accountの2ファクタ認証を確認し、本人確認・支払いを進める。販売元の表示は[販売元と著作権表記](APP_STORE_METADATA.md#販売元と著作権表記)の決定に従う。
2. 契約・支払い前にも[本人確認](https://developer.apple.com/jp/help/account/membership/identity-verification/)が入る。氏名・電話番号・住所に加え、場合によって身分証等が求められる。「登録手続きを続けるには、Appleまでお問い合わせください」と表示された場合は、審査中の表示だけを見て待機せず、画面の問い合わせ先から追加対応を確認する。
   - 問い合わせは「メンバーシップとアカウント」→「プログラムの登録」へ進み、連絡方法を選ぶ。入力値、問い合わせ下書き、受付番号やAppleからの返信はメインチェックアウトの `private/ACCOUNTS.md` に記録する。加入記録は日本時間（JST）の日時を付けて古い順に並べ、実施・報告・確認の時刻を区別する。実施時刻が不明なら、推測せずその旨を書く。
   - 購入後も有効化まで処理がある。[公式案内](https://developer.apple.com/jp/help/account/membership/program-enrollment/)の「購入後24時間以内に確認が届かなければ問い合わせる」という目安は、支払い前の本人確認の所要時間ではない。追加確認が来たらAppleの案内に従う。
3. メンバーシップの有効化を確認し、App Store Connectへ入れるようになったら、#17の署名確認へ進む。支払いだけで#17を完了にしない。

- **完了の目安:** 加入が承認され、有料のDeveloper TeamをXcodeで選べる。
- **関係するIssue／項目:** [#17の決定](https://github.com/K0mork/knittingEditor/issues/17#issuecomment-5947707637)、提出チェックリスト「Apple Developer Team、Bundle ID、署名証明書、Provisioning Profile」。

加入の進み具合は[#17](https://github.com/K0mork/knittingEditor/issues/17)のコメントで追う。非公開の経緯、問い合わせ文、受付番号と時刻付きの履歴はメインチェックアウトの `private/ACCOUNTS.md` に記録する。

## 3. XcodeでAutomatic署名を設定する

1. XcodeのAccountsへ加入したApple Accountを追加する。プロジェクト未生成なら、リポジトリルートで `xcodegen generate --spec ios/project.yml` を実行して開く。
2. `knittingEditor`ターゲットのSigning & Capabilitiesで「Automatically manage signing」を維持し、加入したTeamを選ぶ。設定の基準は[project.yml](../project.yml)（`CODE_SIGN_STYLE: Automatic`）。
3. Bundle IDが `com.k0mork.knittingEditor` のままで、そのTeamのIdentifiersに登録され、証明書・Provisioning Profileが解決されることを確かめる。既存の登録との衝突があれば、別のBundle IDに変えず原因を確認する。
4. [実施前の固定情報・接続確認](REAL_DEVICE_RELEASE_CHECKLIST.md#実施前の固定情報)に従い、接続確認スクリプトとiPhone・iPadへの署名済みビルドの導入を行う。[M0](REAL_DEVICE_RELEASE_CHECKLIST.md#m0-オフライン起動とweb-api-poc)の起動・再起動後の保持・機内モードの残件を確認する。Team IDや署名情報はリポジトリへ保存しない。

CIは署名なしのまま変更しない。CIのXcode更新は[#289](https://github.com/K0mork/knittingEditor/issues/289)で別管理されており、加入・提出のために待つ必要はない。

- **完了の目安:** Automaticで署名が解決し、iPhone・iPadでローカル資産から起動して再起動後もデータが残る。M0の残件と証跡を確認できた。
- **関係するIssue／項目:** [#17](https://github.com/K0mork/knittingEditor/issues/17)、#289、提出チェックリストの署名項目、実機ゲートM0。

## 4. App Store Connectでアプリを登録する

App Store Connectの「マイApp」から新規Appを作り、プラットフォームはiOS、主言語は日本語、Bundle IDは手順3の登録を選ぶ。App名は[基本情報](APP_STORE_METADATA.md#基本情報)に従う。重複で使えない場合は、[App名とホーム画面の表示名](APP_STORE_METADATA.md#app名とホーム画面の表示名)のとおり文書を更新してから登録する（#18）。

SKUは製品管理用の一意な文字列を利用者が決め、登録値はルートの `private/APP_STORE_CONNECT.md` に記録する。App Store Connectが発行するApp IDやTeam IDと混同しない。

- **完了の目安:** 目的のBundle IDとApp名でアプリのレコードが作成され、v1.0の入力・ビルド登録へ進める。
- **関係するIssue／項目:** [#18の残件](https://github.com/K0mork/knittingEditor/issues/18#issuecomment-5947707284)、[#27](https://github.com/K0mork/knittingEditor/issues/27)、メタデータの基本情報・App名。

## 5. 提出用Release Archiveを作成し、検査・アップロードする

1. 提出するソースのコミットを固定する。[検証・配布](APP_STORE_CHECKLIST.md#検証配布)に従い、提出候補PRの `ci-gate` と、その候補を含むmainコミットの `Full iOS validation`（iPhone・iPad全テスト、両端末のapp_update、unsigned Release Archive・資産検査）の成功を確認する。失敗Issueがあれば調査・修正する。
2. **手元のXcode 27.1（iOS 27.1 SDK）以降**を使う。Xcode 26.6固定のCIアーカイブは提出に使わない。版の根拠と検査条件は提出チェックリストの「提出用のアーカイブ」、CIとの違いは[#289](https://github.com/K0mork/knittingEditor/issues/289)を参照する。
3. Xcodeでscheme `knittingEditor`、実機向けの汎用destination（Simulatorではない）を選び、Archiveの構成がReleaseであることを確認して、Product > Archiveを実行する。構成・destination・検査の参照元は[`release_archive`ジョブ](../../.github/workflows/ios-full.yml)とする。ただし、ローカルの提出用署名を有効にし、CIの `CODE_SIGNING_ALLOWED=NO`／`CODE_SIGNING_REQUIRED=NO` は付けない。
4. Organizerで対象ArchiveをFinderに表示し、リポジトリルートから次を実行する。パスは実際のArchiveへ置き換える。

   ```sh
   ios/scripts/check-release-assets.sh "/path/to/knittingEditor.xcarchive/Products/Applications/knittingEditor.app"
   /usr/libexec/PlistBuddy -c 'Print :DTSDKName' "/path/to/knittingEditor.xcarchive/Products/Applications/knittingEditor.app/Info.plist"
   /usr/libexec/PlistBuddy -c 'Print :DTXcodeBuild' "/path/to/knittingEditor.xcarchive/Products/Applications/knittingEditor.app/Info.plist"
   ```

   資産検査の成功に加え、`DTSDKName` が `iphoneos27.1` 以降、`DTXcodeBuild` がXcode 27.1以降のビルド番号であることを確認する（27.1正式版は `27A9275`）。Xcodeの選択表示だけで済ませない。
5. [バージョンとビルド番号](APP_STORE_METADATA.md#バージョンとビルド番号)に従い、OrganizerのDistribute AppからApp Store Connectへアップロードする。「Manage Version and Build Number」をオンにし、前回より大きいビルド番号を使う。`project.yml` の `MARKETING_VERSION` は `1.0`、`CURRENT_PROJECT_VERSION` は `1` のままとする。コマンドラインのArchiveでは同節のビルド番号指定に従う。
6. App Store Connectで処理完了を待ち、実際に登録されたバージョン・ビルド番号を記録する。内部テストからApp Reviewへ提出できるビルドとしてアップロードする（内部テスト専用の配布に限定しない）。

- **完了の目安:** SDK・Xcode・同梱資産の検査が通り、対象コミットに対応するv1.0のビルドがApp Store Connectで処理済みになった。
- **関係するIssue／項目:** [#25](https://github.com/K0mork/knittingEditor/issues/25)、#289、提出チェックリストの候補CI・提出用アーカイブ・ビルド番号、実機ゲート[M6](REAL_DEVICE_RELEASE_CHECKLIST.md#m6-testflightapp-store)。

## 6. TestFlight内部テストと提出ビルドの実機確認

1. 処理済みビルドを内部テストグループへ追加し、iPhone・iPadへTestFlightからインストールする（#25）。以降は**提出する同じビルド番号**で確認する。
2. [M0](REAL_DEVICE_RELEASE_CHECKLIST.md#m0-オフライン起動とweb-api-poc)・[M6](REAL_DEVICE_RELEASE_CHECKLIST.md#m6-testflightapp-store)に従い、機内モードでホーム画面から起動し、編集、自動保存、再起動後の復元、PNG／PDF、`.knit`保存・復元、ヘルプを確認する。開発ビルドのチェック済み実績で提出ビルドの確認を省略しない。
3. [M3: Files・共有・外部バックアップ](REAL_DEVICE_RELEASE_CHECKLIST.md#m3-files共有外部バックアップ)の往復・異常系を両端末で確認する。機内モードのローカル保存を先に行い、AirDrop等は必要な通信を戻して確認する。存在しないファイル等の未確認項目は、未確認のまま記録し、完了扱いにしない。
4. #26として、[M2の測定手順と判定](REAL_DEVICE_RELEASE_CHECKLIST.md#m2-保存復元大規模盤面)を参照して1000×1000盤面、PNG上限超過の拒否、PNG／PDF出力時間、クラッシュログ・メモリ警告を提出ビルドで確認する。開発ビルドを再インストールする測定スクリプトの結果を、TestFlightビルドの結果として扱わない。
5. [M4](REAL_DEVICE_RELEASE_CHECKLIST.md#m4-画面入力アクセシビリティ)・M6の最終画面（AppIcon、起動画面、iPhone縦横、iPad全画面・可変幅）を確認して証跡を残す。製品ページへ登録する画像は[最終版スクリーンショット](SCREENSHOTS.md#app-store-connect提出用最終版)を使い、実際の提出ビルドとの一致を確かめる。

- **完了の目安:** 両端末で提出ビルドの確認が完了し、ビルド番号・コミット・端末／OS・結果・未実施項目とM6の証跡がそろった。問題を直して再アップロードした場合は、手順5から戻り、新しいビルドで必要な確認をやり直す。
- **関係するIssue／項目:** [#25](https://github.com/K0mork/knittingEditor/issues/25)、[#26](https://github.com/K0mork/knittingEditor/issues/26)、提出チェックリストの機内モード・Files／AirDrop・大規模盤面・クラッシュ、実機ゲートM0・M2・M3・M4・M6と[記録ルール](REAL_DEVICE_RELEASE_CHECKLIST.md#記録ルール)。

## 7. App Store Connectの提出情報を入力する

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
| スクリーンショット | [スクリーンショットの説明文](APP_STORE_METADATA.md#スクリーンショットの説明文)から[最終版の画面・順・ファイル](SCREENSHOTS.md#app-store-connect提出用最終版)へ進み、iPhone・iPadそれぞれ登録する |
| 輸出コンプライアンス | [輸出コンプライアンス（暗号化）](APP_STORE_METADATA.md#輸出コンプライアンス暗号化)。アップロードしたビルドの設定と質問の有無を確認する |
| アクセシビリティの表示 | [アクセシビリティの表示](APP_STORE_METADATA.md#アクセシビリティの表示accessibility-nutrition-labels)。実機で確かめた範囲に従い回答する |

MacとApple Vision Proは[#86の決定コメント](https://github.com/K0mork/knittingEditor/issues/86#issuecomment-6010786273)に従い、**v1.0では既定のまま配信を止めない**。両環境の動作確認はv1.0の必須条件に追加しない。提出チェックリストの未チェック欄は、この決定への参照とともに扱いを記録する。

- **完了の目安:** #27の入力がそろい、[提出チェックリストの「検証・配布」](APP_STORE_CHECKLIST.md#検証配布)と実機ゲートM6の登録内容照合を終え、未解決の必須項目がない。
- **関係するIssue／項目:** [#27](https://github.com/K0mork/knittingEditor/issues/27)、[#86](https://github.com/K0mork/knittingEditor/issues/86)、提出チェックリストのApp Privacyから配信地域までの各登録項目、実機ゲートM6。

## 8. 審査に提出し、結果へ対応する

1. 手順6で確認したビルド番号をv1.0に選ぶ。[提出チェックリスト](APP_STORE_CHECKLIST.md)を再確認し、任意項目・将来対応を区別して、必須の未完了があれば先に解消する。
2. 手順9の公開方法を利用者が選び、提出前にApp Store Connectへ設定する。内容を保存して審査へ追加し、最終の提出操作まで進める。
3. 審査は通常1〜2日を目安にするが、追加確認等で長くなる場合もある（[Appleの審査案内](https://developer.apple.com/jp/help/app-review/after-submitting-for-review/request-expedited-review/)）。App Store Connectの状態とAppleからの連絡を確認する。
4. リジェクトされたら、指摘された条項と再現手順を読み、App Store Connectの審査連絡へ回答する。4.2やオフライン動作の説明には[審査メモの説明・確認手順](APP_REVIEW_NOTES.md)を使う。メタデータの不足なら正本も更新し、コード修正なら新しいビルド番号で手順5〜7をやり直して再提出する。

- **完了の目安:** 提出が受理され、最終的に承認を確認できた。審査待ち・審査中・リジェクトは承認として扱わない。
- **関係するIssue／項目:** [#27](https://github.com/K0mork/knittingEditor/issues/27)、提出チェックリストの全必須項目と「提出後の承認」、実機ゲートM6。

## 9. 承認後に公開し、確認と記録を残す

公開方法は利用者が選ぶ。設定は手順8の提出前に行い、承認後は選んだ方法に従う（[Appleの公開オプション](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)）。

- **手動公開:** 承認後、公開待ちの状態で内容を確認し、利用者が公開操作を行う。
- **自動公開:** 承認後に自動で公開する。日時を指定して、それより前には公開しない選択肢もある。

公開操作・自動公開の後、ストアへの反映を待つ。Appleの案内では表示まで最大24時間かかる場合がある。対象地域の製品ページで説明・画像・無料表示・リンクを確認し、App StoreからインストールしたiPhone・iPadで起動、保存・復元、PNG／PDF・`.knit`の主要フローを確認する。承認前に「App Store配布完了」と報告しない。承認後も、公開待ち・反映待ち・公開確認済みを区別して記録する。

[実機ゲートの記録ルール](REAL_DEVICE_RELEASE_CHECKLIST.md#記録ルール)と[開発ログの書式](../../docs/dev-log/README.md)に従い、実施日、コミット、提出・公開したビルド番号、端末／OS、結果、残件、配布影響、証跡の場所を残す。提出チェックリストとM6を実施結果に合わせて更新する。個人情報・テスターの識別情報・登録画面等の非公開証跡は公開せず、ルートの `private/` 内の保管場所だけを記す。

変更・確認の記録は該当PRの `docs/dev-log/` に含め、マージ後に行った確認はそのPRへのコメントで残す。結果の追記だけのPRは作らない。Issueの古い本文が凍結済みの [`DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md) を指していても、新しい記録は `docs/dev-log/` を使う。完了条件を満たしたIssueだけを、完了するPRの `Closes #番号` で閉じる。

- **完了の目安:** 承認とストア公開を確認し、公開版の主要フローとチェックリストの証跡・記録がそろった。未実施項目は明示されている。
- **関係するIssue／項目:** [#25](https://github.com/K0mork/knittingEditor/issues/25)・[#26](https://github.com/K0mork/knittingEditor/issues/26)・[#27](https://github.com/K0mork/knittingEditor/issues/27)、提出チェックリスト末尾の承認確認、実機ゲートM6・記録ルール。
