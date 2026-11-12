# GA4での分析手順

Web版の製品計測（[ANALYTICS.md](ANALYTICS.md)）をGA4で読むときの手順である。イベントとパラメータの定義、値の区分、制作量の定義はANALYTICS.mdを正とし、この文書はそれをどの道具で、どの順に、どう読むかを書く。iOS版は計測しないため、GA4の値はすべてWeb本番版のものである。

分析は原則としてGA4の公式MCPサーバー（[googleanalytics/google-analytics-mcp](https://github.com/googleanalytics/google-analytics-mcp)、パッケージ名`analytics-mcp`）を通して行う。GA4の画面操作は、MCPでできない探索の共有やカスタム定義の登録などに限る。

## 公開してはならないもの

このリポジトリとGitHub上のIssue・PR・コメントは公開されている（`AGENTS.md`の「Confidential Information」）。MCPで取得した結果も同じ扱いにする。

- 件数、率、利用者数などの実測値、レポートの出力、スクリーンショットを公開の場所に書かない。「受信を確認した」「`(not set)`は仕様どおりの組み合わせだけだった」のような定性的な記述にする。
- GA4のアカウントID・プロパティID、GCPプロジェクトID、サービスアカウントのメールアドレス、鍵ファイルの中身を書かない。MCPの設定値は`private/GA4_MCP.md`に置く。
- 数値を残す必要があるときは、ルートの`private/`に書き、公開の文書からはファイルの場所だけで参照する。

## MCPの準備

### 構成

| 項目 | 内容 |
|---|---|
| サーバー | `pipx run analytics-mcp --allow-write`（stdio）。Claude Codeのユーザースコープに登録し、リポジトリの`.mcp.json`には置かない |
| 認証 | GCPプロジェクトのサービスアカウントの鍵（JSON）。環境変数`GOOGLE_APPLICATION_CREDENTIALS`で鍵の場所、`GOOGLE_CLOUD_PROJECT`でGCPプロジェクトを渡す |
| API | GCPプロジェクトで「Google Analytics Admin API」と「Google Analytics Data API」を有効にする |
| GA4側の権限 | サービスアカウントのメールアドレスを、GA4の「プロパティのアクセス管理」に追加する。読むだけなら「閲覧者」、注釈を作るなら「編集者」 |
| 実際の値 | `private/GA4_MCP.md`（GCPプロジェクト、サービスアカウント、鍵の場所、登録コマンド） |

サービスアカウントにはGCPプロジェクトのIAMロールを付けない。鍵で触れる範囲を、追加したGA4プロパティだけにするためである。利用者のGoogleアカウントで作るApplication Default Credentialsは使わない。自前のOAuthクライアントが必要なうえ、テスト中のOAuthアプリでは7日でログインが切れ、トークンに`cloud-platform`の権限も付くためである。

### 新しい端末で使えるようにする

1. `pipx`を入れる。`gcloud`はGCPプロジェクトやサービスアカウントを作り直すときだけ必要である。
2. `private/GA4_MCP.md`にある既存のサービスアカウントで新しい鍵を作るか、別の端末から鍵を安全に移す。鍵はリポジトリの外に置き、権限を`600`にする。鍵をコミット、チャット、Issueに貼らない。
3. Claude Codeに登録する。値は`private/GA4_MCP.md`を見る。

   ```sh
   claude mcp add analytics-mcp --scope user \
     -e GOOGLE_APPLICATION_CREDENTIALS=<鍵ファイルの絶対パス> \
     -e GOOGLE_CLOUD_PROJECT=<GCPプロジェクトID> \
     -- pipx run analytics-mcp --allow-write
   ```

4. `claude mcp list`で`analytics-mcp`が「Connected」になることを確かめる。MCPのツールは、登録後に始めたセッションから使える。
5. `get_account_summaries`を呼び、`knittingeditor.com`のプロパティが見えることを確かめる。見えなければ、GA4の「プロパティのアクセス管理」にサービスアカウントが入っているかを確かめる。作った直後のサービスアカウントは、GA4の追加画面で「Googleアカウントと一致しません」と出ることがある。30秒ほど待って入れ直すと通る。

鍵が漏れた疑いがあるときは、GCPコンソールの「IAMと管理」→「サービスアカウント」で該当の鍵を削除し、新しい鍵を作る。

### ツール

| ツール | 用途 |
|---|---|
| `get_account_summaries` | 見えるアカウントとプロパティの一覧。プロパティIDはここで調べ、文書には書かない |
| `get_property_details` | タイムゾーン、通貨、作成日など。日付の境界を考えるときにタイムゾーンを確かめる |
| `get_custom_dimensions_and_metrics` | 登録済みのカスタムディメンション。下の「カスタムディメンション」と食い違っていないかを確かめる |
| `run_report` | 集計レポート（Data APIの`runReport`）。分析の大半はこれで行う |
| `run_realtime_report` | 直近30分のリアルタイムレポート。リリース直後の受信確認に使う |
| `run_funnel_report` | イベントを順に並べたファネル。同じ利用者がどこまで進んだかを見る |
| `run_conversions_report` | 広告とキーイベントのアトリビューション。この製品は広告を使っていないので通常は使わない |
| `list_property_annotations` | 注釈の一覧。リリースや計測変更の日を確かめる |
| `create_property_annotation` | 注釈を作る（`--allow-write`が必要）。下の「注釈」の場合だけ使う |
| `list_google_ads_links` | Google広告とのリンク。通常は使わない |

`run_report`の引数はsnake_caseで渡す（`date_ranges`、`dimension_filter`など）。ディメンションと指標の名前はData APIのAPI名（`eventName`、`eventCount`など）で、カスタムディメンションは`customEvent:<パラメータ名>`と書く。

```json
{
  "date_ranges": [{"start_date": "28daysAgo", "end_date": "yesterday"}],
  "dimensions": [{"name": "eventName"}, {"name": "customEvent:export_format"}],
  "metrics": [{"name": "eventCount"}],
  "dimension_filter": {"filter": {"field_name": "eventName", "string_filter": {"value": "chart_exported"}}}
}
```

当日は処理が終わっていないので、期間の終わりは通常`yesterday`にする。

## 分析できる項目

### 製品イベント

送るタイミング、パラメータ、値はANALYTICS.mdの「イベント」と「値の区分」に従う。

| 観点 | イベント |
|---|---|
| 利用開始 | `editor_ready`、`first_edit`、`chart_created` |
| 機能の利用 | `feature_opened`、`stitch_selected`、`block_saved`、`block_pasted` |
| 出力とバックアップ | `chart_exported`、`backup_exported`、`backup_restored` |
| 制作の進み方と継続 | `chart_progress`、`chart_resumed`、`chart_progress_exported` |
| 失敗 | `save_failed`、`operation_failed` |

GA4が自動で集める`page_view`、`session_start`、`first_visit`、`user_engagement`、`scroll`なども使えるが、製品イベントとは分けて読む。

### カスタムディメンション

製品イベントのパラメータは、すべてイベント範囲のカスタムディメンションとして登録してある。API名は`customEvent:`の後にパラメータ名を付ける。

| API名 | 主に付くイベント | 分かること |
|---|---|---|
| `customEvent:app_build` | すべての製品イベント | 公開版の短いコミット識別子。リリースの前後を比べる |
| `customEvent:document_count_bucket` | `editor_ready`、`backup_restored` | 端末内の編み図の数の区分 |
| `customEvent:feature_name` | `feature_opened` | 開いたパネル（`documents`、`grid`、`blocks`、`export`） |
| `customEvent:stitch_key` | `stitch_selected` | 選んだ記号 |
| `customEvent:board_size_bucket` | `block_saved`、`chart_exported`、`chart_progress` | 盤面の大きさの区分 |
| `customEvent:export_format` | `chart_exported`、`chart_progress_exported` | `png`か`pdf` |
| `customEvent:pdf_layout` | `chart_exported`（PDFのみ） | `single`か`tiled` |
| `customEvent:export_state` | `chart_exported` | 未編集、前回と同じ、初めての編集後、前回の出力後に編集、の区別 |
| `customEvent:backup_scope` | `backup_exported` | 現在の編み図か全部か |
| `customEvent:save_trigger` | `save_failed` | 自動保存、手動、バックグラウンド |
| `customEvent:operation_name` | `operation_failed` | 失敗した操作 |
| `customEvent:failure_reason` | `save_failed`、`operation_failed` | 失敗の理由の区分 |
| `customEvent:progress_threshold` | `chart_progress`、`chart_progress_exported` | 到達した作成量の閾値 |
| `customEvent:progress_bucket` | `chart_resumed`、`chart_exported` | その時点の作成量の区分 |
| `customEvent:chart_origin` | `chart_progress`、`chart_resumed`、`chart_exported` | 新規、既存、復元、複製 |
| `customEvent:edit_days_bucket` | `chart_progress`、`chart_resumed` | 編集した日数の区分 |
| `customEvent:gap_days_bucket` | `chart_resumed` | 前回の編集日からの日数の区分 |
| `customEvent:active_minutes_bucket` | `chart_progress` | 操作時間の区分 |
| `customEvent:touched_cells_bucket` | `chart_progress` | 値が変わったマス数の区分（上限側の参考値） |
| `customEvent:cohort_week` | `chart_progress`、`chart_progress_exported` | 閾値に到達した週（端末のローカル日付のISO週） |
| `customEvent:export_lag_bucket` | `chart_progress_exported` | 到達から出力までの日数の区分 |

あるパラメータを送らないイベントでは、そのディメンションは`(not set)`になる。仕様どおりの`(not set)`と、送るはずのイベントでの`(not set)`を区別する。カスタムディメンションは登録した時点より前のデータには付かない。

### 標準のディメンションと指標

| 種類 | 主なAPI名 |
|---|---|
| 時間 | `date`、`week`、`yearWeek`、`month`、`dayOfWeek`、`hour` |
| 端末と環境 | `deviceCategory`、`operatingSystem`、`browser`、`screenResolution`、`language` |
| 地域 | `country`、`region`、`city` |
| 流入 | `sessionSource`、`sessionMedium`、`sessionDefaultChannelGroup`、`firstUserSource`、`landingPage` |
| 利用者 | `newVsReturning`、`firstSessionDate` |
| ページ | `pagePath`、`pageTitle`（編集画面と静的なページで計測する） |
| 指標 | `eventCount`、`eventCountPerUser`、`activeUsers`、`totalUsers`、`newUsers`、`sessions`、`engagedSessions`、`engagementRate`、`userEngagementDuration`、`screenPageViews` |

使えるディメンションと指標の全体は、Data APIの[API Dimensions & Metrics](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)にある。リアルタイムレポートで使えるものは、それより少ない。

### 分からないこと

- 正確なマス数、制作時間、出力までの日数。区分だけを送っているためである。
- 端末やブラウザをまたいだ同じ編み図の追跡、作品の完成率、端末への保存の成否、計測を入れる前の制作量（ANALYTICS.mdの「指標の読み方」）。
- iOS版の利用。
- 開発ビルド、自動テスト、`Claude/`を含むアプリ内ブラウザ、オプトアウトした端末の操作。送らないためである。
- 利用者を個人として特定する情報。編み図ID、名前、座標、ハッシュは送っていない。

## 定型の分析

どの分析も、まずMCPで次の2つを確かめてから始める。

1. `get_custom_dimensions_and_metrics`で、使うディメンションが登録されている。
2. `list_property_annotations`で、期間中のリリースや計測変更の日。変更をまたぐ期間は、`app_build`で分けるか期間を区切る。

### リリース直後の受信確認

1. `run_realtime_report`で、ディメンション`eventName`、指標`eventCount`を見る。直近30分に操作がなければ何も出ないので、受信の確認はANALYTICS.mdの「受信の確認」の手順で操作してから行う。
2. 翌日以降に`run_report`で、`eventName`と`customEvent:app_build`ごとの`eventCount`を見る。新しい`app_build`のイベントが届いていることを確かめる。
3. 新しく追加したパラメータは、`eventName`とそのディメンションを並べ、送るはずのイベントで`(not set)`がないことを確かめる。

### 失敗の監視

1. `run_report`で、`eventName`が`save_failed`か`operation_failed`のものを、`customEvent:failure_reason`、`customEvent:operation_name`、`customEvent:save_trigger`、`customEvent:app_build`ごとに見る。
2. 特定の`app_build`から増えた理由があれば、`browser`、`operatingSystem`、`deviceCategory`を足して、環境に偏りがあるかを見る。
3. 調べた結果をIssueに書くときは、増えた理由と環境を定性的に書き、件数は書かない。

### 機能の使われ方

- パネル：`feature_opened`を`customEvent:feature_name`ごとに見る。
- 記号：`stitch_selected`を`customEvent:stitch_key`ごとに見る。
- ブロック：`block_saved`と`block_pasted`を比べ、`block_saved`は`customEvent:board_size_bucket`で分ける。
- 端末の違い：上のどれかに`deviceCategory`を足す。

イベント数は操作の回数であり、利用者数ではない。利用者単位で見るときは指標を`totalUsers`か`activeUsers`にする。

### 出力

1. `chart_exported`を`customEvent:export_format`、`customEvent:pdf_layout`、`customEvent:board_size_bucket`ごとに見る。
2. `customEvent:export_state`で、未編集のまま出力したもの（`unedited`）と、編集後の出力を分ける。
3. `customEvent:progress_bucket`と`customEvent:chart_origin`で、どの程度作ってから出力したかを見る。

`chart_exported`は保存・共有をブラウザへ求めた段階で、保存の完了を表さない（ANALYTICS.mdの「出力状態と出力イベントの意味」）。

### 制作の進み方と出力率

閾値Tに到達週Wで到達した編み図のうち、一定の期間内に出力されたものの割合である。定義、観測不足の週の除き方はANALYTICS.mdの「指標の読み方」に従う。

1. 分母：`run_report`で、`eventName`が`chart_progress`のものを、`customEvent:cohort_week`と`customEvent:progress_threshold`ごとに`eventCount`で数える。
2. 分子：同じ期間で`eventName`が`chart_progress_exported`のものを、`customEvent:cohort_week`、`customEvent:progress_threshold`、`customEvent:export_lag_bucket`ごとに数える。7日の窓なら`export_lag_bucket`の`0`と`1-6`を足す。
3. 同じT・Wの分子を分母で割る。到達週の終わりから観測の終わりまでが窓の長さに足りない週は除く。
4. 計算は手元で行い、結果は`private/`に置く。

指標を`totalUsers`にしない。これは利用者ではなく、端末内の編み図ごと、閾値ごとの件数である。

### 継続制作

- `chart_resumed`を`customEvent:gap_days_bucket`と`customEvent:edit_days_bucket`ごとに見る。前回からどのくらい空けて戻ってきたか、何日目の編集かが分かる。
- `customEvent:progress_bucket`を足すと、どの程度作った編み図に戻ってきたかが分かる。
- 到達時の`customEvent:active_minutes_bucket`、`customEvent:touched_cells_bucket`は、`chart_progress`で閾値ごとに見る。

### 利用者の流れ

`run_funnel_report`で、`editor_ready`、`first_edit`、`chart_progress`、`chart_exported`のようにイベントを順に並べると、同じ利用者がどこまで進んだかが分かる。`funnel_breakdown`に`deviceCategory`を指定すると端末別に分けられる。ファネルは利用者単位の集計で、上の編み図単位の出力率とは別の表にする。

### 流入と環境

`activeUsers`や`sessions`を、`sessionDefaultChannelGroup`、`sessionSource`、`landingPage`、`country`、`deviceCategory`ごとに見る。GA4のタグは、編集画面（`src/analytics.ts`）と、`/guide/`・`/templates/`・`/stitches/`・`/chart-basics/`・`/support/`・`/privacy/`の静的なページ（`public/analytics.js`）で読み込む。`landingPage`を見ると、検索などから静的なページに着地した人の流れも分かる。静的なページからは`link_clicked`（`link_name`）だけを送る。

### UTMの付け方

SNSや記事から来た人を、GA4の流入レポートで見分けられるように、外部に貼るURLへUTMを付ける。

| パラメータ | 値 | 例 |
|---|---|---|
| `utm_source` | リンクを置いた場所。小文字の英数字とハイフン | `x`、`instagram`、`note`、`youtube` |
| `utm_medium` | リンクの種類 | `social`、`referral`、`email` |
| `utm_campaign` | 何のためのリンクかが分かる短い名前 | `templates`、`guide` |
| `utm_content` | 同じ場所で複数のリンクを比べるときだけ | `profile`、`post` |

- サイト内のリンクには付けない。付けると1回の訪問が別のセッションに分かれる。
- 付けるのは`https://knittingeditor.com/`から始まるURLだけにする。
- App Storeの製品ページのURLは変えない。参照元はApp Store Connectの集計で別に見る。
- 付けたURLと、置いた場所は`private/`に残す。

### 獲得の指標

獲得がうまくいっているかは、次の1つで見る。

**直近7日間に、初めて来た利用者が編み図に記号を置き、PNGかPDFを出力した人数**

- 探索のファネルで、`first_visit`、`first_edit`、`chart_exported`を利用者単位で並べる。週に1回、直近7日間で見る。
- `chart_created`は使わない。最初の編み図は自動で作られ、そのとき`chart_created`を送らないためである。
- 内訳に`sessionDefaultChannelGroup`を入れると、検索・SNS・参照のどこから来た人が進んだかが分かる。`landingPage`を足すと、どのページに着地した人が進んだかも分かる。
- `chart_exported`は、PNG/PDFの生成後にブラウザへ保存・共有を求めた時点である。端末への保存の完了や、作品の完成ではない。
- これは編集画面の製品イベントを使った目安である。端末内の編み図ごとの記録（`chart_progress`など）とは別に数え、同じ人が複数の端末やブラウザを使うと別に数えうる。
- 人数と率は`private/`に残し、公開の場には書かない。

### Search Consoleのクエリ

記事やページの題材は、推測ではなくSearch Consoleの「検索パフォーマンス」で決める。

- 期間を直近28日、検索タイプを「ウェブ」にする。
- 「クエリ」で、表示回数が多くクリック率が低い語を見る。受け皿のページが無い語や、順位が低い語が、記事を足す候補になる。
- 「ページ」で、既にあるページ（`/guide/`など）が拾っている語を見る。拾えている語は、新しい記事にしない。
- クエリ、ページ、順位は月に1回`private/`へ写す。公開の場には書かない。

## 注釈

`create_property_annotation`は、レポートの読み方が変わる日を残すときだけ使う。

- 計測の追加・変更をリリースした日（例：「chart_progress 計測を追加」）
- 送信の除外条件を変えた日
- 分析の前提が変わる外部の出来事（大きな紹介記事など）

タイトルは60文字、説明は150文字までで、件数や個人の情報を書かない。色は計測の変更を`BLUE`、障害や欠測を`RED`にそろえる。作る前に`list_property_annotations`で同じ日の注釈がないかを確かめる。注釈はGA4の画面に残り、公開されないが、GitHubに書かないものはここにも書かない。

## 読むときの注意

- 当日と直近のデータは処理中で、通常のレポートには24〜48時間かかることがある。[公式のデータ更新頻度](https://support.google.com/analytics/answer/11198161?hl=ja)
- 利用者が少ない組み合わせでは、しきい値で行が伏せられることがある。伏せられた行を0と読まない。[公式のデータのしきい値](https://support.google.com/analytics/answer/9383630?hl=ja)
- GA4の`date`はプロパティのタイムゾーン、`cohort_week`と日数の区分は端末のローカル日付である。期間の端に余裕を持たせる。
- イベント数と利用者数を混ぜない。製品イベントの多くは操作の回数、制作量のイベントは編み図ごと、閾値ごとの件数である。
- オプトアウトや広告ブロッカーなどで届かないイベントがある。送信は再送しない。
- Data APIには[プロパティごとの割り当て](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)がある。同じ問い合わせを繰り返すときは`return_property_quota`で残りを確かめる。

## GA4の画面を使う場合

MCPで足りないときは、GA4の画面で次を行う。画面での手順はANALYTICS.mdの「GA4の設定と閲覧」にある。

- カスタムディメンションの登録と、データ保持期間の変更（MCPは設定を変えられない）
- 探索を作って共有する、DebugViewでパラメータを1件ずつ見る

画面で見るときも、レポートのURLにはプロパティIDが入るので、公開の場所に貼らない。
