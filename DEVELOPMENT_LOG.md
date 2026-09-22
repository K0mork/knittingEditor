# Development Log

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
- 根拠: 2026-09-20〜21にSearch Consoleでは検索クリック3件を記録した一方、GA4は同期間0件で、データストリームにも過去48時間の受信なしと表示された。測定ID `G-VVE0G4ZFL4` はストリーム設定と一致している。
- テスト: キュー内容が通常の配列ではなく `arguments` オブジェクトであり、初期化とカスタムイベントの各コマンドを正しく保持することを検証するよう更新した。
- 検証: コミット単体のクリーンな作業ツリーで `npm ci`、`npm run typecheck`、`npm test`（5ファイル・27件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、42件）を順に実行し、すべて成功。
- デプロイ影響: 2026-09-22にコミット `fc83db1` を `main` へデプロイした。GitHub Actions「Test and deploy Pages」run `35686163773` のテスト・ビルド・デプロイはすべて成功。本番でJS `index-Uchg1IUt.js` とGoogleタグ `G-VVE0G4ZFL4` の読込み、画面上のエラーがないことを確認し、GA4リアルタイムでアクティブユーザー1、`page_view`、`session_start`、`first_visit`、`editor_ready` を各1件受信した。`first_edit` と `chart_exported` は実利用時の受信後に確認する。

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
