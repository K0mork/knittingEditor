# Web・iOS共通基盤

このリポジトリは、GitHub Pagesで公開するWeb版と、`ios/`のSwiftUI・WKWebViewアプリを同じGit履歴で管理する。公開URL、Web版のルート配置、`public/CNAME`、`base: '/'`は変更しない。

## 共通コード

`packages/editor-core`は、Web版とiOS版が共有する盤面モデル、記号カタログとベクター記号、IndexedDBと`.knit`入出力、PNG/PDF出力、盤面Canvasコンポーネントを提供する。Web版の`src/`とアプリ版の`ios/Web/src/`にある同名ファイルは薄い再エクスポートだけを持ち、実装を複製しない。共通コードのテストもこのパッケージに置き、ルートの`npm test`が実行する。

`model/`はReactにもDOMにも依存させない。`export/`と`canvas/`はブラウザAPIを使うが、Web固有・iOS固有の分岐を持たない。共通化しないファイルとその理由は`ios/docs/WEB_SYNC.md`の表を正とする。

`packages/*`またはルートの依存・共通ビルド設定に変更がある場合は、WebとiOSの両方を検証する。Web固有コードはWeb検証、iOS固有コードはiOS検証を行う。IndexedDBのDB名、アプリの固定origin、`.knit`の形式・バージョン・カタログバージョン、永続記号IDは互換試験なしに変更しない。

## 実行環境の境界

- Web固有: SEO、CNAME、サイトマップ、分析、旧Safari `localStorage` 移行、ブラウザのダウンロード。
- iOS固有: `WKWebView`ブリッジ、Files・共有シート、Document Picker、scene phase、オフラインbundle検査。
- 生成物: Webの`dist/`とiOSの`ios/AppResources/Web/`。いずれもソースから生成し、Gitへ追加しない。

共通コードから環境固有の機能を呼ぶ必要がある場合は、`packages/editor-core/platform.ts`の`EditorPlatform`へ足して各ビルドのアダプタで実装する。現在の項目は生成ファイルの受け渡し（`saveFile`）だけで、Web版はダウンロード、iOS版は`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。呼び出し元のない項目を先に置かない。

分析、バックアップ読込み、保留保存のflushは共通コードからは呼ばれず、Web版とiOS版がそれぞれの`App.tsx`と`analytics.ts`で扱う。iOS版は分析をno-opにし、外部URL・通信APIをアプリbundleへ含めない。

## ビルドと公開

ルートの`package.json`と`package-lock.json`をworkspaceの唯一のNode依存定義とする。iOSの`ios/scripts/build-web.sh`はルート依存を使って`ios/Web`をビルドし、`ios/AppResources/Web/`へコピーする。

`.github/workflows/ci.yml`は変更範囲を判定し、Web・共通コード・iOSの検証を必要な範囲で実行する。Markdownはどちらのビルド入力でもないため重い検証を起こさず、App Store提出文書の検査は変更範囲によらず常に実行する`app_store_docs`が受け持つ。常に実行される`ci-gate`が、`app_store_docs`の結果、変更範囲判定そのものの失敗、必要なジョブのskip・失敗・キャンセルを検査する。範囲を判定できないときは判定側がWeb・iOSの両方をtrueにして通す。Webまたは共通コードの`main`更新では、関連テスト成功後にPages artifactをデプロイし、iOS専用更新では再公開しない。

本番公開後は、`CI and deploy Pages`の`web`と`deploy`、`https://knittingeditor.com/`のHTTPS応答、主要編集、PNG/PDF、`.knit`入出力を確認し、ルート`DEVELOPMENT_LOG.md`へ記録する。
