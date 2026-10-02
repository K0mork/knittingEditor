# Development Log

## 2026-10-02 — Pagesへの配信を`main`のrunに限り、並行セッションで他人のビルドやrunを確かめないようにする

- 影響: アプリとWeb資産の内容は変えていない。
  - 配信: `deploy`ジョブと、`web`ジョブのPages準備（`Configure Pages`・`Upload Pages artifact`）の条件を「PRでない」から`github.ref == 'refs/heads/main'`に変えた。`workflow_dispatch`は任意のブランチから実行でき、そのとき`changes`は`web=true`を返す。`github-pages`環境の配信許可には`main`のほかに`develop`があり、`develop`から手動実行すると本番へ配信されうる状態だった（今は`develop`ブランチは無い）。
  - E2E: `playwright.config.ts`の`reuseExistingServer`をローカルでも無効にした。これまでは固定のポート4173に別のworktreeのpreviewサーバーや古いビルドが残っていると、それを再利用して、変更を含まないビルドに対してテストが通りえた。ポートは設定ファイルの場所（worktree）から4173〜5172の範囲で決め、`PLAYWRIGHT_PORT`で上書きできる。ポートが使われていれば、テストを始めずに失敗する。
  - CI確認: `ios/AGENTS.md`の「CI確認」の手順は`gh run list --limit 1`で最新のrunを取っており、CodeQLや別のブランチ・別のセッションのrunを拾いえた。pushしたコミットのSHAと`ci.yml`で絞り、`gh run watch`で完了を待つ手順に変えた。
- 主なファイル: `.github/workflows/ci.yml`、`playwright.config.ts`、`ios/AGENTS.md`
- テスト: 設定と手順の変更のため、テストは追加していない。手元で次を確かめた。
  - このworktreeの計算上のポート（4262）を別のHTTPサーバーで使った状態では、`npx playwright test`が「is already used」で終了コード1になった。`PLAYWRIGHT_PORT=4999`では`seo.spec.ts`の9件が成功した。
  - 新しいCI確認の手順で、`main`の先端コミットから`ci.yml`のrunを1件だけ選べた。`--commit`は短縮SHAでは一致しないため、`git rev-parse HEAD`の40桁を使う。
- 検証: `npm run typecheck`、`npm test`（107件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（79件成功・2件skip）が成功した。ローカルにNode.js 24が無く、Node.js 26.8.1で実行した。`actionlint`は手元に無く、実行していない。`main`のrefでの配信の条件はPRのCIでは動かないため、マージ後の`main`のrunで確かめる。`ci.yml`の変更でPRのCIではWeb・iOSの全ジョブが走る。
- デプロイ影響: `.github/workflows/*`の変更で、マージ後に同じ内容のPagesが再配信される。マージ後は`deploy`と`smoke`が成功したことを確認する。`github-pages`環境の配信許可から`develop`を外すのはGitHubの設定変更で、このPRには含まれない。

## 2026-10-02 — iOSアプリのホーム画面の表示名を「棒針編み図」にし、App名と加入方針を記録する

