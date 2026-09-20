# Web版同期記録

## 初期同期

- 参照元: `/Users/komorikouki/git/knittingEditor`
- 固定コミット: `8d3385799f61526334fd33c0a9e7be115f084afd`
- 記号カタログ: `STITCH_CATALOG_VERSION = 3`
- 同期方法: `scripts/sync-web-source.sh`
- ビルド方法: `scripts/build-web.sh`
- 出力先: `AppResources/Web/`（生成物のためGit管理しない）

同期スクリプトは、参照元が固定コミットかつcleanな場合だけ実行できます。参照元のWebリポジトリは読み取り専用で扱い、アプリ側の`Web/`へコピーした後にアプリ専用の差分を適用します。

## アプリ専用差分

- `src/main.tsx`: Google Analytics初期化を呼び出さない。
- `src/analytics.ts`: API互換のno-opとし、イベントも外部スクリプトも発生させない。
- `src/storage/database.ts`: Safariの`localStorage`旧版移行関数を削除する。IndexedDBと`.knit`入出力は維持する。
- `src/storage/database.test.ts`: Safari旧版移行テストを除外し、`.knit`復元テストを維持する。
- `index.html`、使い方ページ: SEO、CNAME、サイトマップ、外部プライバシーURLを除外し、アプリ内の同梱ページとして動作させる。

Web版が更新された場合は、先に新しい同期元コミット、カタログバージョン、既存IDの不変性を確認し、`catalog.ts`と`glyphs.ts`を同じ同期単位で取り込むこと。同期後は上記のアプリ専用差分を再適用し、Web単体テストとオフライン資産検査を実行する。

## 永続記号IDスナップショット

カタログの配列順ではなく、次のIDを`.knit`互換の永続値として扱う。

| ID | key |
|---:|---|
| 1 | `knit` |
| 2 | `purl` |
| 3 | `yo` |
| 4 | `right_up_two_one` |
| 5 | `left_up_two_one` |
| 6 | `purl_left_up_two_one` |
| 7 | `right_cross` |
| 8 | `left_cross` |
| 9 | `purl_right_cross` |
| 10 | `purl_left_cross` |
| 11 | `purl_right_up_two_cross` |
| 12 | `purl_left_up_two_cross` |
| 13 | `purl_right_cross_twist_stitch` |
| 14 | `purl_left_cross_twist_stitch` |
| 15 | `middle_up_three_one` |
| 16 | `right_up_three_one` |
| 17 | `left_up_three_one` |
| 18 | `right_up_two_cross` |
| 19 | `left_up_two_cross` |
| 20 | `right_up_three_cross` |
| 21 | `left_up_three_cross` |
| 22 | `slip_stitch` |
| 23 | `twist_stitch` |
| 24 | `purl_twist_stitch` |
| 25 | `erase` |
| 26 | `purl_right_up_two_one` |
