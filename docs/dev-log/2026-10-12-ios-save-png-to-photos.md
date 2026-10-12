# 2026-10-12 — iOSのPNG共有から写真へ保存できるようにする

- 影響: Refs #208（実機での確認後に閉じる）。PNGの共有シートに「画像を保存」が出るよう、写真への追加専用の権限説明（`NSPhotoLibraryAddUsageDescription`、「編み図の画像を写真に保存するために使います。」）を設定した。写真の読み取り権限は求めない。PNGのファイルURLを渡す既存の共有と「ファイルに保存」は変えていない。
- 主なファイル: `ios/App/Info.plist`、`ios/Tests/KnittingEditorAppTests/PhotoLibraryPermissionTests.swift`、`ios/knittingEditor.xcodeproj/project.pbxproj`（XcodeGenによるテストの登録）。`ios/project.yml`は既存のplistを参照するだけなので変えていない。
- テスト: Swift単体テスト`PhotoLibraryPermissionTests`（2件）で、アプリの追加権限の説明文と、読み取り権限の説明がないことを確かめる。
- 検証（Node v24.21.0）:
  - `npm run typecheck`、`npm test`（45ファイル・437件）、`npm run build`、`npm run check:dist`、`plutil -lint ios/App/Info.plist`、`git diff --check`: 成功。
  - `xcodegen generate --spec ios/project.yml`: 成功。生成した`project.pbxproj`はコミットしたものと同じ。
  - iPhone 16（iOS 26.5）のSimulatorで`PhotoLibraryPermissionTests`と既存の`KnittingEditorUTTypeTests`（計6件）: 成功。ビルドしたアプリのInfo.plistに説明文が入り、読み取り権限は入っていないことを確かめた。
  - 同じSimulatorで、一時的なUIテスト（実行後に削除）により、「保存」→「PNGを保存」→「共有」の共有シートに「画像を保存」が出ること、押すと追加専用の権限画面に上の説明文が出ること、「許可」で写真ライブラリにPNGが保存されて盤面の内容が合っていること、「許可しない」でもアプリが落ちないことを確かめた。
  - 既存のUIテストのうち、PNG・PDFが「ファイルに保存」まで届くものと、共有シートを閉じて編集画面へ戻るもの（2件）: 成功。
  - `npm run test:e2e`（chromium-mobile、webkit-mobile、chromium-desktop）: 264件成功、6件スキップ、失敗0件。
  - PRのCIに任せたもの: iPadのSimulatorテスト、app-update、unsigned Release Archive、オフライン同梱物の検査。
  - 実機で残る確認: 初回の権限画面、許可後の写真への保存、拒否したときの動き、拒否後の「ファイルに保存」、iPadのポップオーバー。
- デプロイ影響: Pagesはなし。次のアプリのビルドに権限の説明が入る。配布後に実機で写真への保存と「ファイルに保存」を確かめる。
