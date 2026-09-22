# Web資産と共通コード

Web版とiOS版は同じリポジトリで管理する。以前の固定コミット参照と`rsync --delete`によるコピー同期は廃止し、共通コードはルートの`packages/editor-core`から両方のビルドへ解決する。

## iOS用Web bundle

`ios/scripts/build-web.sh`は、ルートの`package-lock.json`で依存関係を導入し、`ios/Web`をルートworkspaceのVite・TypeScriptでビルドする。生成物は`ios/AppResources/Web/`に置くが、生成物自体はGit管理しない。Xcodeのpre-build scriptも同じスクリプトを呼び出す。

## 固有差分

- Web版はSEO、CNAME、サイトマップ、分析、ブラウザのダウンロード、旧Safari `localStorage` 移行を持つ。
- iOS版は分析をno-opにし、旧Safari移行を含めず、`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。
- 盤面、Canvas、記号、PNG/PDF、IndexedDBのデータ形式、`.knit`入出力は共通実装・共通fixtureで検証する。

## 同期ではなく同時検証

`packages/*`または保存形式を変更したPRでは、Webのtypecheck・Vitest・Vite・Playwrightに加え、iOS Web単体テスト、Swift/XCUITest、更新復元、Release Archive、オフラインbundle検査を実行する。Web版で生成した`.knit`をiOS版で読み込み、iOS側のブリッジ出力をWeb版で読み込む双方向試験を維持する。

永続記号ID 1〜26、`STITCH_CATALOG_VERSION`、IndexedDBのDB名、アプリの固定originは、既存fixtureとの互換性を確認せずに変更しない。
