# Web・iOS共通基盤

このリポジトリは、GitHub Pagesで公開するWeb版と、`ios/`のSwiftUI・WKWebViewアプリを同じGit履歴で管理する。公開URL、Web版のルート配置、`public/CNAME`、`base: '/'`は変更しない。

## 共通コード

`packages/editor-core`はプラットフォームに依存しない盤面・記号カタログを提供する。Web版の`src/model/Board.ts`、`src/stitches/catalog.ts`、`src/stitches/glyphs.ts`と、アプリ版の`ios/Web/src/`にある同名ファイルは薄い再エクスポートだけを持ち、実装を複製しない。

`packages/*`、ルートの保存形式・ビルド設定、Web固有コードに変更がある場合は、WebとiOSの両方を検証する。IndexedDBのDB名、アプリの固定origin、`.knit`の形式・バージョン・カタログバージョン、永続記号IDは変更しない。

## 実行環境の境界

- Web固有: SEO、CNAME、サイトマップ、分析、旧Safari `localStorage` 移行、ブラウザのダウンロード。
- iOS固有: `WKWebView`ブリッジ、Files・共有シート、Document Picker、scene phase、オフラインbundle検査。
- 生成物: Webの`dist/`とiOSの`ios/AppResources/Web/`。いずれもソースから生成し、Gitへ追加しない。

共通UIが環境固有機能を直接参照しないよう、保存、バックアップ読込み、分析、保留保存のflushはプラットフォームアダプタ経由で接続する。iOSアダプタは分析をno-opにし、外部URL・通信APIをアプリbundleへ含めない。

## ビルドと公開

ルートの`package.json`と`package-lock.json`をworkspaceの唯一のNode依存定義とする。iOSの`ios/scripts/build-web.sh`はルート依存を使って`ios/Web`をビルドし、`ios/AppResources/Web/`へコピーする。

`.github/workflows/ci.yml`は変更範囲を判定し、Web・共通コード・iOSの検証を必要な範囲で実行する。常に実行される`ci-gate`が必要なジョブのskip・失敗・キャンセルを検査する。Webまたは共通コードの`main`更新では、関連テスト成功後にPages artifactをデプロイし、iOS専用更新では再公開しない。

本番公開後は、Pagesの`test-build`と`deploy`、`https://knittingeditor.com/`のHTTPS応答、主要編集、PNG/PDF、`.knit`入出力を確認し、ルート`DEVELOPMENT_LOG.md`へ記録する。
