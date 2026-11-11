# 実機確認の標準手順

iOS版の版ごとに行う実機の確認の、時期と手順。提出・公開の操作は[提出・公開の手順](RELEASE_RUNBOOK.md)、v1.0の実機ゲートの記録と個別の測定手順（通信監視、1000×1000盤面など）は[実機リリースゲート](REAL_DEVICE_RELEASE_CHECKLIST.md)にある。

端末はiPhone 17とiPad Air 第5世代を使う。どちらも検証用の端末で、このアプリのデータは消してよい。

## 時期

| 時期 | いつ | 端末のアプリ | 確かめること | 手で行うこと |
|---|---|---|---|---|
| PR | PRごと | 変えない | CIだけ（ルートの`AGENTS.md`の「Change-specific Test Requirements」） | なし |
| [提出前](#提出前) | 提出するコミットを決めたあと、Archiveを作る前（[提出・公開の手順](RELEASE_RUNBOOK.md)の手順5の1） | そのコミットの開発ビルド | 実機のUIテスト、その版で直した`needs-device`のIssue | 端末をケーブルでつなぐ。Issueの確認項目 |
| [公開前](#公開前) | 審査に出したあと、公開の操作の前（手順8） | TestFlightの提出ビルド | 機内モードでの主な操作 | iPhoneで6つの操作 |
| [公開後](#公開後) | 公開され、ストアに反映されたあと（手順9） | App Storeの版 | 製品ページと版 | なし |

- 実機でUIテストを流せるのは開発ビルドだけで、開発ビルドは機内モードでは起動できない（[M0](REAL_DEVICE_RELEASE_CHECKLIST.md#m0-オフライン起動とweb-api-poc)）。このため、自動の確認は提出前に、機内モードの確認は公開前に手で行う。
- 開発ビルドに置き換えるのは提出前だけにする。公開前にTestFlightの版、公開後にApp Storeの版へ入れ替わる。
- 公開後に実機の確認が要るものは、次の版の提出前に行う。`needs-device`のIssueも、そのIssueを直した版の提出前に確かめる。

## 提出前

端末1台ずつ、iPhone 17、iPad Air 第5世代の順に行う。

1. 端末をケーブルでMacにつなぎ、ロックを解除する。「設定 > デベロッパ > UIオートメーション」をオンにしておく。
2. 提出するコミットで次を実行する。UDIDは`xcrun devicectl list devices`で調べる。Team IDは[実施前の固定情報](REAL_DEVICE_RELEASE_CHECKLIST.md#実施前の固定情報)のとおり、そのターミナルでだけ指定する。

   ```sh
   KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/run-device-ui-tests.sh <UDID>
   ```

   スクリプトはアプリを削除してから開発ビルドを入れ、[一覧](../UITests/device-ui-tests.txt)のUIテストを流す。終わるとアプリを削除して入れ直し、テストが作った編み図を消す。結果、画面写真（`attachments/`）、機種とOSの版（`device.txt`）は、最後に表示する出力先にある。
3. 判定する。
   - すべてのテストが成功している。再試行で成功したテストは、ルートの`AGENTS.md`の「Intermittent iOS test failures」に従って扱う。
   - 画面写真で、文字の切れや重なりがない。
4. その版で直した`needs-device`のIssueの確認項目を、入れ直したアプリで、各Issueの完了条件のとおりに行う。
5. 失敗や問題があれば提出しない。直したコミットで、提出前の確認をやり直す。

アップデートで編み図が残ることは、CIの`app_update`ジョブで確かめる。成功は手順5の1で確かめる。

## 公開前

iPhone 17だけで行う。オフラインで動くかどうかは端末の種類によらず、iPadの画面は提出前に確かめている。

1. TestFlightから提出ビルドを入れ、機内モードにする。
2. 次を順に行う。
   1. 起動する。
   2. 記号を置く。
   3. アプリを終了して起動し直し、記号が残っていることを確かめる。
   4. PNG・PDF・`.knit`を保存する。
   5. `.knit`から復元する。
   6. 「使い方」を開いて戻る。
3. どれかができなければ公開しない。[提出・公開の手順](RELEASE_RUNBOOK.md)の手順8の3のとおり、直した新しいビルドでやり直す。

## 公開後

端末では確かめない。App Storeで配られるのは公開前に確かめたのと同じビルドである。ストアに反映されたら、次を確かめる。

- 日本の製品ページで、版、「このバージョンの新機能」の文、アクセシビリティの表示が登録どおりである。
- App Storeの検索API（`https://itunes.apple.com/lookup?bundleId=com.k0mork.knittingEditor&country=jp`）が返す版が、公開した版である。

## 記録

- 版ごとに記録のPRを1つ作る。提出前の結果で作り、公開前・公開後の結果を書き足して、公開後の確認のあとでマージする。
- [リリース確認の記録](RELEASE_VERIFICATION_RECORDS.md)に版の節を作り、時期ごとに、日付、ビルド（提出前はコミット、公開前・公開後は版とビルド番号）、端末とOSの版、結果、問題を書く。同じ内容を、そのPRの`docs/dev-log/`の記録にも書く。
- 提出前に確かめた`needs-device`のIssueは、このPRの本文に`Closes #番号`を書いて閉じる。

## UIテストの一覧

[`ios/UITests/device-ui-tests.txt`](../UITests/device-ui-tests.txt)には、Simulatorと実機で結果が変わりうるテスト（システムの画面、保存、回転、キーボード、文字サイズ）を1行に1つ書く。書式はPRスモークの一覧と同じ。テストの名前を変えたり消したりしたときは一覧も直す。`node scripts/check-pr-smoke-ui-tests.mjs`が両方の一覧を検査し、CIの`app_store_docs`ジョブでも流れる。
