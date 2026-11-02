# 2026-11-03 — iOSアプリのInfo.plistにCFBundlePackageTypeを加える

- 影響: v1.0の提出用アーカイブ（`f921068`、Xcode 27.2、iOS 27.2 SDK）をApp Store Connectへアップロードしたところ、「Invalid Bundle OS Type code」で拒否された。`ios/App/Info.plist` に `CFBundlePackageType` が無く、アプリのInfo.plistにもこのキーが入っていなかったためである。App Store Connectは、この値が `APPL` のアプリしか受け付けない。Xcodeのアプリのテンプレートと同じく `$(PRODUCT_BUNDLE_PACKAGE_TYPE)` を指定し、ビルドで `APPL` になるようにした。Simulatorと実機への導入は、このキーが無くても動いていたため、これまで気づかなかった。あわせて、`ios/scripts/check-release-assets.sh` が `CFBundlePackageType` が `APPL` であることを確かめるようにし、CIの `release_archive` ジョブと提出前の検査で同じ欠けを見つけられるようにした。拒否されたアップロードは処理済みのビルドにならず、App Store Connectにビルドは登録されていない。
- 主なファイル: `ios/App/Info.plist`、`ios/scripts/check-release-assets.sh`
- テスト: `check-release-assets.sh` に `CFBundlePackageType` の検査を加えた。
- 検証（手元、Xcode 27.2）:
  - 直す前のアーカイブに `check-release-assets.sh` を実行し、`CFBundlePackageType must be APPL: <missing>` で失敗することを確かめた。
  - このブランチで `npm ci --ignore-scripts`、`xcodegen generate --spec ios/project.yml` のあと、有料のTeamのAutomatic署名でReleaseアーカイブを作り（成功）、`check-release-assets.sh`（成功）と、アプリのInfo.plistの `CFBundlePackageType` が `APPL` であることを確かめた。
  - CIの `release_archive` と同じ署名なしのReleaseアーカイブも作り（成功）、`check-release-assets.sh`（成功）。
  - `bash -n ios/scripts/check-release-assets.sh`（成功）、`ios/scripts/check-app-store-docs.sh`（成功）、`git diff --check`（成功）。
  - 手元ではUIテストを実行していない。PRのCIと、このブランチで手動実行するFull iOS validationで確かめる。
- デプロイ影響: Pagesは再配信されない。iOSでは、提出用ビルドをApp Store Connectへアップロードできるようになる。マージ後のmainで作ったアーカイブをアップロードし、受け付けられることを確かめる。