- 影響: iOSアプリのホーム画面の表示名（`CFBundleDisplayName`）と`CFBundleName`を「Knitting Editor」から「棒針編み図」に変えた。App Store用のApp名は「棒針編み図エディタ」に決めた（Web版のタイトルと同じ）。App名はApp Store全体で重複できないため、使えるかはApp Store ConnectでAppを登録するときに確かめる。Apple Developer Programへは個人で加入する予定で、署名はAutomaticを続ける。Web版の表示とBundle IDは変えていない。
- 表示名の長さ: Appleの文書には`CFBundleDisplayName`の上限も推奨値も無い（`CFBundleName`は15文字まで）。Simulatorのホーム画面で実測すると、iPhone SE（第3世代、iOS 18.2）とiPhone 17（iOS 27.0）で、全角9文字の「棒針編み図エディタ」は標準の文字サイズで切れた。全角7文字は文字サイズを大きくすると切れ、全角6文字はどの文字サイズでも切れなかった。このため表示名は6文字以内とし、5文字の「棒針編み図」を選んだ。「拡大表示」と太字テキストは確かめておらず、実機確認（#23）で扱う。
- 主なファイル: `ios/App/Info.plist`、`ios/docs/APP_STORE_METADATA.md`（ホーム画面の表示名と根拠）、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/scripts/check-app-store-docs.sh`、`ios/scripts/check-release-assets.sh`
- テスト: `check-app-store-docs.sh`に、メタデータの「ホーム画面の表示名」が6文字以内で、`Info.plist`の`CFBundleDisplayName`・`CFBundleName`と一致する検査を加えた（CIの`app_store_docs`はLinuxで動くため、`plutil`ではなく`awk`で読む）。`check-release-assets.sh`はArchiveしたアプリの表示名が「棒針編み図」であることを確かめる。
- 修正（PRのCIで判明）: 最初の版はメタデータの表を`awk`で読んでいた。macOSの`awk`はUTF-8ロケールで文字列の比較に照合順序を使い、`en_US.UTF-8`（CIのmacOSランナー）では「項目」と「ホーム画面の表示名」を等しいと判定した。そのため`release_archive`の中の文書の検査が表の見出しの値「下書き」を読み、`Info.plist`と不一致として失敗した。既存の`App名`・`サブタイトル`などの読み取りも同じ処理で、macOSの`en_US.UTF-8`では見出し行を読んで文字数の検査が素通りしうる状態だった。表とplistの読み取りをロケールに依らない`perl`の完全一致に置き換えた。
- 検証: `ios/scripts/check-app-store-docs.sh`と`plutil -lint ios/App/Info.plist`が成功した。修正後の検査は、ロケール未指定・`C`・`C.UTF-8`・`en_US.UTF-8`・`ja_JP.UTF-8`のどれでも成功し、修正前は`en_US.UTF-8`だけで失敗することを手元で再現した。文書の検査を一時コピーで動かし、`C`・`en_US.UTF-8`・`ja_JP.UTF-8`のそれぞれで、サブタイトルを33文字にした場合と、`Info.plist`の表示名を変えた場合、表示名を7文字（「編み図エディタ」）にした場合、表示名の行を消した場合に、それぞれ終了コード1で失敗することを確かめた。`xcodegen generate --spec ios/project.yml`は成功した。Simulatorテスト、アプリ更新テスト、Debugビルドと`check-app-bundle.sh`、unsigned Release Archiveと`check-release-assets.sh`、iOS Webの検査は、利用者の判断でローカルでは実行せず、PRのCI（`ios`・`app_update`・`release_archive`・`ios_web`）で確かめる。手元のXcode 27はCIのXcodeと異なり、同じ検査をCIが同じ引数で実行するため。
- デプロイ影響: なし。iOSのみの変更で、Pagesは再配信されない。iOSアプリは次のビルドからホーム画面の表示名が変わる。
## 2026-10-02 — iOSのCIをmacos-26のXcode 26.6とiOS 26.5 Simulatorへ移す

- 影響: アプリとWeb資産の内容は変えていない。`.github/workflows/ci.yml`のiOS系ジョブ（`ios_web`、`ios`両端末、`app_update`両端末、`release_archive`）を`runs-on: macos-14`から`macos-26`へ移し、`DEVELOPER_DIR`で`/Applications/Xcode_26.6.app`を明示的に使う。これまでは`macos-14`の既定のXcode 15.4（iOS 17.5 SDK）でビルドし、`OS=latest`で選ばれたiOS 18.2のSimulatorでテストしており、テストに使うXcodeよりSimulatorのiOSが新しかった（#45）。`ios`・`app_update`・`release_archive`の最初に`xcodebuild -version`と`xcrun simctl list runtimes`を出し、`ios/scripts/boot-simulator.sh`は選んだ端末のiOSランタイムの版とUDIDを標準エラーへ出すので、使ったXcodeとSimulatorのランタイムがジョブログで分かる。
- 案C（macos-26とXcode 26.6）を選んだ理由: Appleの告知「Upcoming SDK minimum requirements」（2026-02-03掲載）によると、2026-04-28以降にApp Store Connectへアップロードするアプリは、iOS 26 SDK以降でビルドする必要がある。提出に使うSDKと同じ系列でCIのビルドとテストを行うためである。GitHubのrunner-images（`images/macos/macos-26-arm64-Readme.md`）では、Xcode 26.6がmacos-26の既定であり、iOS 26.5 SDKを持つ。同じイメージで最も新しいSimulatorのランタイムもiOS 26.5なので、XcodeとSimulatorの版が揃う。イメージの既定Xcodeが替わってもビルドとテストのXcodeが変わらないよう、`DEVELOPER_DIR`で固定した。
- 端末の変更: macos-26イメージにはiPhone 16とiPad (10th generation)のSimulatorが無い。そのため、CIの端末を、iOS 26.2・26.4・26.5のどのランタイムにもあるiPhone 17とiPad (A16)へ替えた。iPad (A16)はiPad (10th generation)の後継の無印iPadである。`ios/scripts/simulate-app-update.sh`の既定の端末と、`boot-simulator.sh`・`ios/DEVELOPMENT.md`の例をiPhone 17にした。`ios/README.md`のSimulator検証の記述と、`ios/AGENTS.md`でCI環境に触れた箇所も新しい環境に合わせた（検証規則は変えていない）。App Store用スクリーンショットの下書きと`APP_STORE_CHECKLIST.md`はiPhone 16／iPad (10th generation)で撮った記録なので、そのままにした。
- Swift: 手元のXcode 27.0では、`WebViewContainer.swift`の`WebViewModel.isEditorPage`（`nonisolated`）が`LocalWebSchemeHandler.scheme`を参照する箇所で「main actor-isolated static property 'scheme' can not be referenced from a nonisolated context」という警告が出た。`WKURLSchemeHandler`への準拠でクラスがMainActorに隔離されるためである。`scheme`は不変の文字列定数なので`nonisolated static let`にした。警告を抑えるだけの変更ではない。変更後はアプリとテストターゲットの`build-for-testing`で警告が出ていない（AppIntentsのメタデータ抽出の通知を除く）。
- 主なファイル: `.github/workflows/ci.yml`、`ios/scripts/boot-simulator.sh`、`ios/scripts/simulate-app-update.sh`、`ios/App/LocalWebSchemeHandler.swift`、`ios/README.md`、`ios/DEVELOPMENT.md`、`ios/AGENTS.md`
- テスト: ワークフローと端末の変更のため、テストは追加していない。手元で`boot-simulator.sh`を実行し、存在する端末では標準出力がUDIDだけで、標準エラーに「端末名: iOS 版 (UDID)」が出ることを確認した。存在しない端末名では、エラーを出して終了コード1になることも確認した。
- 検証: 手元はXcode 27.0で、Xcode 26.6もiOS 26.5のSimulatorも無い。`xcodegen generate --spec ios/project.yml`、Debugビルドと`ios/scripts/check-app-bundle.sh`、unsigned Release Archiveと`ios/scripts/check-release-assets.sh`、アプリとテストターゲットの`build-for-testing`、iOS Webの`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（8件）が成功した。Simulatorテストとアプリ更新テストは、手元のXcode 27とCIの移行先のXcode 26.6とで環境が違うため、利用者の判断で手元では最後まで実行せず、PRのCIで確かめる。参考までに書くと、途中で止める前に、iOS 27.0のSimulatorで新しく作ったiPhone 17では`ios/scripts/simulate-app-update.sh`が成功した。CIと同じ引数の`xcodebuild test`では、`testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`が失敗した。1回目は、起動から45秒経っても編集画面が「編み図を準備しています」のまま進まなかった。2回目は実行時間上限を超えた。ほかのテストは成功した。iPad (A16)の`xcodebuild test`は途中で止めた。Web側は`npm run typecheck`、`npm test`（107件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`）、`npm run test:e2e`（79件成功・2件skip）が成功した。ローカルにNode.js 24が無く、Node.js 26.8.1で実行した。`ruby -ryaml`で`ci.yml`を読み込めること、`ios/scripts/check-app-store-docs.sh`の成功も確認した。`actionlint`は手元に無く、実行していない。
- #44: CIの環境（ランナー、Xcode、Simulatorのランタイムと端末）が変わるため、#44の「10回連続観察」はこのPRのマージ後から数え直す。
- デプロイ影響: `.github/workflows/*`の変更でWeb・iOSの全ジョブが走り、同じ内容のPagesが再配信される。マージ後は`deploy`と`smoke`の成功を確認する。
## 2026-10-02 — iOSの検査一式はPRのCIで行い、ローカルでは変更に関係する検査だけにする

- 影響: アプリとWeb資産の内容は変えていない。これまで`packages/`やiOSのコード・ビルド設定・テストを変えたときは、CIと同じiOSの検査一式（Simulatorテスト2端末、アプリ更新テスト2端末、unsigned Release Archive、同梱物検査など）をローカルでも実行していた。手元のXcodeはCIと異なることが多く（現在は手元がXcode 27、CIはXcode 15.4、移行先はXcode 26.6）、ローカルで通ってもCIで通る証拠にならない。一式は1回30〜40分かかり、同じ内容をPRのCIが同じ引数で実行して`ci-gate`がマージ前に必須とするため、ローカルで既定として繰り返すのをやめた。ローカルでは、iOS Webの型検査とテスト、`xcodegen generate`とアプリのビルド、変えたスクリプトや文書の静的検査、変更箇所を対象にしたテストの繰り返しなど、push前に問題を見つけるための検査だけを行う。Simulatorの一式をローカルで回すのは、繰り返し実行や診断情報が必要な失敗の調査と、CIでは確かめられない変更に限る。開発ログには、ローカルで行った検査とCIに任せた検査を分けて書き、CIのiOS系ジョブをすべて確認してから完了と報告する。Webの検査一式（`npm run typecheck`など）は短時間で終わるため、これまでどおりローカルでも実行する。
- 主なファイル: `AGENTS.md`（Change-specific Test Requirements）、`ios/AGENTS.md`（Simulator運用と容量管理）
- テスト: 動作の変更がないため、テストは追加していない。
- 検証: `ios/scripts/check-app-store-docs.sh`が成功した。Markdownだけの変更のため、PRのCIでは`app_store_docs`だけが走り、Web・Simulator・Archiveのジョブはskipされる。
- デプロイ影響: なし。

## 2026-10-02 — iOS UIテストで主要ボタンの出現を起動用の上限で待ち、効かなかった「編み図」のタップだけ押し直す

- 症状（[#44](https://github.com/K0mork/knittingEditor/issues/44)）: run [36852519498](https://github.com/K0mork/knittingEditor/actions/runs/36852519498)の`ios (iPhone 16)`で、`testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`が1回目に失敗した。WebViewの器は出ていたが、`assertPrimaryControlsAreUsable`が「編み図」ボタンを10秒しか待たずに見つからなかった。run [36854593545](https://github.com/K0mork/knittingEditor/actions/runs/36854593545)の`ios (iPad (10th generation))`では、`testTwoFingerGestureDoesNotDrawOnBoard`の`createDocument`で起動直後の「編み図」のタップが効かず、「新しい編み図」が45秒現れなかった。どちらも再試行で成功し、実行時間上限の超過は無かった。
- 変更: `assertPrimaryControlsAreUsable`は「編み図」「盤面」「ブロック」「保存」の出現を`editorAppearanceTimeout`（45秒）で待つ（出れば直ちに終わる）。このヘルパーを使う全テストに効く。`createDocument`は「編み図」をタップしたあと「新しい編み図」を10秒待ち、出ず、かつパネルの「閉じる」も無い（パネルが開いていない）場合に限って「編み図」を押し直す。パネルが開いているのに出ない場合は押し直さない（押すとパネルが閉じるため）。最後は「新しい編み図」を45秒待ち、出なければ「「編み図」でパネルが開かない」として失敗させるので、ボタンが効かない不具合は隠さない。検証内容と1テストの実行時間上限は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 上記のUIテストのヘルパーを更新した。
- 検証: Xcode 27.0、`xcodegen generate --spec ios/project.yml`のあと、iOS 18.2のSimulator（iPhone 16・iPad (10th generation)）で、CIと同じ引数の`xcodebuild test`（`-retry-tests-on-failure -test-iterations 2 -test-timeouts-enabled YES -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240 -skip-testing:knittingEditorUITests/KnittingEditorUITests/testBackupExportSheetDismissesBackToEditor CODE_SIGNING_ALLOWED=NO`）が両端末で成功し、UIテスト13件（5件は条件付きskip）はすべて再試行なしで成功した。変更したヘルパーを使う`testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`、`testPrimaryControlsRemainUsableInPortraitAndLandscape`、`testTwoFingerGestureDoesNotDrawOnBoard`、`testUndoAndRedoRestoreBoardEdits`を再試行なし・`-test-iterations 5`で実行し、両端末で20回すべて成功した（`testManualWindowKeepsPrimaryFlowsUsable`は条件付きskip）。手元では起動直後のタップが効かない状況は再現せず、押し直しの分岐は通っていない。`ios/scripts/simulate-app-update.sh`（両端末、`SIMULATOR_UDID`指定）、unsigned Release Archiveと`ios/scripts/check-release-assets.sh`、Debugビルドと`ios/scripts/check-app-bundle.sh`、iOS Webの`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（8件）が成功した。Web側は変えていないため、Webの一式は実行していない。CIの不安定さは確率的なため、ローカルの成功だけでは再発しないことを証明できない。#44の完了条件（CIの10回連続）は引き続き観察する。
- デプロイ影響: なし。iOSのUIテストだけの変更で、Pagesは再配信されない。

## 2026-10-02 — `main`へ続けてマージしてもWebの変更が配信されるようにする

- 影響: アプリとWeb資産の内容は変えていない。`CI and deploy Pages`は同じrefのrunを常に打ち切っていたため、Webの変更をマージした直後にMarkdownやiOSだけの変更をマージすると、先のrunが`deploy`の前に止まり、後のrunは直前のコミットとの差分だけを見て`web=false`となり、どちらのrunも配信しなかった（#46）。`concurrency`の`cancel-in-progress`をPRのときだけ有効にし、`main`へのpushは打ち切らずに順番に実行する。GitHub Actionsでは待機中のrunが次のrunに置き換えられることがあるため、`changes`ジョブは`main`へのpushに限り、Webの判定を`github-pages`環境で最後に配信できたコミットからの差分で行う。そのコミットを取得できない場合や`HEAD`の祖先でない場合は、配信を取りこぼさないよう`web=true`とする。iOSの判定とPRでの判定は、これまでどおり直前のコミットとの差分で行う。`changes`ジョブには配信履歴を読むため`deployments: read`を与えた。
- 主なファイル: `.github/workflows/ci.yml`
- テスト: ワークフロー定義の変更のため、アプリのテストは追加していない。`changes`の判定スクリプトを`ci.yml`から取り出し、実際のリポジトリと配信履歴を相手に手元で実行した。一時的なworktreeで最後の配信（`6a6f18a`）の上にWebの変更A・Markdownの変更Bを積むと、Bのrun（`before`=A）は`web=true ios=false`になった（変更前の判定は`web=false`）。続けてiOSの変更Cを積むと`web=true ios=true`。配信履歴を取得できないリポジトリ名では`web=true`。配信済みのコミット自体のrunを再実行する想定では`web=false`。`main`以外へのpushは従来どおり直前のコミットとの差分になった。
- 検証: `ruby -ryaml`で`ci.yml`を読み込めることを確認した。`npm run typecheck`、`npm test`（107件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`）、`npm run test:e2e`（79件成功・2件skip）が成功した。ローカルにNode.js 24が無く、Node.js 26.8.1で実行した。`actionlint`と`shellcheck`は手元に無く、実行していない。`main`への順番実行と配信履歴の読み取りは`main`へのpushでしか動かないため、PRのCIでは確かめられない。
- デプロイ影響: `.github/workflows/*`の変更でWeb・iOSの全ジョブが走り、同じ内容のPagesが再配信される。マージ後は`changes`のログに`last Pages deployment:`が出て`deploy`と`smoke`が成功したこと、`https://knittingeditor.com/`が応答することを確認する。

## 2026-10-01 — 配信後に本番サイトを自動で確認する`smoke`ジョブを追加

- 影響: アプリとWeb資産の内容は変えていない。これまで手で`curl`していた配信後の確認を、`CI and deploy Pages`の`deploy`の後に走る`smoke`ジョブへ移した。`smoke`は配信したPages成果物を取り出し、`https://knittingeditor.com/`の`/`と`/guide/`がそのHTMLと一致するまで最大10回（30秒間隔）待つ。CDNのキャッシュを避けるため毎回異なるクエリを付ける。一致したら、`/`が参照する`/assets/`の全ファイル、アイコン3種、OGP画像、`robots.txt`、`sitemap.xml`が期待するcontent-typeで200を返すこと、`/CNAME`が`knittingeditor.com`であること、`http://`が`https://knittingeditor.com/`へ転送されることを確認する。どれかが失敗するとワークフローが失敗する。
- 主なファイル: `scripts/check-live-site.mjs`（新規）、`.github/workflows/ci.yml`（`smoke`ジョブ）、`package.json`（`check:live`）、`AGENTS.md`（Deployment Procedureの手順5・6）、`README.md`（配布）
- テスト: スクリプトを本番に対して手元で実行した。引数なしと、今の`main`から作った`dist`を`--dist`で渡した場合はどちらも成功した。`guide/index.html`だけを書き換えた`dist`では、2回とも不一致を報告して終了コード1になった。`--origin http://…`はHTTPSでないため即座にエラーになった。`smoke`ジョブ自体は`main`へのpushでしか動かないため、PRのCIでは実行されない。
- 検証: `npm run typecheck`、`npm test`（107件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`）、`npm run test:e2e`（79件成功・2件skip）が成功した。ローカルにNode.js 24が無く、Node.js 26.8.1で実行した。`ruby -ryaml`で`ci.yml`を読み込めることを確認した。`actionlint`は手元に無く、実行していない。
- デプロイ影響: `.github/workflows/*`の変更でWeb・iOSの全ジョブが走り、同じ内容のPagesが再配信される。マージ時のrunが`smoke`の初回実行になるので、`smoke`が成功したことを確認する。

## 2026-10-01 — マージ後の結果を記録するためだけのPRをやめ、DependabotのPRへの記録を不要にする

- 影響: アプリの動作は変えていない。PR #43で決めた「マージ後にしか得られない結果は続きのPRで記録する」規則は、マージのたびに記録用のPRが増え、GitHub Actionsと`github-pages`環境が既に持つ実行結果を手で写すだけになっていたため廃止した。開発ログには変えた内容とマージ前の検証だけを書き、人が行ったマージ後の確認はマージしたPRへのコメントで残す。依存の更新だけのDependabotのPRは記録不要とし（`dependencies`ラベルでリリースノートに載る）、Dependabotのrebaseが止まるためそのブランチへコミットを足さない。
- 主なファイル: `AGENTS.md`（Development Log、Deployment Procedureの手順4・6、GitHub WorkflowのDependabot）、`ios/AGENTS.md`、`ios/DEVELOPMENT.md`（§12）、`.github/dependabot.yml`（コメントのみ）
- テスト: 動作の変更がないため、テストは追加していない。
- 検証: `ruby -ryaml`で`.github/dependabot.yml`を読み込めること、`ios/scripts/check-app-store-docs.sh`の成功を確認した。ビルド入力は変えていないため、Web一式のチェックはPRのCIで確認する。
- デプロイ影響: `dist/`の内容は変わらない。`.github/dependabot.yml`の変更でWebのCIと`deploy`が走るが、配信物は同じ。

## 2026-10-01 — 開発ログをマージ前に揃える規則と、PRのマージを利用者が行う規則を文書化

- 影響: アプリの動作は変えていない。DependabotのPR #40を開発ログの記録なしでマージしたことを受け、記録はその変更のPRに含めてマージ前に揃っていることを確認する、という規則を明文化した。自分で書いていないPR（DependabotなどのbotのPR）も対象とし、DependabotのPRはマージ前にそのブランチへ記録のコミットをpushする。デプロイ後の本番確認のようにマージ後にしか得られない結果は、`main`がPR経由でしか変更できないため、確認後すぐに続きのPRで記録する。あわせて、PRのレビューとマージは利用者が行い、エージェントは利用者がそのPRのマージを明示的に指示した場合に限りマージする、という規則も明記した。
- 主なファイル: `AGENTS.md`（Development Log、Deployment Procedureの手順4・6、GitHub WorkflowのDependabot）、`ios/AGENTS.md`（Development Log）、`ios/DEVELOPMENT.md`（§12 GitHub運用）、`README.md`（配布）、`.github/dependabot.yml`（コメントのみ）
- テスト: 動作の変更がないため、テストは追加していない。
- 検証: `ruby -ryaml`で`.github/dependabot.yml`を読み込めることを確認し、`ios/scripts/check-app-store-docs.sh`が成功した。Web一式のチェックはビルド入力を変えていないためローカルでは実行せず、PRのCIで確認する。
- デプロイ影響: `.github/dependabot.yml`の変更はCIの変更範囲判定でWebのみ（`web=true`・`ios=false`）になるため、マージ時のrunがPR #41で直した`deploy`の条件の初めての確認になる。マージ後に、iOS系ジョブがskipされたまま`deploy`が実行され成功したことを確認し、続きのPRで記録する。`dist/`の内容は変わらない。

## 2026-10-01 — iOS UIテストの自動保存待ちを直し、CIのSimulatorを先に起動する

- 症状: iOSコードを変えていないPR #40（run [36835157063](https://github.com/K0mork/knittingEditor/actions/runs/36835157063)）と#41（run [36837580472](https://github.com/K0mork/knittingEditor/actions/runs/36837580472)）の`ios (iPhone 16)`が1回目に失敗し、失敗ジョブの再実行では成功した。どちらも最初に`testDocumentSwitchAutosavesEachDocument`が1テストの実行時間上限（150秒→3分に切り上げ）を超え、テストランナーが再起動された。タイムアウトは`-retry-tests-on-failure`の再試行対象にならない。#41では続く`testEditAndRelaunchRestoresLocalDocument`も、再起動後の盤面（`記号1個`）を10秒待って1回目に失敗した。#40の`app_update (iPad)`は`testSeedDocumentForAppUpdateProbe`が起動に34秒かかり、要素検索1回に最大30秒かかって上限を超えた。
- 原因の切り分け（テスト側）: (1) `waitForDocumentSave`は見出しの「（保存中…）」が消えるのを待っていたが、この表示は`aria-hidden`でXCUITestから常に見えず、待機は即座に成立していた。自動保存は編集の400ms後に始まるため、遅いランナーでは保存前に`terminate()`して、再起動後に編集前の盤面が出うる。ローカルの調査用テストで、読み上げ用の「保存中」「保存済み」が独立した静的テキストとして公開されることを確認した。(2) `replaceText`は全選択済みの入力欄へ上書きする前提だったが、入力欄をタップした時点で選択が外れるため、成功した実行でも毎回「末尾タップ→削除→再入力」へ落ち、1回の名前入力が4操作になっていた。遅い区間では1操作が数秒〜数十秒かかるため、名前を2回入れる`testDocumentSwitchAutosavesEachDocument`が最も上限に近かった。(3) 再起動後・編み図の作成後・切り替え後の盤面を10秒しか待たず、起動用の45秒（端末内データの読み出しは最大10秒）と揃っていなかった。
- 原因の切り分け（環境側）: CIの`xcodebuild test`はビルドが終わってからSimulatorを初回起動し（ログで約2.5分の空白）、終わった直後にテストを始めていた。失敗した実行では、UIテスト開始の2〜3分後から要素検索が極端に遅くなり、テストランナーの再起動を待たずに回復していた。アプリの状態ではなく、起動直後のSimulatorの初期化処理と重なったものと判断した。CIはXcode 15.4でiOS 18.2 Simulatorを動かしていることも確認したが、今回は変えていない。
- 変更: `waitForDocumentSave`は、記号数が変わったのを確かめたあとに読み上げ用の「保存済み」が現れ「保存中」が消えるまで待つ（記号数と「保存中」は同じ描画で出るので、その後の「保存済み」は書き込み完了を意味する）。`replaceText`は入力欄の末尾側を1回だけタップし、削除と入力を1回の`typeText`にまとめ、一致しなかったときだけ同じ手順で入れ直す。最後の値の一致検査は残した。端末内データの読み出しを伴う盤面の待機を`editorAppearanceTimeout`（アプリ更新では`appUpdateElementTimeout`）へ揃え、失敗時に`app.debugDescription`を残す。レビューを受けて、盤面をタップしたあと記号数の変化を待つ箇所（`testEditAndRelaunchRestoresLocalDocument`、`testDocumentSwitchAutosavesEachDocument`の2か所、`testSeedDocumentForAppUpdateProbe`、`testTwoFingerGestureDoesNotDrawOnBoard`、`waitForStitchCount`）も同じ上限へ揃えた。遅い区間で操作1回に数十秒かかると、次に落ちるのはここになるため。検証内容（記号数・名前・再起動後の復元）は弱めていない。CIは`ios/scripts/boot-simulator.sh`でジョブの最初に最新iOSランタイムの対象Simulatorを起動し、`ios`ジョブはビルド前に`simctl bootstatus -b`で完了を待ってから`id=`指定でテストする。`app_update`ジョブも同じUDIDを`SIMULATOR_UDID`で渡し、`simulate-app-update.sh`はビルド前に起動完了を待つ（停止中の端末で`simctl uninstall`が黙って失敗する点も防ぐ）。スクリプトの端末選択は、同名端末のうち最も古いランタイムを選んでいたのを、`OS=latest`と同じ最新ランタイムに揃えた。1テストの実行時間上限は変えていない。
- レビュー対応の検証で見つかった問題: iOS 18.2のiPad (10th generation)を新しく作ると、ハードウェアキーボード接続の扱いでソフトウェアキーボードが出ず、入力補助バーが遅れて現れてWebViewが縮む（高さ1180→819）。(1) 中央に置いたダイアログが上へ動き、「決定」の合成タップが元の座標に当たって外れた（入力欄は正しい名前のまま、ダイアログが開きっぱなし）。`confirmDialog`を追加し、「決定」のあとダイアログが閉じたことを確かめ、閉じていなければボタンの位置が変わっていた場合に限って押し直す。位置が変わらずに閉じなければ失敗にするので、「決定」が効かない不具合は隠さない。(2) 入力欄の値の反映が遅れ、入力直後に読んだ古い値で不一致と判断して入れ直し、古い長さで削除したため正しい名前の末尾だけが消えて`M2切M2切替A`になった。`replaceText`は値が期待どおりになるまで最大10秒待ってから判断し、入れ直すときは古い値に頼らないよう多めに削除する。どちらも今回の`replaceText`で入力から「決定」までの操作が減ったことで表に出たもので、変更前の手順でも起こりうる。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/scripts/boot-simulator.sh`（新規）、`ios/scripts/simulate-app-update.sh`、`.github/workflows/ci.yml`
- テスト: 上記のUIテストのヘルパーと待機を更新した。`boot-simulator.sh`は、同名の端末をiOS 18.2と27.0に作って27.0側を選ぶこと、存在しない名前で終了コード1になることを確認した。
- 検証: Xcode 27.0、iOS 18.2の新規Simulator（iPhone 16・iPad (10th generation)）で、CIと同じ引数の`xcodebuild test`（`-retry-tests-on-failure -test-iterations 2 -test-timeouts-enabled YES -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240`、`testBackupExportSheetDismissesBackToEditor`をskip）が両端末で成功し、UIテスト13件はすべて1回目で成功した（5件は条件付きskip）。名前入力は1タップと1回の`typeText`で済み、保存待ちは「保存済み」を確認してから`terminate()`することをログで確認した。`ios/scripts/simulate-app-update.sh`はiPhone（`SIMULATOR_UDID`なし、`boot-simulator.sh`経由）とiPad（`SIMULATOR_UDID`指定）で成功。Debugビルドと`ios/scripts/check-app-bundle.sh`、unsigned Release Archiveと`ios/scripts/check-release-assets.sh`、`ios/scripts/check-app-store-docs.sh`、iOS Webの`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（8件）が成功。ワークフローの変更でWebジョブも走るため、`npm run typecheck`、`npm test`（107件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`）、`npm run test:e2e`（79件成功・2件skip）も実行し成功した。ローカルにNode.js 24が無く、Node.js 26.8.1で実行した。CIの不安定さは確率的なため、ローカルの成功だけでは再発しないことを証明できない。
- レビュー対応後の検証: 同じiPad（ハードウェアキーボード扱い、全25回の入力でソフトウェアキーボードは出ず）で、ダイアログを使う4テスト（`testDocumentSwitchAutosavesEachDocument`、`testEditAndRelaunchRestoresLocalDocument`、`testTwoFingerGestureDoesNotDrawOnBoard`、`testUndoAndRedoRestoreBoardEdits`）を再試行なし・`-test-iterations 5`で実行した。修正前は20回中1回（`M2切M2切替A`）、その前の全体実行では「決定」の外れで1回失敗した。修正後は20回すべて成功し、名前の入力と「決定」のタップは25回とも1回で済んだ。続けてCIと同じ引数の全テストをiPad・iPhone 16で実行し、どちらもUIテスト13件が再試行なしで成功、`simulate-app-update.sh`（iPhone、`SIMULATOR_UDID`指定）も成功した。
- CI: PR [#42](https://github.com/K0mork/knittingEditor/pull/42)の run [`36842389157`](https://github.com/K0mork/knittingEditor/actions/runs/36842389157)（attempt 1）で全ジョブと`ci-gate`が成功した。`ios`（iPhone 16・iPad (10th generation)）と`app_update`（両端末）のログには、テストの再試行（`Iteration 2 of 2`）、実行時間上限の超過、テストランナーの再起動がいずれも無かった。iPhone 16で`testDocumentSwitchAutosavesEachDocument`は44.4秒、`testEditAndRelaunchRestoresLocalDocument`は42.1秒（上限3分）。事前起動したiPhone 16は修正前の`OS=latest`と同じ個体（`EDC4F281-…`）だった。成功は1回なので、続けて1回目で成功するかを[#44](https://github.com/K0mork/knittingEditor/issues/44)で観察する。Xcode 15.4とiOS 18.2 Simulatorの組み合わせの見直しは[#45](https://github.com/K0mork/knittingEditor/issues/45)へ分けた。
- CI追補: `71f12c5`の run [`36844836840`](https://github.com/K0mork/knittingEditor/actions/runs/36844836840)（attempt 1）でも全ジョブが成功し、iOS系4ジョブのログに再試行・実行時間上限の超過・失敗は無かった。`4ca92e5`の run [`36852519498`](https://github.com/K0mork/knittingEditor/actions/runs/36852519498)（attempt 1）も全ジョブと`ci-gate`が成功し、`ios (iPad (10th generation))`と`app_update`（両端末）に再試行・実行時間上限の超過・失敗は無かった。ただし`ios (iPhone 16)`では、このPRで変えていない`testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`が1回目に失敗し、再試行（`Iteration 2 of 2`）で成功した。起動後にWebViewの器は出ていたが、`assertPrimaryControlsAreUsable`が「編み図」ボタンを10秒しか待たずに見つからなかった（同じ時間帯にWebコンテンツのプロセスで`kAXErrorServerNotFound`も出ていた）。このPRで直した盤面の待機と同じ型の待機不足で、実行時間上限の超過やテストランナーの再起動は無い。[#44](https://github.com/K0mork/knittingEditor/issues/44)へ記録し、そちらで扱う。
- デプロイ影響: アプリとWeb資産の内容は変わらない。`.github/workflows/*`の変更は`changes`ジョブで`web=true`と`ios=true`の両方を立て、Web・iOSの全ジョブを起動するため、`main`へのマージ後に同じ内容のPagesが再配信される。マージ後は`CI and deploy Pages`の成功を確認する。

## 2026-10-01 — PR #13・#16・#36・#39・#40・#41のマージと公開確認

- 影響: 6件をレビューしてmainへマージした。マージコミットは#16 `a6d405e`、#13 `5eddc84`、#36 `2259c02`、#39 `d2091d8`、#40 `c13a810`、#41 `b8dea09`。#36は`ios/TODO.md`を削除する一方で#13が同ファイルへPro実装の項目を追加していたため、項目をIssue #38へ移し、`ios/docs/PRO_PLAN.md`の`TODO.md`への参照をIssue #38とマイルストーン`iOS 1.0`に置き換えて競合を解消した。#39は開発ログの競合だけを解消した。
- 判明した問題: #39のマージ時のrun（36837111581）で`deploy`がskipされ、本番に反映されていなかった。#12のrun（36829850669）も同じだった。原因はPR #41の記録のとおりで、#41で修正した。また、#36の記録は「マージ後にPagesが再配信される」としていたが、実際にはrun 36835035558で`deploy`はskipされていた（`dist/`は不変のため実害なし）。#40は開発ログの記録なしでマージした（次の項目で補記）。
- CI: #16のrun（36834534404）と#40のrun（36838404934）は、直後のマージのrunに置き換えられてcancelledになった（同一ブランチのrunを打ち切る設定）。#13（36834598299）、#36（36835035558）、#39（36837111581）、#41（36840347755）は成功し、#41のrunはWeb・iOSの全ジョブと`deploy`が成功した。#40・#41のPRでは`ios (iPhone 16)`などのUIテストがタイムアウトで失敗し、失敗したジョブの再実行で成功した。このUIテストの不安定さはPR #42で対応している。
- 公開確認: run 36840347755の配信後、`curl`で`https://knittingeditor.com/`の`/`、`/guide/`、`/favicon.ico`（`image/vnd.microsoft.icon`）、`/icon-192.png`・`/apple-touch-icon.png`（`image/png`）、`/og-image.png`、`/CNAME`（`knittingeditor.com`）がHTTPS 200で返り、`/`と`/guide/`の両方が新しいアイコン3種を参照していることを確認した。ブラウザのタブでのアイコン表示の目視は行っていない。Dependabotは設定を読み込み、PR #40の作成とnpm・GitHub Actionsの更新runが成功した。
- デプロイ影響: この記録自体はなし。

## 2026-10-01 — Web専用の変更でもPagesへ配信されるようにする

- 影響: `main`へのpushでWebだけが変わり、iOS系ジョブ（`ios_web`・`ios`・`app_update`・`release_archive`）がskipされると、`deploy`も実行されずPagesへ配信されていなかった。`deploy`はこれらのジョブを`ci-gate`経由で間接的に待っており、`if`に状態関数が無いと暗黙の`success()`が付くため、skipされた依存元があると`deploy`もskipされる。PR #12（OGP画像）とPR #39（アイコン）のマージ時のrunで`deploy`がskipされていたことを確認した（#12は後続の#14の配信で反映された）。`deploy`の`if`に`!cancelled()`を加え、`needs.web.result == 'success'`も条件にした。`ci-gate`の成功を必須とする条件と、PRでは配信しない条件は変えていない。
- 主なファイル: `.github/workflows/ci.yml`
- テスト: ワークフロー定義の変更のため、アプリのテストは追加していない。
- 検証: `ruby -ryaml`で`.github/workflows/ci.yml`を読み込めることを確認した。`.github/workflows/`の変更はWeb・iOSの全ジョブを起動するので、このPRのCIで全ジョブを検証する（PRでは`deploy`は実行されない）。
- デプロイ影響: マージ時のrunは全ジョブを実行して配信する。マージ後、次のWeb専用の変更で`deploy`が実行され、本番に反映されることを確認する。

## 2026-10-01 — テスト用のjsdomを30.1.1へ更新（Dependabot PR #40）

- 影響: Vitestのテスト環境で使う開発依存`jsdom`を30.1.0から30.1.1へ更新した。推移的に`@asamuzakjp/dom-selector` 9.1.4→9.2.1、`html-encoding-sniffer` 6.0.0→7.0.0、`lru-cache` 11.5.2→11.5.3、`w3c-xmlserializer` 5.0.0→6.0.0も更新された（取得元はすべてnpm公式レジストリ）。30.1.1の主な変更はフォーカス・blurの挙動、CSSの`!important`、文字コード判定の修正。配信するWeb版とiOSアプリには含まれない。
- 主なファイル: `package.json`、`package-lock.json`
- テスト: 依存の更新のため、テストは追加していない。
- 検証: ローカルでは実行していない。PRのrun 36835157063で`web`、`ios_web`、`release_archive`、`ios (iPad (10th generation))`、`app_update (iPhone 16)`は初回で成功した。`ios (iPhone 16)`（`testEditAndRelaunchRestoresLocalDocument`がタイムアウトして再起動）と`app_update (iPad (10th generation))`（`testSeedDocumentForAppUpdateProbe`がタイムアウト）が失敗し、失敗したジョブの再実行で成功して`ci-gate`が通った。jsdomはアプリに同梱されないため、更新とは無関係のSimulatorの不安定さと判断した（PR #42で対応中）。
- デプロイ影響: マージ時のrun 36838404934は直後のPR #41のマージで打ち切られ、run 36840347755で配信された。この記録はマージ前に追加すべきだったが漏れたため、マージ後に追加した。

## 2026-10-01 — Web版のアイコンをiOS版のアプリアイコンに揃える

- 影響: Web版のfavicon（緑の角丸に方眼と×のSVG）がiOS版のアプリアイコン（深緑の地に交差した棒針、白い編み目、橙の毛糸）と違っていたため、Web版をアプリアイコンに揃えた。ブラウザのタブ・ブックマーク用に`favicon.ico`（16・32・48px）と`icon-192.png`、iPhone・iPadのホーム画面に追加したとき用に`apple-touch-icon.png`（180px）を置き、トップと`/guide/`の両ページで参照する。`favicon.svg`は削除した。iOS版のアプリアイコンとアプリ内ページは変えていない。
- 画像の生成: `scripts/generate-web-icons.mjs`が`ios/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`を`sips`で縮小し、ICOはPNGを格納する形式で組み立てる。macOS専用のためCIでは生成せず、出力をコミットする。同じ入力から2回生成し、SHA-1が一致することを確認した。アプリアイコンを差し替えたときは`node scripts/generate-web-icons.mjs`を再実行する。16pxでは細部が潰れるが、図柄は判別できることを拡大して目視確認した。
- 主なファイル: `public/favicon.ico`、`public/icon-192.png`、`public/apple-touch-icon.png`、`scripts/generate-web-icons.mjs`、`index.html`、`public/guide/index.html`、`scripts/check-dist.mjs`、`tests/e2e/seo.spec.ts`
- テスト: `seo.spec.ts`で両ページのアイコンリンク（`favicon.ico`、`icon-192.png`、`apple-touch-icon.png`）と、各ファイルがICO（3画像）・192×192／180×180のPNGで返ることを検査する。`check-dist`は3ファイルの存在・形式・寸法と、配信HTML 2ページのアイコンリンクを検査する。
- 検証: Node.js 24.21.0で`npm run typecheck`、`npm test`（18ファイル・107件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`、`dist/`に3ファイルがあり`favicon.svg`が無いことを確認）、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、79件成功・iPhone専用テストの2件skip）が成功。`packages/`とiOSのソースは変えていないため、iOSのSimulator・Archive検証は実行していない。
- デプロイ影響: `main`へのマージ後にPagesへ配信される。配信後に`https://knittingeditor.com/favicon.ico`・`/icon-192.png`・`/apple-touch-icon.png`がHTTPS 200で返り、ブラウザのタブに新しいアイコンが出ることを確認する。ブラウザと検索結果はfaviconを長くキャッシュするため、古いアイコンがしばらく残りうる。

## 2026-10-01 — GitHubの依存更新・コードスキャン・ブランチ保護を有効化し、作業管理をIssueへ移行

- 影響: アプリの動作は変えていない。GitHub側で、Dependabotアラートとセキュリティ更新、CodeQLのdefault setup（Actions・JavaScript/TypeScript）を有効にし、説明・ホームページ（`https://knittingeditor.com`）・Topicsの設定、マージ後のブランチ自動削除、未使用Wikiの無効化を行った。未完了の作業をIssueだけで管理するため、`ios/TODO.md`の未完了19項目をIssue #17〜#35へ、PR #13で追加したPro実装の項目をIssue #38へ移し、各Issueの本文に現状とマイルストーンの完了条件を書いた。Issueにはラベル`priority:P0`／`P1`／`P2`・`platform:ios`・`needs-device`とマイルストーン`iOS 1.0`（P0のみ）を付け、Projects「knittingEditor ロードマップ」（Kanban、公開範囲は非公開）へ入れた。Projectsでは、新しく開かれたIssueを自動で追加する設定も有効にした。`main`にルールセット「Protect main (production)」（id 24295437）を作成した。内容は、PR経由のマージ必須（承認数0）、`ci-gate`の成功必須（ブランチ最新化は求めない）、force push・削除の禁止、Copilotの自動レビュー。バイパスできるアクターはいないため、管理者を含めて`main`へ直接pushできない。`gh api repos/K0mork/knittingEditor/rules/branches/main`で5つのルールが適用されていることを確認した。
- 主なファイル: `.github/dependabot.yml`（npmとGitHub Actionsを毎週月曜9時（JST）にまとめて更新。公開から7日待ってから取り込む）、`.github/release.yml`（Releaseノートの自動生成をラベル別に分類）、`AGENTS.md`（`main`へ直接pushせず、`ci-gate`が通ったPRをマージする手順に変更。Issue・Dependabot・ラベルの運用を追記）、`ios/AGENTS.md`（作業管理の規則をIssue運用に変更）、`README.md`・`ios/README.md`・`ios/DEVELOPMENT.md`・`ios/docs/PRO_PLAN.md`（残作業の参照先をIssueとマイルストーンに変更）。`TODO.md`と`ios/TODO.md`は削除した（完了済み項目の確認結果は`DEVELOPMENT_LOG.md`と`ios/DEVELOPMENT_LOG.md`に残っている）。
- テスト: 動作の変更がないため、テストは追加していない。
- 検証: `ruby -ryaml`で`.github/dependabot.yml`と`.github/release.yml`を読み込めることを確認し、`ios/scripts/check-app-store-docs.sh`が成功した。CodeQL Setupの初回実行（run 36831724297）は成功し、コードスキャンとDependabotのアラートはどちらも0件だった。`npm run typecheck`・`npm test`・`npm run build`・`npm run check:dist`・`npm run test:e2e`は、ビルド入力を変えていないためローカルでは実行せず、PRのCIで確認する。
- デプロイ影響: `.github/`の変更はCIの変更範囲判定でWeb扱いになるため、マージ後にPagesが再配信されるが、`dist/`の内容は変わらない。マージ後にDependabotがエラーなく設定を読み込んだことを、Insights → Dependency graph → Dependabotで確認する。

## 2026-10-01 — PR #12・#14・#15のレビュー・マージと公開確認

- 影響: PR #12（OGP画像）、#14（iOS Safariの共有・PNG/PDFの番号）、#15（source-availableライセンス）をレビューし、問題を認めずmainへマージした。マージコミットは順に`9f6c8a7`、`98d6ba9`、`ffaf065`。機能の追加修正はなし。主な対象は`index.html`、`public/`、`src/platform.ts`・`ShareFileDialog.tsx`、`packages/editor-core/export/`、`LICENSE`・`README.md`。#14にはmainを取り込み、`DEVELOPMENT_LOG.md`の競合を両方の記録を保持して解消した（`476b390`）。その後のログのみの追加修正`b6ebc8b`も確認した。対象外の#13と、レビュー開始後に作成された#16はマージしていない。
- 検証: Node.js 24.19.0で、#12、#14単独、両者の統合後について`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`が成功。統合後は単体107件、E2E 76件成功・iPhone専用ケースの対象外2件skip（Chromium mobile・WebKit mobile・Chromium desktop）。iOS Webで`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`、`../../node_modules/.bin/vitest run --config vite.config.ts`（8件）が成功。`ios/scripts/check-app-store-docs.sh`も成功した。ローカルの狭幅・デスクトップ・横向き表示、通常・1000×1000盤面・分割PDFの番号を目視確認し、スクリーンショットと出力例を`/tmp/knitting-pr-review-20261001/`へ保存した（コミットしない）。
- CI: 最新PR #14の[run 36830775610](https://github.com/K0mork/knittingEditor/actions/runs/36830775610)と、main `98d6ba9`の[run 36832154376](https://github.com/K0mork/knittingEditor/actions/runs/36832154376)で、changes、app_store_docs、Web、iOS Web、iPhone/iPad Simulator、両端末のアプリ更新、unsigned Release Archive、同梱アセット検査、ci-gateが成功。mainではdeployも成功した。ネイティブ検証はこれらのCI実行結果で確認し、本レビュー中のローカル再実行はしていない。途中の旧コミットのCIは後続pushでキャンセルされており、マージ判定には最新コミットの成功結果を用いた。
- 公開確認: `node /tmp/knitting-pr-review-20261001/live-assets-check.mjs`で、HTTPSの`/`、`/guide/`、`/CNAME`、`/og-image.png`、JS/CSS/PDF Workerの200応答を確認した。CNAMEは`knittingeditor.com`、両HTMLにOG画像と`summary_large_image`があり、画像と配信アセットはローカルビルドとSHA-256が一致した。`node /tmp/knitting-pr-review-20261001/browser-check.mjs https://knittingeditor.com/`で、ChromiumのPNG/PDF保存、四辺の番号と描いた記号、トップと使い方ページの直接アクセス・再読み込み、WebKit mobileの共有ダイアログ・編集画面維持を確認した。解析スクリプトには空応答を返した。WebKitの共有APIは差し替えており、実機および実際のiOS共有シートは本レビューでは未確認（SimulatorがUI操作ツールの対象に含まれなかったため）。
- デプロイ影響: 上記3件はPagesへ反映済み。iOSアプリの番号変更は次回ビルドから反映され、TestFlight/App Storeへの提出は行っていない。本記録のみのコミットのデプロイ影響はnone。記録のmainへの直接pushはGitHubの保護ルール（GH013、PR経由・ci-gate必須）で拒否されたため、記録用PRを経由して反映する。

## 2026-10-01 — iPhone・iPad Safariの保存を共有シートへ渡し、PNG・PDFへ段・目番号を入れる

- 影響: (1) iPhone・iPadのSafariでPDFを保存すると、`<a download>`がダウンロードではなく編集中のタブをPDF表示へ置き換え、エディタが消えたように見えていた（PNGで「表示」を選んだときも同じ）。iOS Safari（iPadOSのデスクトップ表示はタッチ点の数で判定）で`navigator.canShare`がファイルを受け付けるときは、生成後に「「〇〇.pdf」の準備ができました」ダイアログを出し、「共有・保存」ボタンから共有シート（Web Share API）で渡すようにした。共有シートは利用者のタップの中でしか開けず、生成を待つ間にその権利が切れるため、もう一度押してもらう。共有シートを閉じたときは何もせず、共有に失敗したときは従来のダウンロードへ戻す。PNG・PDF・`.knit`の保存がこの経路を通る。デスクトップ・Android・共有APIの無いアプリ内ブラウザは従来どおりダウンロードする。`chart_exported`はこれまでどおり生成したファイルを渡した時点で送る。(2) PDFに段・目の番号が無かった。PNGと同じく盤面の四辺に番号（右下が1）を入れ、分割PDFではそのページの段・目を書く。番号の帯の分だけ盤面の領域を縮め、推定ページ数と実際の分割は同じ計算を使う。(3) PNGは四辺に番号が入っていたが、1セルが小さい大盤面（1000×1000の既定7px）では番号が重なり、左右の帯（1セル幅）からはみ出していた。PNG・PDFとも、隣と重なるときは2・5・10などの倍数だけを書き、PNGは番号が入らないときだけ帯を番号の大きさまで広げる（20×20の528×528pxなど通常の寸法は変わらない）。共通コードの変更なのでiOS版のPNG・PDFも同じになる。使い方ページ（Web版・iOS版）に説明を追記した。
- 調査: GA4でiOSのWeb利用者からの出力が記録されていなかったため、iPhone 18 Pro Simulator（iOS 27）のSafariで本番を操作した。PNG・PDFとも生成され、`chart_exported`もリアルタイムで受信したので、計測と出力自体は壊れていなかった。この確認操作は本番GA4に記録された（内部アクセス除外フィルタは「テスト」状態のまま）。
- 主なファイル: `src/platform.ts`、`src/ShareFileDialog.tsx`、`src/App.tsx`、`src/styles.css`、`packages/editor-core/export/labels.ts`、`packages/editor-core/export/pdfLayout.ts`、`packages/editor-core/export/pdf.worker.ts`、`packages/editor-core/export/exporters.ts`、`public/guide/index.html`、`ios/Web/public/guide/index.html`、`ios/docs/WEB_SYNC.md`
- テスト: 番号の間引きの3件（`labels.test.ts`）、PDFの3件（四辺の番号、分割ページの番号、大盤面での間引き）、PDFレイアウトの7件（番号の帯を含めて余白内に収まる）、PNGの2件（通常盤面の帯と間引きなし、大盤面で帯を広げて間引く）、Web版の共有判定と`createWebPlatform`の4件（`src/platform.test.ts`）、確認ダイアログの4件（`src/ShareFileDialog.test.tsx`）、Playwrightの1件（WebKit mobileで共有APIを差し替え、PNG・PDFを共有シートへ渡し、閉じても共有せず、URLが変わらず編集画面が残る）を追加した。PlaywrightのWebKitは`http://127.0.0.1`で共有APIを持つため、既存の「creates a block and exports backup and PDF」はダウンロードした`.knit`で往復を確かめるよう共有APIを外した。
- 検証: Node.js 24.21.0で`npm run typecheck`、`npm test`（18ファイル・107件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`、`dist/guide/index.html`に追記を確認）、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、73件成功・iPhone専用テストの2件skip）が成功。iOS Web `tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（3ファイル・8件）が成功。`xcodegen generate --spec ios/project.yml`、`xcodebuild test`（KnittingEditor iPhone 16 Simulator、Xcode 27.0）でSwift単体テスト24件（1件skip）とXCUITest 18件（iPad専用5件skip、`testBackupExportSheetDismissesBackToEditor`はCIと同じく除外）、Simulator向けDebug buildと`check-app-bundle.sh`、unsigned Release Archiveと`check-release-assets.sh`（同梱の使い方ページに追記を確認）、`simulate-app-update.sh`（KnittingEditor iPhone 16）が成功。iPadでの実行はCIに任せる。iPhone 18 Pro SimulatorのSafariでローカル開発版を開き、PDF保存でダイアログ→共有シート（「プリント」「"ファイル"に保存」）が開き、閉じると編集画面へ戻ることを確認した（ファイルは保存していない）。20×20・1000×1000のPNGと、20×20・1000×1000の1ページPDF、60×40の分割PDFを画像にして番号を目視確認した。スクリーンショットはコミットしない。実機は未確認。
- デプロイ影響: `main`へのマージ後にPagesへ配信される。配信後に`https://knittingeditor.com/`をiPhoneのSafariで開き、PDF保存で「共有・保存」ダイアログと共有シートが出て編集画面が残ること、デスクトップではPNG・PDFがダウンロードされ四辺に番号が入ることを確認する。iOS版は次回ビルドから番号入りのPNG・PDFになる。

## 2026-10-01 — SNS共有用のOGP画像を追加

- 影響: トップページと`/guide/`のURLをX・LINE・Facebook・Slack・iMessageなどで共有したとき、文字だけの小さなカードではなく1200×630の画像付きカードが出るようにした。画像は縮小表示でも読めるよう「棒針の／編み図」を大きく置き、下の帯に「無料・登録不要」、右にエディタと同じ表目・かけ目・ねじり目の記号を並べた。両ページに`og:image`（型・幅・高さ・alt）と`og:site_name`を加え、`twitter:card`を`summary_large_image`にした。`/guide/`にはOGPが無かったため、`og:title`・`og:description`・`og:type`（`article`）・`og:url`・`og:locale`も追加した。検索順位への直接の影響はない。
- 画像の生成: `scripts/generate-og-image.mjs`が`packages/editor-core`の記号SVGを読み、PlaywrightのChromiumで描いて`public/og-image.png`（67,369バイト）へ書き出す。和文はヒラギノ角ゴシックに依存し、Linux CIでは同じ画像にならないため、CIでは生成せずPNGをコミットする。macOS以外では実行を止める。同じ入力から2回生成し、SHA-1が一致することを確認した。npmスクリプトにすると`package.json`の変更でiOSのジョブまで起動するため、`node scripts/generate-og-image.mjs`で直接実行する。
- 主なファイル: `public/og-image.png`、`scripts/generate-og-image.mjs`、`index.html`、`public/guide/index.html`、`scripts/check-dist.mjs`、`tests/e2e/seo.spec.ts`。iOS版の同梱ページは共有されないため変更していない。
- テスト: `seo.spec.ts`で両ページの画像メタデータと`summary_large_image`、`/guide/`のOGP、`/og-image.png`が`image/png`で返りPNGのIHDRが1200×630であることを検査する。`check-dist`は`dist/og-image.png`の存在・PNGシグネチャ・寸法と、配信HTML 2ページの`og:image`を検査する。
- 検証: `npm run typecheck`、`npm test`（15ファイル・84件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`、`dist/og-image.png`と両ページの`og:image`を確認）、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、75件）が成功。画面の表示は変えていないため、ビューポート別の目視確認は画像そのもの（幅400・200・120pxへの縮小を含む）に限った。
- デプロイ影響: `main`へのマージ後にPagesへ配信される。配信後に`https://knittingeditor.com/og-image.png`がHTTPS 200で返ること、トップと`/guide/`の配信HTMLに`og:image`があることを確認する。SNS側はカードをキャッシュするため、既に共有済みのURLは各サービスの再取得（FacebookのシェアデバッガーやXの再投稿など）まで古い表示が残りうる。

## 2026-10-01 — PR #11のレビュー・マージと公開確認

- 影響: PR #11（Undo/Redo）をレビューし、`aa35c8c`でmainへマージ。コードの追加修正はなし。主な対象は`packages/editor-core/model/BoardHistory.ts`、`state/useEditorSession.ts`、`ui/`、`canvas/BoardCanvas.tsx`とWeb/iOSの使い方ページ。
- 検証: Node.js 24.21.0で`npm run typecheck`、`npm test`（84件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile/desktop・WebKit mobile、72件）が成功。`ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`と`../../node_modules/.bin/vitest run --config vite.config.ts`（8件）、`ios/scripts/check-app-store-docs.sh`も成功。375px・1280px幅の表示を目視確認し、画像を`/tmp/knitting-pr11-review/`へ保存（コミット対象外）。既存テストを再検証し、テストの変更はなし。
- CI: https://github.com/K0mork/knittingEditor/actions/runs/36818335069 の初回はiPhoneの既存`testDocumentSwitchAutosavesEachDocument`が名前入力等のUI操作遅延で3分の制限を超え、ci-gateが配信を停止。`gh run rerun 36818335069 --failed`後に成功。Web、iOS Web、XcodeGen、iPhone/iPad Simulator、両端末のアプリ更新、unsigned Release Archive、オフラインバンドル検査、App Store文書、ci-gate、deployの成功を確認。今回のローカルではXcodeの一式を再実行せず、同じマージコミットのCIで検証した。実機は未確認。
- デプロイ影響: Pagesへ配信済み。HTTPSの`/`、`/guide/`、`/CNAME`を取得し、ドメイン`knittingeditor.com`、使い方の説明、新しいJS/CSSがローカルビルドと同じパスであることを確認。公開UIで入力（記号1→2個）、Undo（1個）、Redo（2個）、再Undo（1個）と保存完了を確認し、再読み込み後も1個の状態が残り、履歴が破棄されることを確認。この記録のみの追加コミットは実行時動作・配信内容への影響none。

## 2026-09-23 — 盤面の編集を元に戻す・やり直す

- 影響: Web版とiOS版の編集画面に「元に戻す」「やり直す」を追加した。対象は記号の入力・消去、貼り付け、段・列の追加・削除・挿入・寸法変更、全消去。1回のなぞり入力は指を離した時点で1回分にまとめる。操作メニュー（狭い画面では下端、760px以上では右列）のボタンと、Ctrl/Cmd+Z（元に戻す）、Ctrl/Cmd+Shift+Z・Ctrl+Y（やり直す）で操作でき、入力欄の中のショートカットは入力欄自身に任せる。戻した結果は通常の編集と同じく自動保存される。履歴は開いている編み図ごとにメモリ上だけで持ち、編み図の切り替え・新規作成・削除・復元・再読み込みで捨てる。
- 設計: `packages/editor-core/model/BoardHistory.ts`はReactに依存せず、最後に記録した盤面との差分を1件にする。寸法が同じ編集は変わったセルの位置と前後の値だけを持ち、1000×1000盤面でも1筆ごとに盤面全体を複製しない。寸法が変わる編集は前後の盤面を持つ。直近100件・合計64MiBを超えた分は古いものから捨てる（直前の1件は残す）。`Board.restore`でセル配列と占有情報を差し替える。`useEditorSession`が履歴を持ち、`BoardCanvas`の新しい`onEditEnd`（全部の指を離したとき）でなぞり入力を確定し、盤面設定・貼り付けは`changed`の時点で確定する。戻すと寸法が変わりうるので選択範囲は解除する。
- 画面: 上の道具列は375px幅で余白が無く、置くと「消す」「範囲」が隠れるため、操作メニューへ置いた。操作メニューを折り返し可能にし、文字が大きく1行に収まらないときは元に戻す・やり直すだけ次の行へ回す（375px幅・ルート文字サイズ16〜53pxで、操作メニューのどのボタンも文字がはみ出さないことをブラウザで確認）。矢印はSVGで描く。使い方ページ（Web版・iOS版）と`ios/SPECIFICATION.md`、`ios/TODO.md`のP1「Undo/Redoを設計する」を更新した。
- 主なファイル: `packages/editor-core/model/BoardHistory.ts`、`packages/editor-core/model/Board.ts`、`packages/editor-core/state/useEditorSession.ts`、`packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/ui/EditorView.tsx`、`packages/editor-core/ui/hooks.ts`、`packages/editor-core/canvas/BoardCanvas.tsx`、`packages/editor-core/styles/base.css`、`public/guide/index.html`、`ios/Web/public/guide/index.html`。
- テスト: `BoardHistory`の7件（なぞり入力のまとめ、差分なし、複数セル記号の足跡復元、寸法変更の往復、記録前の書き換えの扱い、新しい編集でやり直しを捨てる、件数・容量上限）、`EditorView`の1件（盤面設定の取り消し・再実行、トースト、編み図切り替えで履歴を捨てる）、Playwrightの1件（タップ＋なぞり入力を戻すとタップだけ残る、キーボードでのやり直し、段追加の取り消し、IndexedDBへの保存結果）、XCUITestの1件（`testUndoAndRedoRestoreBoardEdits`：WKWebView上のタップを戻す・やり直す）を追加した。
- 検証: Web `npm run typecheck`、`npm test`（15ファイル・84件）、`npm run build`、`npm run check:dist`（`dist/CNAME`は`knittingeditor.com`、`dist/guide/index.html`に追記を確認）、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、72件）。iOS Web `tsc -p tsconfig.app.json --noEmit`、`vitest run --config vite.config.ts`（8件）。`xcodegen generate --spec ios/project.yml`（生成物に差分なし）、`xcodebuild test`（iPhone 16／iOS 18.2 Simulator、Xcode 27.0）でSwift単体テスト24件（1件skip）とXCUITest 18件（iPad専用5件skip、`testBackupExportSheetDismissesBackToEditor`はCIと同じく除外）が成功。Simulator向けDebug buildと`check-app-bundle.sh`、unsigned Release Archiveと`check-release-assets.sh`、`simulate-app-update.sh`（iPhone 16）、`check-app-store-docs.sh`が成功した。375px・768px・1280px幅とWebKit（iPhone 14）で表示を目視確認し、スクリーンショットを保存した（コミットしない）。iPad Simulatorでの実行はCIに任せる。実機（タッチ、ハードウェアキーボードのCmd+Z）は未確認。
- デプロイ影響: Web版は`main`へのマージ後にPagesへ配信される。配信後に`https://knittingeditor.com/`で記号を入力して元に戻す・やり直すが動き、再読み込み後も戻した状態が残ること、`/guide/`に説明があることを確認する。iOS版は次回ビルドから反映。

## 2026-09-23 — 編集画面をWeb版とiOS版で共通化し、共通コア内の重複を整理

- 影響: (1) Web版とiOS版の`App.tsx`に約250行ずつ同じ状態・操作・画面が残っていたため、状態と操作を`packages/editor-core/ui/useEditorController.ts`、画面の組み立てを`packages/editor-core/ui/EditorView.tsx`へ移した。環境差分は引数で受け取る（初期化、`platform.saveFile`、分析、`askText`・`askConfirm`、見出し、フッター、案内文、使い方リンクの処理、復元要求の横取り、重ねる要素）。保存失敗の文言は`saveErrorMessage`にまとめた。(2) 分析の受け口`EditorAnalytics`と`NO_ANALYTICS`、寸法・件数のバケットを`packages/editor-core/analytics.ts`へ置いた。Web版はGA4実装を渡し、iOS版は何も渡さないため、no-opだった`ios/Web/src/analytics.ts`を削除した。(3) iOS版のアプリ内ダイアログを`ios/Web/src/AppDialog.tsx`（`useAppDialog`）へ切り出した。(4) 呼び出し元のなくなった再エクスポートだけのファイル（両ビルドの`model/`・`stitches/`・`canvas/`・`export/`、iOS版の`storage/database.ts`）を削除し、Web版の`storage/database.ts`は旧データ移行だけを持つようにした。(5) 共通コア内の重複を整理した。盤面CanvasとPNG出力のセル描画を`stitches/drawCell.ts`へ、`Board.resize`と段・列の挿入削除の再配置を1つの`relayout`へ、盤面とブロック復元の足跡検証を1つの関数へまとめた。base64変換とエラー文言変換を`util/`へ移し、保存・PDF Worker・UI・iOSブリッジから使う。ネイティブブリッジの送信処理、Canvasのモード名とズーム上限、PDF設定の型（`PdfLayoutOptions`）も1か所にした。(6) ルートの`tsconfig.app.json`が`src`だけを対象にしていたため、`packages/editor-core`のテストは型検査されていなかった。`packages`を対象へ加えた。
- 挙動の変更: なし。リファクタリング前（`74bba17`）と後のWebビルドを並べ、Chromiumデスクトップ・WebKit（iPhone 14）の両方で編集画面と保存・出力パネルのDOMが完全一致し、スクリーンショットもバイト単位で一致することを確認した。
- 主なファイル: `packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/ui/EditorView.tsx`、`packages/editor-core/analytics.ts`、`packages/editor-core/util/`、`packages/editor-core/stitches/drawCell.ts`、`packages/editor-core/model/Board.ts`、`packages/editor-core/storage/database.ts`、`packages/editor-core/canvas/BoardCanvas.tsx`、`packages/editor-core/export/`、`src/App.tsx`（284行→33行）、`ios/Web/src/App.tsx`（384行→95行）、`ios/Web/src/AppDialog.tsx`、`ios/Web/src/nativeBridge.ts`、`tsconfig.app.json`、`AGENTS.md`、`docs/ARCHITECTURE.md`、`ios/docs/WEB_SYNC.md`、`ios/DEVELOPMENT.md`、`packages/editor-core/README.md`
- テスト: `EditorView`の5件（見出し・フッターの差し込みと分析イベント、モード切替、バックアップの`platform`への受け渡し、復元要求の横取り、`saveErrorMessage`）、段・列の挿入削除による記号の移動と削除の1件、base64変換の3件、分析バケットの1件（Web版のテストから移動）を追加した。iOS版の相互運用テストは`ios/Web/src/backupInterchange.test.ts`へ移し、共通の`base64ToBytes`を使う。
- 検証: Web `npm run typecheck`、`npm test`（14ファイル・76件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、69件）。iOS Web `tsc -p tsconfig.app.json --noEmit`、`vitest run`（3ファイル・8件）。1つ目のコミット単体でもWeb・iOS Webの型検査とテストが通ることを別worktreeで確認した。`xcodegen generate`、`xcodebuild test`（iPhone 16／iOS 18.2 Simulator、Xcode 27.0）でSwift単体テスト24件（1件skip）とXCUITest 17件（iPad専用5件skip）が成功。Simulator向けDebug buildと`check-app-bundle.sh`、unsigned Release Archiveと`check-release-assets.sh`、`simulate-app-update.sh`（iPhone 16）、`check-app-store-docs.sh`が成功した。iPadでの実行はCIに任せる。検証前後のCoreSimulatorは5.2GBで変わらず、終了後に全Simulatorをshutdownした。
- デプロイ影響: PR [#10](https://github.com/K0mork/knittingEditor/pull/10)を`39517eb`で`main`へマージ。mainの[`CI and deploy Pages` run 35804245998](https://github.com/K0mork/knittingEditor/actions/runs/35804245998)でWeb、iOS Web、iPhone／iPad Simulator、アプリ更新、Release Archive、`ci-gate`、`deploy`を含む全ジョブが成功した。本番`https://knittingeditor.com/`と`/guide/`はHTTPS 200、`/CNAME`は`knittingeditor.com`。編集画面の盤面と保存・出力パネルにPNG／PDF／`.knit`の操作が表示され、配信HTMLは`/assets/index-ql2A1YXH.js`と`/assets/index-CLpSVrd3.css`を参照していた。続けて本番でChromiumデスクトップとWebKit（iPhone 14）から、盤面に2記号を描いて自動保存し、PNG（シグネチャ`89504e47`、17,447／15,769バイト）、PDF（`%PDF-`、7,148バイト）、この編み図の`.knit`（gzip `1f8b`、289／287バイト）を保存できること、その`.knit`を復元すると「1件の編み図を復元しました」と表示され「新しい編み図（復元）」へ切り替わることを確認した。どちらもページエラー・コンソールエラーはなかった。TestFlight／App Storeへの影響は次回ビルドまでなし。

## 2026-09-23 — 保存制御・共通UI・PDFレイアウト・ビルド設定の共通化

- 影響: (1) 編み図の読み込み、自動保存、即時保存、編み図切り替え、`beforeunload`確認を`packages/editor-core/state/useEditorSession.ts`へ集約し、Web版とiOS版の`App.tsx`から重複を外した。以前はiOS版の即時保存（バックグラウンド移行前・使い方ページ遷移前）だけが世代番号を確認せず`dirty`を解除していたため、書き込み中に入った編集が未保存のまま「保存済み」と表示されうる状態だった。保存経路を1本にまとめ、自動保存も即時保存も同じ確認を通す。(2) 自動保存の完了後に`listDocuments()`で全編み図を読み直すのをやめ、保存結果の1件だけを一覧へ反映するようにした。1000×1000の盤面はセル配列だけで約4MBあり、保存済みの編み図が増えるほど、編集していない盤面の読み込みが保存のたびに発生していた。(3) 記号ピッカー、盤面設定、出力設定、モーダルのフォーカス管理、トースト、コピー／貼り付けショートカット、共通CSSを`packages/editor-core`の`ui/`・`styles/`へ移した。iOS版だけが持っていたフォーカス管理、読み上げ用の状態通知（保存状態・モード・選択範囲）、`aria-pressed`／`aria-controls`、初期化失敗時の再読込表示をWeb版でも使うようにした。環境固有の寸法は`--tap-size`などのカスタムプロパティで受け取る。(4) PDFの用紙分割計算を`packages/editor-core/export/pdfLayout.ts`へ純粋関数として切り出し、出力設定の推定ページ数とPDF Workerの実際の分割が同じ計算を使うようにした。(5) 両ビルドの`tsconfig.app.json`をルートの`tsconfig.base.json`へ、Vite設定の共通部分を`vite.shared.ts`へまとめた。(6) iOS用Webビルドの入力ハッシュからテストとMarkdownを外し、共通のビルド設定ファイルを追加した。CIの変更範囲判定にも`vite.shared.ts`を加えた。(7) 保留中の変更を書き切れないまま盤面を差し替えると直前の編集がどこにも残らないため、編み図の切り替えとバックアップ復元を中止するようにした。`switchDocument`は中止した理由（`switched`／`pending`／`failed`）を返す。書き込みに失敗した`failed`は`onSaveError`が通知するが、書き込みは成功していて最中に編集が入った`pending`は通知が出ないため、「編集中のため切り替えできませんでした」と伝える。黙って何も起きないと、操作したつもりの利用者が変化に気づけない。
- 挙動の変更: 出力設定の推定ページ数は、スライダーで選べる2〜10mmの範囲では従来と同じ値になる（旧実装の用紙寸法定数はPDF Workerの計算を丸めたものだった）。共通化の目的は、余白や分割規則を変えたときに表示と出力がずれないようにすることで、現時点で利用者に見えていた不一致は確認していない。速度の改善量は未計測で、一覧の全件取得がなくなることの効果はデータ量に依存する。
- 主なファイル: `packages/editor-core/state/useEditorSession.ts`、`packages/editor-core/ui/`（`StitchPicker.tsx`、`GridControls.tsx`、`ExportControls.tsx`、`hooks.ts`）、`packages/editor-core/styles/base.css`、`packages/editor-core/export/pdfLayout.ts`、`packages/editor-core/export/pdf.worker.ts`、`src/App.tsx`（401行→274行）、`ios/Web/src/App.tsx`（611行→374行）、`src/styles.css`（120行→15行）、`ios/Web/src/styles.css`（142行→36行）、`tsconfig.base.json`、`vite.shared.ts`、`ios/scripts/build-web.sh`、`.github/workflows/ci.yml`、`ios/docs/WEB_SYNC.md`、`packages/editor-core/README.md`
- テスト: 共通コアへ`useEditorSession`の7件（保存結果からの一覧更新、書き込み中に編集が入ったときに`dirty`を残すこと、失敗時の通知、切り替え前の保存、`mergeSavedDocument`）と、PDFレイアウトの9件（推定ページ数が`buildPdf`の実際のページ数と一致すること、タイルの重なり、1ページ構成）を追加した。二重管理だった`model/Board.test.ts`、`export/pdf.worker.test.ts`、`stitches/glyphs.test.ts`、および保存・バックアップ検証を`packages/editor-core`へ統合し、両ビルドの検証項目（記号数の確認、全記号のPDF出力、大盤面の保存・復元）を残した。`src/`にはWeb固有の旧`localStorage`移行とアナリティクスだけ、`ios/Web/src/`にはネイティブブリッジ、`async`、相互運用fixtureだけを残した。E2Eへは、書き込みが失敗する状況（`IDBObjectStore.put`を差し替え）で編み図切り替えと復元が未保存の編集を失わないことの2件と、書き込み中に編集が差し込まれる状況で切り替えが中止され理由が表示されることの1件を追加した。編み図名の検査は`toContainText`へ変えた（名前のあとに読み上げ用の保存状態が続くため）。`.tsx`のテストを拾うよう両ビルドの`test.include`を広げた。
- 回帰テストの妥当性: `persist`から世代番号の確認を外すと「keeps the chart unsaved when an edit lands while the save is in flight」が`expected 'saved' to be 'pending'`で失敗することを確認した。`pending`時の通知を外すと「explains why a switch is blocked by an edit that lands during the save」がトーストを見つけられずに失敗することも確認した。
- 検証: Web `npm run typecheck`、`npm test`（11ファイル・67件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、69件）。iOS Web `tsc -p tsconfig.app.json --noEmit`、`vitest run`（3ファイル・8件）。`ios/scripts/build-web.sh`を実行し、テストだけを変えた場合はスキップ、共通ソースを変えた場合は再ビルドされることを内容ハッシュで確認した。`xcodegen generate`（生成物に差分なし）、Swift単体テスト23件、XCUITest 13件（iPad専用5件はiPhoneではskip）がiPhone 16／iOS 18.2 Simulator（Xcode 27.0）で成功。`ios/scripts/simulate-app-update.sh`の更新復元、unsigned Release Archiveと`check-release-assets.sh`、Simulator向けDebug buildと`check-app-bundle.sh`、`check-app-store-docs.sh`が成功した。
- 目視確認: Web版の開発サーバーを375×812と1280×800で確認し、CSSを共通部分と環境差分へ分けたあとも、狭幅の縦積みレイアウトと760px以上の右カラム・サイドドロワーが従来どおりであること、共通化した記号ピッカーと出力設定が正しく表示されることを確認した。ブラウザコンソールにエラーは出ていない。
- 注意: 環境固有のCSSは共通CSSのメディアクエリより後ろに読み込まれる。画面幅で切り替えている宣言（`.workspace`・`.action-bar`・`.drawer`）を環境側で上書きするとメディアクエリを打ち消すため、そうした値は共通CSSかカスタムプロパティへ置く。共通のビルド設定を新しいファイルへ切り出すときは、`ios/scripts/build-web.sh`のハッシュ対象とCIの`changes`判定の両方へ追加する。
- デプロイ影響: PR [#9](https://github.com/K0mork/knittingEditor/pull/9) の run [`35755595740`](https://github.com/K0mork/knittingEditor/actions/runs/35755595740)で`changes`、`web`、`ios_web`、iPhone／iPad `ios`、iPhone／iPad `app_update`、`release_archive`、`app_store_docs`、`ci-gate`の全10ジョブが成功した（`deploy`はPRなのでskip）。マージコミット`a03464c`のmain run [`35756984054`](https://github.com/K0mork/knittingEditor/actions/runs/35756984054)で全ジョブとPages `deploy`が成功。本番`https://knittingeditor.com/`はHTTPS 200で、配信している`index-CIrmEDXC.js`と`index-CLpSVrd3.css`がこのコミットのローカルビルドと一致した。狭幅（375×812）で描画2点が自動保存されIndexedDBに1600バイト・記号2個で入ること、共通化した記号ピッカーから「かけ目」を選んで描けること（永続記号ID 1と3が保存される）、編み図の複製と切り替えでパネルが閉じて盤面が入れ替わること、盤面の読み上げが「20段、20目。記号3個。描画モード。選択範囲なし」へ更新されること、編み図名に読み上げ用の保存状態（「新しい編み図のコピー、保存済み」）が付くこと、共通化した出力設定が推定1ページを表示しPDF保存がエラーなく完了することを確認した。広幅（1280×800）の右カラムとサイドドロワーも従来どおりで、ブラウザコンソールにエラーは出ていない。

## 2026-09-23 — 統合後のドキュメントを現行構成へ更新

- 影響: `AGENTS.md`を現在の変更範囲別CIに合わせ、文書のみの変更では静的文書検査だけを要求するようにした。旧`TODO.txt`の実装済み項目を整理して`TODO.md`からiOSの現行リリースゲートへ案内し、README、共通基盤、iOS開発方針、仕様、ネイティブブリッジ、App Storeチェックリストを単一リポジトリ・共通workspace・最新の実機／CI結果へ更新した。統合前の`ios/DEVELOPMENT_LOG.md`は凍結アーカイブとして変更していない。
- 主なファイル: `AGENTS.md`、`README.md`、`TODO.md`、`docs/ARCHITECTURE.md`、`ios/AGENTS.md`、`ios/README.md`、`ios/DEVELOPMENT.md`、`ios/SPECIFICATION.md`、`ios/docs/NATIVE_BRIDGE.md`、`ios/docs/APP_STORE_CHECKLIST.md`
- テスト: 文書内の旧リポジトリ境界、固定SHA同期、個別lockfile、旧CIジョブ名、未実施扱いの実機確認を`rg`で再検査し、意図した統合経緯の記述以外に残っていないことを確認した。ローカルMarkdownリンク検査、`ios/scripts/check-app-store-docs.sh`、ワークフローYAMLの構文検査が成功した。
- デプロイ影響: なし。変更はMarkdown文書だけなので、CIでは`changes`、`app_store_docs`、`ci-gate`だけを実行し、Web・Simulator・Archive・Pages公開はskipされることを確認する。

## 2026-09-22 — ドキュメント変更でiOSの重い検証を回さない

- 影響: 変更範囲判定でMarkdownを先に除外し、`ios/**/*.md`だけの変更ではSimulatorを使うジョブを回さないようにした。代わりにApp Store提出文書の検査を、変更範囲によらずUbuntuで常に実行する`app_store_docs`ジョブへ切り出し、`ci-gate`がその成功を無条件に要求する。条件を持たないジョブなので、判定を誤ってもskipで素通りしない。`app_update`の`timeout-minutes`を20から30へ上げ、`ios`ジョブと揃えた。
- 経緯: 直近50コミットのうち32件が`.md`のみの変更で、`ios/`配下を含むとそのたびにmacOSの6ジョブが約22分走っていた。run [`35720826016`](https://github.com/K0mork/knittingEditor/actions/runs/35720826016)では、`app_update (iPad)`の実作業が9分45秒で成功したあとランナーの後片付けに5分40秒かかり、20分の上限を超えてcancelled扱いになった。同ジョブの所要は直近3runでいずれも7〜8分で、遅いのはランナー側である。
- 主なファイル: `.github/workflows/ci.yml`、`docs/ARCHITECTURE.md`
- テスト: 判定の`case`文をローカルのbashで再現し、`ios/docs/*.md`→どちらも立てない、`ios/docs/screenshots/*.png`→ios、`ios/Web/src/**`→ios、`packages/**`→web+ios、`src/**`→web、`.github/workflows/*`→web+ios、`public/CNAME`→web になることを確認した。スクリーンショットは`check-app-store-docs.sh`と`check-release-assets.sh`の検査対象なので、Markdownと同じ扱いにはしない。
- 検証: `ios/scripts/check-app-store-docs.sh`を単体実行し、0.6秒で成功することを確認した（`plutil`や`xcrun`を使わないテキスト検査のみ）。ワークフローのYAMLはPythonの`yaml.safe_load`で構文を確認した。PR [#8](https://github.com/K0mork/knittingEditor/pull/8) の run [`35730361619`](https://github.com/K0mork/knittingEditor/actions/runs/35730361619)で全10ジョブが成功した。新しい`app_store_docs`は5秒、`app_update (iPad)`は9分22秒で、30分の上限に対して余裕がある。
- CI追補: run [`35731641831`](https://github.com/K0mork/knittingEditor/actions/runs/35731641831)で`testCoreEditorControlsExposeAccessibleNamesAndState`が2回とも失敗した。起動直後に最初のページ内要素を待つ上限だけが10秒で、他のテストが使う45秒より短かった。`webViews.firstMatch`はWKWebViewの器が出た時点で成立し、Reactの描画完了を意味しない。ストレージ初期化だけでも最大10秒（`STORAGE_INITIALIZATION_TIMEOUT_MS`）かかり得るため、この待機を起動用の上限へ揃えた。iPhone 16／iOS 18.2 Simulatorでローカル実行し13.3秒で成功した。
- CI追補2: run [`35733448871`](https://github.com/K0mork/knittingEditor/actions/runs/35733448871)で`app_update (iPad)`が失敗した。`testSeedDocumentForAppUpdateProbe`は178秒で成功していたが、1テストあたりの上限120秒を超えて`Failing tests:`へ載った。原因はこの一連の変更で`replaceText`の操作回数を増やしたことで、1操作が数秒かかるランナーで効いた。入力欄がダイアログのように全選択済みなら1回タップ後そのまま上書きし、一致しなかったときだけ末尾からの削除へ落ちる形に戻した。あわせて`ios/scripts/simulate-app-update.sh`の1テスト上限を90/120から180/240へ引き上げた。本当のハングはジョブの`timeout-minutes: 30`が捕まえる。ローカルのiPad 10で`simulate-app-update.sh`の全工程（seed 31.7秒、更新後の復元 21.6秒）、iPhone 16でXCUITest 18件（5件skip）がすべて成功した。
- 訂正: ドキュメントのみのコミットを足しても重いジョブはskipされない。`pull_request`の判定は`pull_request.base.sha`との差分、つまりPR全体の差分を見るため、ワークフローを含むPRでは常に全検証になる。①の効果が出るのは`main`へのpush、またはPR全体がドキュメントだけの場合である。
- デプロイ影響: PR [#8](https://github.com/K0mork/knittingEditor/pull/8) の最終run [`35737825912`](https://github.com/K0mork/knittingEditor/actions/runs/35737825912)で全10ジョブが成功し、`app_store_docs`はubuntuで5秒、`app_update (iPad)`は12分54秒だった。マージコミット`9c63e61`のmain run [`35739657855`](https://github.com/K0mork/knittingEditor/actions/runs/35739657855)で全ジョブとPages `deploy`が成功。Web資産は変わらないため、本番`https://knittingeditor.com/`はHTTPS 200で同じ`index-CLWjFZqB.js`と`index-CsQElkH0.css`を配信している。

## 2026-09-22 — 統合の積み残しを解消し、入力ダイアログの取り消し事故を修正

- 影響: (1) アプリ内の入力ダイアログ（prompt）を背景タップで閉じないようにした。入力欄をタップするとキーボードでダイアログが上へずれるため、続けて置いた指が背景へ当たり、入力した編み図名ごと取り消されていた。確認ダイアログ（confirm）は失うものがないので従来どおり背景タップで閉じる。(2) Web版の盤面Canvasへ、iOS版だけが持っていたアクセシビリティ情報（`role`、段数・目数・記号数・モード・選択範囲を読む`aria-label`、操作説明）を追加した。見た目は変えていない。(3) 統合後も複製のまま残っていた`pdf.worker.ts`、`exporters.ts`、`BoardCanvas.tsx`と共通テストを`packages/editor-core`へ移し、両ビルドは再エクスポートだけにした。`EditorPlatform`は実際に呼ばれる`saveFile`だけに縮小した。(4) iOS用Webビルドの入力ハッシュを、`ios/Web`・`packages`・ルートの依存定義・ビルドスクリプトだけに限定した。(5) CIの変更範囲判定が比較対象を決められないときに全検証へ倒れるようにし、`ci-gate`が判定ジョブ自体の失敗と未決定を検査するようにした。GitHub Actionsは可変タグからcommit SHAピンへ戻した。(6) 記号ID表と、共通化しないファイルの差分台帳を復活させ、旧リポジトリを指すURLを統合先へ移した。開発ログの記録先をルートへ一本化した。
- 経緯: 統合後の点検で、`.git`まで含めてハッシュしていたためXcodeビルドのスキップが効かず走査中のファイル消失でビルドが落ち得ること、`git rev-list --max-parents=1`のフォールバックが233件のコミットを返して判定ジョブが失敗し、その場合に`ci-gate`が素通りすること、`docs/WEB_SYNC.md`の差分台帳と記号IDスナップショットが統合時に削除されていたことが分かった。
- 主なファイル: `ios/Web/src/App.tsx`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`packages/editor-core/`（`canvas/`、`export/`、`platform.ts`、`README.md`、`storage/database.test.ts`）、`src/`と`ios/Web/src/`の再エクスポート、`ios/scripts/build-web.sh`、`.github/workflows/ci.yml`、`vite.config.ts`、`AGENTS.md`、`ios/AGENTS.md`、`docs/ARCHITECTURE.md`、`ios/docs/WEB_SYNC.md`、`ios/docs/PRIVACY_POLICY.md`、`ios/docs/APP_STORE_METADATA.md`、`ios/DEVELOPMENT.md`、`ios/DEVELOPMENT_LOG.md`（凍結明記）
- テスト: 共通コアに`.knit`復元の厳格な検証（壊れたブロック1件で復元全体が中止されること、複数セル記号のはみ出し、文書数・ブロック数・圧縮サイズの上限）を5件追加した。Web版のE2Eへ盤面のアクセシビリティ情報の検証を追加した。XCUITestへ`testPromptDialogIgnoresBackgroundTaps`を追加し、背景タップでpromptダイアログが閉じないことを確認する。`replaceText`は連続タップをやめ、1回タップと末尾からの削除に変えた。
- 検証: Web `npm run typecheck`、`npm test`（8ファイル・38件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、69件）。iOS Web `tsc -p tsconfig.app.json --noEmit`、`vitest run`（6ファイル・31件）。`ios/scripts/build-web.sh`で生成したあと、2回目の実行がスキップされ、`git status`を挟んでも変わらないことを確認。`xcodegen generate`、Swift単体テスト（24件、1件skip）。XCUITestはiPhone 16／iOS 18.2 Simulator（Xcode 27.0）で実行し、修正前は`testDocumentSwitchAutosavesEachDocument`、`testEditAndRelaunchRestoresLocalDocument`、`testTwoFingerGestureDoesNotDrawOnBoard`の3件が失敗（`入力`TextFieldが消えて`typeText`が失敗）、修正後はXCUITest 18件（5件skip、iPad専用）がすべて成功した。回帰テストの妥当性は、アプリ側の修正だけを戻すと`testPromptDialogIgnoresBackgroundTaps`が失敗することで確認した。
- 原因特定: Simulatorで手動再現し、入力欄をタップした時点でキーボードが出てダイアログが上へスクロールすることを画面で確認した。XCUITestの3回タップは同じ画面座標へ打つため、2回目以降がずれた先の背景に当たり、`onMouseDown`の背景判定が`onResolve(null)`を呼んでいた。
- CI追補: PR run [`35715593164`](https://github.com/K0mork/knittingEditor/actions/runs/35715593164)ではunsigned Release Archive作成とbundle検査まで成功したが、App Store文書の検査スクリプトだけが旧`knittingEditor_app` URLを期待して失敗した。メタデータと同じ統合先URL（サポートは`/issues`、プライバシーポリシーは`/blob/main/ios/docs/PRIVACY_POLICY.md`）を検査するよう修正した。再実行run [`35716418346`](https://github.com/K0mork/knittingEditor/actions/runs/35716418346)ではRelease Archive検査が成功した一方、iPad Simulatorが入力欄へフォーカスしてもソフトウェアキーボードを公開せず、既存の`testDocumentDialogRemainsUsableWithKeyboardVisible`だけが2回失敗した。ソフトウェアキーボードが出ないこと自体は失敗にせず、出たときは従来どおりキーボードで操作ボタンが隠れないことを検査するようにした（`isHittable`は上に乗った要素を考慮する）。iPad 10 Simulator（iOS 18.2）でローカル実行し、`testDocumentDialogRemainsUsableAfterFocusingInput`と`testPromptDialogIgnoresBackgroundTaps`の成功を確認した。
- デプロイ影響: PR [#7](https://github.com/K0mork/knittingEditor/pull/7) の最終run [`35718368495`](https://github.com/K0mork/knittingEditor/actions/runs/35718368495)で`changes`、`web`、`ios_web`、iPhone／iPad `ios`、iPhone／iPad `app_update`、`release_archive`、`ci-gate`の全9ジョブが成功した。マージコミット`02f6a4b`のmain run [`35719499164`](https://github.com/K0mork/knittingEditor/actions/runs/35719499164)でも全ジョブとPages `deploy`が成功。本番`https://knittingeditor.com/`はHTTPS 200で、配信JS `index-CLWjFZqB.js`とCSS `index-CsQElkH0.css`がこのビルドと一致した。盤面の`role="application"`、`aria-label`（20段・20目・記号0個・描画モード・選択範囲なし）、`aria-describedby`と視覚的に隠した操作説明を本番で確認し、記号を置くと`記号1個`へ更新されることも確認した。

## 2026-09-22 — Web・iOS共通workspaceの統合基盤を追加

- 影響: iOS版のGit履歴を`ios/`へ取り込み、ルートworkspaceと`packages/editor-core`を追加した。盤面、記号カタログ、ベクター記号の実装をWeb版とiOS版から共通パッケージへ移し、両方のWeb bundleは同じ実装を再エクスポートする。iOS用Webビルドはルートの依存関係を使用する。
- 主なファイル: `packages/editor-core/`、`package.json`、`package-lock.json`、`ios/scripts/build-web.sh`、`.github/workflows/ci.yml`、`docs/ARCHITECTURE.md`、`ios/docs/WEB_SYNC.md`
- CI: 既存のPages workflowとアプリ側workflowを統合し、変更範囲判定、Web検証、iOS Web検証、iPhone／iPad、更新復元、Release Archive、集約ゲート、Pages公開を定義した。共通またはWeb変更時だけPagesを公開し、iOS専用変更では公開しない。
- 検証: Web `npm run typecheck`、`npm test`（7ファイル・33件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、57件）、iOS Web `tsc -p tsconfig.app.json --noEmit`、`vitest run`（8ファイル・46件）、`ios/scripts/build-web.sh`、`xcodegen generate --spec project.yml`、Swift単体テスト（24件、1件skip）、Simulator向けDebug build、bundle offline検査、unsigned Release Archive、release asset検査を実行し成功。ローカルiPhone Simulatorの全XCUITestは6件失敗した（Xcode 27.0／iOS 18.2で、キーボード表示後の`入力`TextField取得に失敗）が、PR CI run [`35698857415`](https://github.com/K0mork/knittingEditor/actions/runs/35698857415)では`web`、`ios_web`、iPhone／iPad `ios`、iPhone／iPad `app_update`、`release_archive`、`ci-gate`の全ジョブが成功した。
- デプロイ影響: PR run [`35699930624`](https://github.com/K0mork/knittingEditor/actions/runs/35699930624)でWeb、iOS Web、iPhone／iPad XCUITest、iPhone／iPad更新復元、Release Archive、`ci-gate`がすべて成功した。PRではPagesの`deploy`をskipし、マージコミット`53de110a6df972bc87f5705851094c0dff70f910`のmain run [`35701025286`](https://github.com/K0mork/knittingEditor/actions/runs/35701025286)で全ジョブとPages `deploy`が成功した。デプロイログでPagesの`pages_build_version`が同じ統合コミットであること、環境URLが`https://knittingeditor.com/`であることを確認し、公開URLはHTTPS 200、GitHub Pages応答、CNAME由来のcanonicalと生成JS／CSSを確認した。

## 2026-09-22 — Search Consoleの実績に合わせてトップページのSEO表現を改善

- 影響: 検索流入で伸びしろがあった「編み図作成サイト」を自然に含むよう、トップページのtitle、description、OGP、構造化データ、JavaScript実行前の説明文を更新した。実画面のヘッダーにも「無料の棒針編み図作成サイト」を追加し、編み図名と操作ボタンを維持したまま画面幅に応じて折り返す。
- 主なファイル: `index.html`、`src/App.tsx`、`src/styles.css`、`tests/e2e/seo.spec.ts`、`tests/e2e/editor.spec.ts`。
- テスト: SEOメタデータ、構造化データ、クロール可能な説明文、実画面の説明表示をPlaywrightで更新し、復元後の編み図名検証を専用クラスへ変更した。
- 検証: `npm run typecheck`、`npm test`（7ファイル・33件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、57件）を順に実行し、すべて成功。モバイル390×844とデスクトップ1440×900を目視確認し、説明文、編み図名、ヘッダー操作、編集領域に欠けや重なりがないことを確認した。確認画像は `/tmp/knitting-seo-{mobile,desktop}.png`（未コミット）。
- デプロイ影響: 2026-09-22にコミット `2185f7b` を `main` へデプロイした。GitHub Actions「Test and deploy Pages」run `35694881042` の `test-build` と `deploy` は成功。本番 `https://knittingeditor.com/` がHTTPS 200で更新後のtitle・description・構造化データを配信し、モバイル390×844とデスクトップ1440×900で説明文、編み図名、ヘッダー操作が正常に表示されることを確認した。本番確認画像は `/tmp/knitting-seo-live-{mobile,desktop}.png`（未コミット）。今後28日程度のSearch Consoleデータで対象クエリの順位・表示回数・CTRを比較する。

## 2026-09-22 — アプリ版で確認したWeb共通不具合を修正

- 影響: `knittingEditor_app` 側のコミット `dc014f6`、`aca03e8`、`98e9211`、`675389b`、`4ed8401` をWeb版へ同期した。2本指操作時の誤描画を防ぎ、段数増減を上端側へ統一し、大きな文字でもヘッダーを画面内へ保ち、PNG既定値を24px/セル（最大60px）へ拡大して大盤面では安全値へ自動調整する。画面端の複数セル記号、自動保存中の名称変更、3桁カラー、トラックパッドのピンチも修正した。`01e1643` の初期値選択はアプリ内WebView専用ダイアログの修正であり、本Web版は初期値を標準で選択する `window.prompt` を継続使用するため追加変更なし。
- 主なファイル: `src/App.tsx`、`src/canvas/BoardCanvas.tsx`、`src/model/Board.ts`、`src/export/exporters.ts`、`src/styles.css`、各単体・E2Eテスト。
- テスト: 3桁カラー、画面外起点の記号探索範囲、PNG既定解像度と安全上限をVitestへ追加した。2本指操作、wheel抑止、段数往復、名称変更と保存競合、文字拡大時の横向きヘッダーをPlaywrightで検査する。
- 検証: `npm run typecheck`、`npm test`（7ファイル・33件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、57件）を順に実行し、すべて成功。`dist/CNAME` が `knittingeditor.com`、生成HTML内のURLがHTTPSであることも確認した。
- 実UI確認: 製品ビルドをWebKit mobile、667×375横向き、1440×900デスクトップで表示し、ヘッダー操作、編集ツール、盤面、下部・右側メニューに欠けや重なりがないことを確認した。確認画像は `/tmp/knitting-editor-{mobile,landscape,desktop}.png`（未コミット）。
- デプロイ影響: 2026-09-22にコミット `7172947`〜`9adae28` を `main` へデプロイした。GitHub Actions「Test and deploy Pages」run `35687614750` の `test-build` と `deploy` は成功。本番 `https://knittingeditor.com/` がHTTPS 200でJS `index-DPgFRRbH.js` とCSS `index-DUZLEV0q.css` を配信していることを確認した。本番操作では、2本指操作後の保存セル0、wheelイベントの抑止、PNG既定24px・上限60px・20×20で528×528px、段数20→25→20後のセル位置保持、文字サイズ32px相当の横向き667×375でヘッダー操作が画面内（操作文字20px）であることを確認した。

## 2026-09-22 — Googleタグのコマンド形式を公式実装へ修正

- 影響: GA4の初期化・カスタムイベントを、Google公式スニペットと同じ `dataLayer.push(arguments)` 形式でキューへ登録するようにした。タグの非同期読み込み、自動テスト時の計測除外、画面表示と操作手順は変更しない。
- 主なファイル: `src/analytics.ts`、`src/analytics.test.ts`
- 根拠: 2026-09-20〜21にSearch Consoleでは検索からの流入を記録していた一方、GA4は同期間の受信がなく、データストリームにも過去48時間の受信なしと表示された。測定ID `G-VVE0G4ZFL4` はストリーム設定と一致している。
- テスト: キュー内容が通常の配列ではなく `arguments` オブジェクトであり、初期化とカスタムイベントの各コマンドを正しく保持することを検証するよう更新した。
- 検証: コミット単体のクリーンな作業ツリーで `npm ci`、`npm run typecheck`、`npm test`（5ファイル・27件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、42件）を順に実行し、すべて成功。
- デプロイ影響: 2026-09-22にコミット `fc83db1` を `main` へデプロイした。GitHub Actions「Test and deploy Pages」run `35686163773` のテスト・ビルド・デプロイはすべて成功。本番でJS `index-Uchg1IUt.js` とGoogleタグ `G-VVE0G4ZFL4` の読込み、画面上のエラーがないことを確認し、GA4リアルタイムで`page_view`、`session_start`、`first_visit`、`editor_ready`の受信を確認した。`first_edit` と `chart_exported` は実利用時の受信後に確認する。

## 2026-09-20 — 編み目記号の再構築と修正を本番へデプロイ

- 影響: 共通ベクターへ再構築した編み目記号、複数マス表示、交差方向、ねじり目系、減目の交点修正、および「裏目の右上2目一度」の追加を本番へ反映した。
- 主なコミット: `fdc8c75` から `d3c1051` までの記号関連9コミット。
- 検証: デプロイ直前に `npm run typecheck`、`npm test`（27件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、42件）を実行し、すべて成功。GitHub Actions「Test and deploy Pages」run `35510969199` の `test-build` と `deploy` が成功した。
- 本番確認: `https://knittingeditor.com/` がHTTPSでHTTP 200を返し、新しいJS `index-D_EmrmjO.js` を配信していること、パレットに26記号と「裏目の右上2目一度」が表示されること、右上・左上3目一度の中央縦線が交点で停止すること、新規記号を盤面へ配置できることを確認した。`/guide/` の26種類表記も確認した。
- デプロイ影響: 本番反映済み。記録コミットの再デプロイ完了後も同じ生成物と表示を確認する。

## 2026-09-20 — 左右上3目一度の中央縦線を交点で停止

- 影響: 右上3目一度と左上3目一度で中央の縦線が交点より上へ突き抜けていた形を修正し、下側から交点までで停止する形にした。その他の記号は変更していない。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 左右上3目一度の中央縦線について、始点が下端、終点が交点である座標検証を追加した。
- 検証: `npm run typecheck`、`npm test`（27件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、42件）を順に実行し、すべて成功。ローカルの記号パレットをデスクトップ1280×900とモバイル390×844で目視確認し、確認画像を `/tmp/three-decreases-{desktop,mobile}.png` に保存した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 裏目右上2目一度を追加し減目の線端を修正

- 影響: 「裏目の右上2目一度」を2×1目の新規記号ID 26として追加し、既存の永続IDを維持した。右上2目一度、左上2目一度、裏目の左右上2目一度、右上3目一度、左上3目一度は、短い斜線が交点を越えず一点で接続する形へ修正した。画面・PNG・PDFの共通ベクターへ反映される。記号数の案内を26種類へ更新し、バックアップの記号カタログ版を3とした。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.ts`, `src/stitches/catalog.test.ts`, `src/storage/database.test.ts`, `tests/e2e/editor.spec.ts`, `public/guide/index.html`
- テスト: 新規ID、左右の鏡像、2目・3目一度の交点座標、バックアップのカタログ版、パレットの26記号表示、新規記号の選択・盤面配置・ID 26保存を追加・更新した。
- 検証: `npm run typecheck`、`npm test`（27件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、42件）を順に実行し、すべて成功。ローカルの記号パレットをデスクトップ1280×900とモバイル390×844で目視確認し、確認画像を `/tmp/decrease-symbols-{desktop,mobile}.png` に保存した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 裏目左右上ねじり目交差を専用形状へ修正

- 影響: 裏目右上ねじり目交差と裏目左上ねじり目交差を、斜線へ小さなループを継ぎ足した形から、上側の線自体が横長のねじりループを作り、下側の斜線が交差部で途切れる専用形状へ修正した。ねじり目とねじり裏目の形状は変更していない。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 左右の交差記号についてループの制御点、分断された斜線、裏目線、鏡像関係を検証した。承認済みのねじり目とねじり裏目は全座標を固定する回帰テストへ強化した。
- 検証: `npm run typecheck`、`npm test`（26件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。公式編み図のベクターと線の接続・交差順を照合し、ローカルの記号パレットをデスクトップ1280×900とモバイル390×844で目視確認した。確認画像は `/tmp/twist-cross-{desktop,mobile}.png` に保存した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — ねじり目系4記号を正しいループ形へ修正

- 影響: ねじり目とねじり裏目がΩ状に見え、左右のねじり目交差が中央に独立した円を置いた形になっていた問題を修正した。単体は下部で交差して左右へ伸びるループ形、ねじり裏目は同形に裏目線を加えた形とした。交差は上側の斜めストランド自体にねじりループを組み込み、下側の裏目線と左右方向を公式凡例に合わせた。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 単体ねじり目の始終点と交差ループ、左右のねじり目交差が楕円部品を使わず曲線ストランドで構成されることを検証する回帰テストを追加・更新した。
- 検証: `npm run typecheck`、`npm test`（26件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。JIS L 0201のねじり目とクロバー公式編み図の「ねじり目の左上交差」「ねじり目の右上交差」を画像で照合し、ローカルの記号パレットで4記号を目視確認した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 交差記号の右上・左上方向を修正

- 影響: 交差記号で上を通る線の左右が名称と逆になっていた問題を修正した。右上は右下から左上へ進む線、左上は左下から右上へ進む線を途切れず上に描画する。単純交差、裏目交差、2×1交差、2目・3目交差、ねじり目交差の全左右ペアへ反映し、2×1交差は上を通る線束の本数も修正した。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 交差5組について上を通る線の方向と本数を、ねじり目交差について上側の接続方向を左右別に検証する回帰テストを追加した。
- 検証: `npm run typecheck`、`npm test`（25件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。JIS L 0201の右上・左上交差とクロバー公式編み図の右上・左上2目交差、2目と1目の交差、表目2目・裏目1目の交差を画像で照合した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 左右上3目一度の重複線を修正

- 影響: 右上3目一度と左上3目一度で、長い斜線と同方向の短い斜線が重なって二重に見えていた問題を修正した。両記号を縦線、反対側の短い斜線、長い斜線の3本で描画する。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 左右上3目一度がそれぞれ3本の独立した線で構成されることを追加した。
- 検証: `npm run typecheck`、`npm test`（23件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。ローカル盤面で左右の長い斜線が二重にならないことを画像確認した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 複数マス記号を占有領域全体へ描画

- 影響: 盤面上の占有判定だけが複数マスで図形は1マスに留まっていた不一致を修正した。右上・左上2目一度は横2マス、3目一度は横3マス、すべり目は縦2マスへ図形自体を拡張し、既に複数マスだった交差記号を含め、全記号の描画領域を占有領域と一致させた。画面・PNG・PDFへ共通して反映される。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 全ベクター記号の描画幅・高さがカタログ上の占有幅・高さと一致することを検証する回帰テストへ変更した。
- 検証: `npm run typecheck`、`npm test`（22件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。ローカル盤面で2目一度、3目一度、すべり目がそれぞれ2・3・2マスへ描画されることを画像確認した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 編み目記号を共通ベクター定義へ変更

- 影響: 25項目の記号を画面・PNG・PDFで共有するベクター定義へ置き換え、PDFの128px画像引き伸ばしを廃止した。既存データとの互換性を保つため、減目・すべり目を含む盤面上の占有マス数と永続IDは従来値を維持した。複数目の交差は扇状に広がらない平行な線束として、ねじり目交差は線が途切れない形として描き直した。パレットには規格名や区分を表示せず、記号名と占有目数だけを示す。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.ts`, `src/canvas/BoardCanvas.tsx`, `src/export/exporters.ts`, `src/export/pdf.worker.ts`, `src/App.tsx`, `src/styles.css`
- テスト: 永続ID、既存の盤面占有、記号の論理座標、全制御点が描画領域内にあること、SVG/PDFの有限なベクター出力、PDFから画像マスクがなくなったことを追加・更新した。
- 検証: `npm run typecheck`、`npm test`（22件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。ローカルの一覧ページで全25項目をパレット寸法と盤面実寸の双方で画像確認し、実際の記号パレットもデスクトップ幅で確認した。
- デプロイ影響: なし。ユーザー確認用のローカルプレビューのみ。承認後にデプロイする場合は、GitHub Actionsのテスト・デプロイ成功と本番の記号パレット、盤面、PNG/PDF出力を確認する必要がある。

## 2026-09-20 — 編み目記号の互換性・PDF白塗り・選択UIを改善

- 影響: 保存済み編み図で使う記号IDを明示的な永続値に変更し、バックアップへ記号カタログ版を記録するようにした。旧キー `purl_twisst_stitch` は互換名として読込みを維持する。「白くする」は消去とは別の記号として残し、PDFでもセルを白く塗ってグリッドを隠すよう修正した。従来の文字だけの選択欄を、記号画像・名称・占有目数を分類表示するパレットへ変更した。記号図形そのものは変更していない。
- 主なファイル: `src/stitches/catalog.ts`, `src/stitches/svgMarkup.js`, `src/App.tsx`, `src/styles.css`, `src/export/pdf.worker.ts`, `src/storage/database.ts`
- テスト: `src/stitches/catalog.test.ts` に永続ID、キー重複、全SVG、旧キー互換の検証を追加した。`src/export/pdf.worker.test.ts` にPDF白塗り命令、`src/storage/database.test.ts` にバックアップの記号カタログ版、`tests/e2e/editor.spec.ts` に記号パレット表示・選択・ID 25の保存を追加した。
- 検証: `npm run typecheck`、`npm test`（17件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を実行し、すべて成功。ChromiumとWebKitでモバイル390×844、デスクトップ1280×800のパレットを手動確認し、スクリーンショットを `/tmp/stitch-picker-{chromium,webkit}-{mobile,desktop}.png` に保存した。
- デプロイ影響: 2026-09-20にコミット `58250b2` までを `main` へデプロイした。GitHub Actions「Test and deploy Pages」run `35479673129` のテスト・ビルド・デプロイはすべて成功。本番 `https://knittingeditor.com/`（HTTP 200）で25記号のパレット表示、「白くする」のID 25での保存と再読込み、PDF生成、およびPDF内の白塗り命令を確認した。

## 2026-09-20 — SEOと使い方ページのブラウザテストを追加

- 影響: 実行時の動作は変更しない。`/` のメタデータ、構造化データ、JavaScript実行前の説明文、`/guide/` ページ、sitemapとfaviconの配信を自動検証するようにした。
- 主なファイル: `tests/e2e/seo.spec.ts`
- テスト: Playwrightに7件のテストを追加した。JavaScript実行前のHTML（`page.request.get('/')`）、title・canonical・OGP・Twitter Card・favicon、`WebSite` と `WebApplication` のJSON-LD、React描画後にフォールバックの `h1` が重複しないこと、ヘッダーの「使い方」からの遷移、`/guide/` への直接アクセスとそのメタデータ、sitemapとfaviconの配信を確認する。追加したテストはindex.htmlのtitleとフォールバックのリンクを削除し `public/guide/` を退避した状態で実際に失敗することを確認済み。
- 検証: `npm run typecheck`、`npm test`（13件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、36件）を実行し、すべて成功。
- デプロイ影響: なし。テストのみの追加で `dist/` の生成物は変わらない。

## 2026-09-20 — 検索流入向けのメタデータと使い方ページを追加

- 影響: トップページの `title` と description を検索意図に合わせ、Open Graph / Twitter Card と `WebSite`・`WebApplication` の構造化データを追加した。JavaScript実行前のHTMLに主要な説明とガイドへのリンクを含め、静的な使い方ページ `/guide/` とfaviconを追加し、エディタのヘッダーに「使い方」への導線を置いた。sitemapに `/guide/` を追加し、`check:dist` でSEO関連ファイルの存在も検査するようにした。エディタの機能と保存形式は変更していない。
- 主なファイル: `index.html`, `public/guide/index.html`, `public/favicon.svg`, `public/sitemap.xml`, `scripts/check-dist.mjs`, `src/App.tsx`, `src/styles.css`
- テスト: このコミット自体には自動テストを追加していない。レビューでSEO面とガイドページのブラウザ検証が不足していると指摘されたため、`tests/e2e/seo.spec.ts` を別コミットで追加した。
- 検証: PR #4 のCI（run `35453463106`）と、マージ後の `main`（コミット `8388cf49`、run `35476210888`）で `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e` がすべて成功した。ローカルでの個別実行は行っていない。
- デプロイ影響: 2026-09-20にコミット `8388cf49` を含む `main` をデプロイした。GitHub Actions「Test and deploy Pages」run `35476210888` のテスト・ビルド・デプロイはすべて成功。本番 `https://knittingeditor.com/` で新しい `title`、JSON-LD、JavaScript実行前の `h1` とガイドへのリンク、`/guide/` の直接表示（HTTP 200）、`/favicon.svg` の配信（`image/svg+xml`）、sitemapへの2URL掲載を確認した。ブラウザでヘッダーの「使い方」から `/guide/` へ遷移することも確認済み。Search Consoleでの `/guide/` のインデックス登録は後日確認する。

## 2026-09-19 — 編集から出力までの利用分析を追加

- 影響: GA4でエディタ準備、初回編集、機能パネル、編み目選択、新規作成、ブロック利用、PNG/PDF出力、バックアップ、処理失敗を分析できるようにした。編み図名・ファイル名・文書IDは送信せず、自動テストでは計測を無効化する。表示と操作手順は変更しない。
- 主なファイル: `src/analytics.ts`, `src/analytics.test.ts`, `src/main.tsx`, `src/App.tsx`
- GA4設定: Search Consoleを連携し、イベントデータ保持を14か月に変更した。8個のイベントスコープ カスタムディメンションを登録済み。`chart_exported` のキーイベント化は初回の本番イベント受信後に行う。
- テスト: `src/analytics.test.ts` に本番限定の初期化、重複防止、イベント送信、初回編集の一度だけの送信、低カーディナリティ区分のテストを追加した。
- 検証: `npm run typecheck`、`npm test`（13件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 2026-09-19にコミット `7e5ee7e` を含む `main` をデプロイした。GitHub Actions「Test and deploy Pages」run `35448658273` のテスト・ビルド・デプロイはすべて成功。本番 `https://knittingeditor.com/` で生成物 `index-D3vfZDcQ.js` の配信、エディタ起動、保存パネル表示、PNG保存操作に画面上のエラーがないことを確認した。自動操作は計測対象外のため、GA4のイベント受信と `chart_exported` のキーイベント化は通常利用者の初回イベント受信後に確認する。

## 2026-09-19 — 盤外からの無効な範囲選択を防止

- 影響: 行列ラベルなど盤外から範囲選択を開始しても、0行・0列の不正なブロックを作成しないようにした。盤内での範囲選択動作は変更しない。
- 主なファイル: `src/model/Board.ts`, `src/canvas/BoardCanvas.tsx`
- テスト: `src/model/Board.test.ts` に盤外選択の境界テストを追加した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に盤内の範囲選択とブロック作成を確認する必要がある。

## 2026-09-19 — 自動保存の競合を修正

- 影響: 保存処理中に追加された編集を未保存扱いに戻さず、別の編み図へ切り替えた後に古い保存結果で表示を戻さないようにした。
- 主なファイル: `src/App.tsx`
- テスト: `tests/e2e/editor.spec.ts` の永続化確認を実セル内容まで強化した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に編集・自動保存・再読込みを確認する必要がある。
