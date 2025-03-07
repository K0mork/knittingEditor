# knittingEditor

## 概要
「knittingEditor」は，Webブラウザ上で動作する棒針編み図エディタです．直感的な操作で，自分だけのオリジナル編み図を簡単に作成・編集でき，作業状態は自動的に保存されるため，何度でも続きから作業することができます．また，PNG画像としてダウンロードする機能も備えています．

## 特徴
- **直感的なUI**  
  マウスやタッチ操作に対応したグリッドベースのインターフェースで，誰でも簡単に使えます．
- **柔軟なグリッド操作**  
  行・列の追加，削除，指定位置への挿入など，細かい編集操作が可能です．
- **カスタム記号選択**  
  表目や裏目など，豊富な編み目記号をSVGアイコンでビジュアルに提供．選択はドロップダウンメニューから行えます．
- **カラーピッカー**  
  セルの色を自由に変更でき，より分かりやすい編み図作成が可能です．
- **画像保存機能**  
  完成した編み図をhtml2canvasを用いてPNG画像として保存・共有できます．
- **ローカルストレージ対応**  
  作業中の状態が自動的に保存され，ページ再読み込み時にも復元されます．

## プロジェクト構成
- **index.html**  
  メインのHTMLファイル．ツールバー，グリッド，各種モーダル（数値入力用）などが含まれています．

- **css/**  
  - *styles.css*  
    基本レイアウトおよび各コンポーネントのスタイルを定義しています．  
  - *theme.css*  
    ページ全体のリッチなテーマスタイル（背景，ヘッダー，ボタンなど）を設定しています．

- **js/**  
  - *main.js*  
    初期化処理やイベントハンドラー（ツールバー操作，ダウンロード機能等）をまとめています．  
  - *gridManager.js*  
    グリッドやセルの作成，編集，削除など，グリッド全体の状態管理を担当します．  
  - *stitchSymbols.js*  
    各種編み目記号のSVGアイコンを管理しており，視覚的に記号を表示します．  
  - *prompt.js*  
    ユーザーに数値入力（行・列の挿入や削除位置の指定など）を促すカスタムモーダルの実装です．  
  - *storage.js*  
    ローカルストレージを使用したグリッド状態の保存・復元処理を実装しています．

## 使い方
- **ツールバー**  
  左上のカラーピッカーでセルの色を選択し，カスタムドロップダウンから使用する編み目記号（表目，裏目，かけ目など）を選びます．

- **グリッド操作**  
  上下左右の行・列追加，削除，そして指定位置への挿入が可能です．表示される番号に応じた動作（例：挿入する行番号は下から上へ，列番号は右から左へ）が行われます．

- **画像保存**  
  「画像保存」ボタンをクリックすると，現在の編み図がPNG画像としてダウンロードされます．

- **自動保存**  
  すべての編集状態はローカルストレージに保存され，ページを再読み込みしても作業内容が維持されます．

## カスタマイズ
- **デザイン変更**  
  *css/styles.css* および *css/theme.css* を変更することで，エディタの見た目やレイアウトを自由にカスタマイズできます．

- **編み目記号の追加**  
  新たな記号を追加する場合，*js/stitchSymbols.js* にSVGアイコンの定義を追加し，*js/main.js* のドロップダウン初期化部分に新しいオプションを組み込んでください．

## 利用技術
- HTML5, CSS3, JavaScript (ES6)
- [html2canvas](https://html2canvas.hertzen.com/) - 画像保存機能の実装に利用

## コントリビューション
バグ報告，機能改善の提案，プルリクエストなどどんな貢献も歓迎します．改善点や新機能の案がある場合は，IssueやPull Requestを作成してください．
対応が遅れる場合があります．

---

棒針編み図エディタで，皆様の編み物ライフがより楽しくなることを願っています！
