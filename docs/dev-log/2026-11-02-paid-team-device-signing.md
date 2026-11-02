# 2026-11-02 — 有料のTeamで署名したビルドをiPhone・iPadへ入れ、確認を記録する

- 影響: Apple Developer Programへの個人での加入が有効になり、Automatic署名が有料のTeamで解決するようになった（#17）。アプリのコードと署名の設定（`ios/project.yml`）は変えていない。Team IDはリポジトリに書いていない。
  - `main`の`c502259`をDebugでビルドし、有線のiPhone 17（iOS 27.2）とiPad Air 第5世代（iPadOS 27.2）へ上書きで入れた。Provisioning Profileの失効日は作成から1年で（無料Personal Teamは7日）、両端末が入っていた。開発元を信頼する操作なしで起動し、アプリを終了して起動し直しても、前の編み図がそのまま表示された。端末内IndexedDBの編み図の件数は、入れる前と後で変わらなかった。
  - 機内モードの自動テスト`testAirplaneModeServesEditorWithoutNetwork`は、有料のTeamでも実機で流せなかった。`xcodebuild test`が入れ直したアプリは、起動の前にiOSがオンラインで開発元を確かめるため、機内モードでは`profile has not been explicitly trusted by the user`で起動が拒否される。直前にオンラインで起動していても同じだった。提出ビルドの機内モードの確認は、TestFlightのビルドで手で行う（#25）。
  - 実機リリースゲートのM0の前提を「有料のTeamでも同じ」に直し、提出チェックリストの署名の項目にチェックを入れた。
- 主なファイル: `ios/docs/RELEASE_VERIFICATION_RECORDS.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/docs/APP_STORE_CHECKLIST.md`
- テスト: 追加・更新していない。
- 検証:
  - `KNITTING_EDITOR_DEVELOPMENT_TEAM=<TeamID> KNITTING_EDITOR_REQUIRE_WIRED=1 ios/scripts/check-device-readiness.sh`：両端末が`transport=wired`で通過した。
  - `xcodebuild build -destination 'id=<iPhone>' -destination 'id=<iPad>' -allowProvisioningUpdates -allowProvisioningDeviceRegistration DEVELOPMENT_TEAM=<TeamID>`：成功した。`devicectl device install app`と`devicectl device process launch`で入れて起動し、`devicectl device capture screenshot`で編集画面を確かめた。データは`devicectl device copy from`で写して数えた。
  - オンラインで`xcodebuild test -only-testing:knittingEditorTests/LocalWebSchemeHandlerTests/testAirplaneModeServesEditorWithoutNetwork`を両端末で流した：環境変数なしのためスキップされ、`TEST SUCCEEDED`。
  - 機内モード（Wi-Fiも切った）のiPhoneで、`TEST_RUNNER_KNITTING_EDITOR_AIRPLANE_MODE=1`を付けて同じテストを流した：起動が拒否されて失敗した。iPadでは流していない（同じ理由で起動できないため）。
  - `ios/scripts/check-app-store-docs.sh`：`App Store documents are structurally valid`で成功した。`git diff --check`も成功した。
  - 文書だけの変更のため、Webの検査一式とSimulatorのテストは手元では流していない。
- デプロイ影響: なし（文書だけの変更）。TestFlight・App Storeへの影響もない。
