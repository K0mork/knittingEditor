# 2026-10-06 — iOS系のCIジョブを速くする

- 影響: iOSを含む変更のCIは、macOSランナーの空き待ち、`brew install xcodegen`、テスト後の再ビルドに時間を取られていた。検証の範囲はそのままにして、次の3点を変えた。
  - XcodeGenを、Homebrewではなくリリースのzipから入れる。版（2.46.0）とSHA-256を固定して確かめる。`ios`の2ジョブでは`brew install`に3分近くかかっていた。
  - `ios_web`を`macos-26`から`ubuntu-latest`へ移した。中身は型検査とVitestだけで、XcodeもSimulatorも使わない。macOSランナーは同時に動かせる数が少なく、このジョブが1つ使うと、Simulatorを使うジョブが空きを待っていた。
  - `ios`ジョブの`Verify generated app bundle`でビルドし直すのをやめた。テストのビルド先を`-derivedDataPath`で固定し、そのDebugのアプリを`check-app-bundle.sh`で検査する。
  - `main`へのpushでiOS系を省く案は見送った。`main`のrulesetは、PRが最新の`main`に追いついていることを求めていない（`strict_required_status_checks_policy: false`）。そのため、組み合わせた状態は`main`での実行でしか検証されない。
- 主なファイル: `.github/workflows/ci.yml`、`ios/scripts/install-xcodegen.sh`
- テスト: 追加したテストはない。ワークフローの変更なので、このPRのCIでWeb系とiOS系の全ジョブが動く。
- 検証:
  - `ios/scripts/install-xcodegen.sh`を手元で実行し、SHA-256の照合と`xcodegen --version`（2.46.0）が通ることを確かめた。そのXcodeGenで`xcodegen generate --spec ios/project.yml`を実行し、リポジトリの`ios/knittingEditor.xcodeproj`と差分が出ないことを確かめた。
  - `xcodebuild build-for-testing -destination 'generic/platform=iOS Simulator' -derivedDataPath <dir> CODE_SIGNING_ALLOWED=NO`の後、`<dir>/Build/Products/Debug-iphonesimulator/knittingEditor.app`に対して`ios/scripts/check-app-bundle.sh`が通ることを確かめた。手元のXcodeは27.0で、CIの26.6とは異なる。
  - iOS Webの`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`が通った。
  - Rubyの`YAML.load_file`でワークフローを読み込めることを確かめた。`actionlint`と`shellcheck`は手元に無く、実行していない。
  - Webの検査一式（`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`）は、Webのソースを変えていないため手元では実行せず、PRのCIの`web`ジョブに任せた。Simulatorのテスト、アプリ更新テスト、Release ArchiveもPRのCIに任せた。
- デプロイ影響: ワークフローの変更なので、マージ後の`main`のrunでPagesへの配信も走る。ただし配信する成果物の中身は変わらない。そのrunで、`deploy`と`smoke`を含む全ジョブの成功と所要時間を確かめる。
