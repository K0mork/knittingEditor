/**
 * 編み目記号の一覧ページ（`/stitches/`）を作る。
 *
 * 記号の名前・大きさ・区分・SVGは、アプリと同じ`packages/editor-core/stitches/catalog.ts`から読む。
 * 意味と使いどころだけをこのファイルに書き、並びはアプリの記号一覧と同じ`STITCH_CATEGORY_ORDER`に従う。
 * 記号が増えたときは、`STITCHES`に足してからこのスクリプトを実行し、`scripts/stitches-page.test.mjs`を通す。
 *
 * 実行: node scripts/generate-stitch-page.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT = new URL('../public/stitches/index.html', import.meta.url);
const PAGE_URL = 'https://knittingeditor.com/stitches/';

/** 記号ごとの意味と使いどころ。`tip`は置き方の後ろに足す補足。 */
const CONTENT = {
  knit: {
    summary: '編み地の表側にV字の目が出る、いちばん基本の編み目です。棒針を手前から入れて糸を掛け、引き出して編みます。',
    use: 'メリヤス編みの表側や、模様の地、配色のマスに使います。',
  },
  purl: {
    summary: '編み地の表側に横の線が出る編み目です。棒針を奥から入れて糸を掛け、引き出して編みます。',
    use: 'ゴム編みや鹿の子編み、ケーブル編みの地に使います。',
  },
  yo: {
    summary: '糸を針に掛けて、新しい目を作る記号です。編み地に小さな穴が開きます。',
    use: '透かし模様や増し目、ボタンホールに使います。',
    tip: '増えた目は、次の段で編み入れます。目数を変えずに穴だけを開けたいときは、同じ段の減目と組み合わせます。',
  },
  right_increase: {
    summary: '1目から2目を作る増し目で、増えた目が右へ傾きます。',
    use: '袖や身頃の端を広げるとき、右端の増し目に使います。',
  },
  left_increase: {
    summary: '1目から2目を作る増し目で、増えた目が左へ傾きます。',
    use: '袖や身頃の端を広げるとき、左端の増し目に使います。',
  },
  slip_stitch: {
    summary: '目を編まずに、そのまま針へ移す記号です。編み図では縦2段にまたがります。',
    use: '衿や裾の端、模様の区切りに使います。',
    tip: '盤面では、記号の上側のマスを押すと、その下の段まで2段分が入ります。',
  },
  float_stitch: {
    summary: '編まない目を休ませ、糸を編み地の裏で渡す記号です。縦2段にまたがり、渡した糸が横線で表されます。',
    use: '配色の切り替えで、使わない色の糸を渡すときに使います。',
    tip: '盤面では、記号の上側のマスを押すと、その下の段まで2段分が入ります。',
  },
  right_up_two_one: {
    summary: '2目をまとめて1目に減らす記号です。表から見て、編み目が右に傾きます。',
    use: '袖ぐりや衿ぐりなど、目数を減らすところに使います。',
  },
  left_up_two_one: {
    summary: '2目をまとめて1目に減らす記号です。表から見て、編み目が左に傾きます。',
    use: '左右対称に減らしたいとき、右上2目一度と組み合わせます。',
  },
  purl_right_up_two_one: {
    summary: '裏目で2目を1目に減らす記号です。表から見て、編み目が右に傾きます。',
    use: '裏メリヤスやゴム編みの中で、目数を減らすときに使います。',
  },
  purl_left_up_two_one: {
    summary: '裏目で2目を1目に減らす記号です。表から見て、編み目が左に傾きます。',
    use: '裏メリヤスやゴム編みの中で、左右対称に減らすときに使います。',
  },
  middle_up_three_one: {
    summary: '3目の真ん中の目を上にして、1目に減らす記号です。編み目は左右どちらにも傾きません。',
    use: '模様の中心で減らすときや、中央をそろえたいときに使います。',
  },
  right_up_three_one: {
    summary: '3目をまとめて1目に減らす記号です。表から見て、編み目が右に傾きます。',
    use: '一度に大きく減らしたいとき、袖ぐりや肩の線に使います。',
  },
  left_up_three_one: {
    summary: '3目をまとめて1目に減らす記号です。表から見て、編み目が左に傾きます。',
    use: '一度に大きく減らしたいとき、右の減目と組み合わせて左右対称にします。',
  },
  right_cross: {
    summary: '2目を交差させる記号です。右の目が手前（上）になるように交差します。',
    use: 'ケーブル編みの基本になる交差です。',
    tip: '交差させる段だけこの記号を置き、間の段は表目や裏目で編みます。',
  },
  left_cross: {
    summary: '2目を交差させる記号です。左の目が手前（上）になるように交差します。',
    use: 'ケーブル編みで、右上交差と組み合わせて縄の向きを変えるときに使います。',
  },
  purl_right_cross: {
    summary: '交差する目に裏目が入る記号です。裏目で編む線の端には、短い横線が付きます。',
    use: '表目と裏目を混ぜた交差で、ケーブルの地を裏目にしたときなどに使います。',
  },
  purl_left_cross: {
    summary: '交差する目に裏目が入る記号です。裏目で編む線の端には、短い横線が付きます。',
    use: '表目と裏目を混ぜた交差を、左右対称にしたいときに使います。',
  },
  purl_right_up_two_cross: {
    summary: '2目の束と1目の束を交差させる記号です。右の束が手前（上）になります。',
    use: '太さの違う束を交差させた、変化のあるケーブルに使います。',
  },
  purl_left_up_two_cross: {
    summary: '2目の束と1目の束を交差させる記号です。左の束が手前（上）になります。',
    use: '太さの違う束の交差を、左右対称にしたいときに使います。',
  },
  purl_right_cross_twist_stitch: {
    summary: '交差する目がねじり目になる記号です。右の目が手前（上）になり、下の線に裏目の横線が付きます。',
    use: 'ねじり目を混ぜたケーブルで、細かい陰影を付けたいときに使います。',
  },
  purl_left_cross_twist_stitch: {
    summary: '交差する目がねじり目になる記号です。左の目が手前（上）になり、下の線に裏目の横線が付きます。',
    use: 'ねじり目を混ぜた交差を、左右対称にしたいときに使います。',
  },
  right_up_two_cross: {
    summary: '2目ずつの束を交差させる記号です。右の束が手前（上）になります。',
    use: '2/2ケーブルなど、太い縄編みに使います。',
    tip: '交差させる段だけこの記号を置き、間の段は表目や裏目で編みます。',
  },
  left_up_two_cross: {
    summary: '2目ずつの束を交差させる記号です。左の束が手前（上）になります。',
    use: '2/2ケーブルで、右の交差と組み合わせて縄の向きを変えるときに使います。',
  },
  right_up_three_cross: {
    summary: '3目ずつの束を交差させる記号です。右の束が手前（上）になります。',
    use: '3/3ケーブルなど、幅の広い縄編みに使います。',
  },
  left_up_three_cross: {
    summary: '3目ずつの束を交差させる記号です。左の束が手前（上）になります。',
    use: '3/3ケーブルで、右の交差と組み合わせて縄の向きを変えるときに使います。',
  },
  twist_stitch: {
    summary: '目をねじって編む記号です。編み目が縦に引き締まり、筋が出ます。',
    use: '靴下の踵や袖口など、目を詰めたいところに使います。',
  },
  purl_twist_stitch: {
    summary: '裏目をねじって編む記号です。表から見ると、横の線が引き締まった目になります。',
    use: '裏目を使うゴム編みで、目を詰めたいときに使います。',
  },
  erase: {
    summary: '編み図のマスを白く塗る、このアプリ独自の補助記号です。編み目ではありません。',
    use: '模様の区切りや余白を白く見せたいときに使います。',
    tip: '色を選んでいても白く描かれます。背景色に戻したいときは「消す」を使います。',
  },
};

/** 区分ごとの説明。 */
const CATEGORY_INTRO = {
  basic: '編み地のいちばん基本になる記号です。表目と裏目を組み合わせると、メリヤス編みやゴム編みになります。',
  decrease: '目数を減らす記号です。減らす位置と向きで、編み地の傾きが変わります。',
  cable: '目を交差させる記号です。ケーブル編みの縄を作るときに使います。',
  twist: '目をねじって編む記号です。縦に筋の出る編み地になります。',
  utility: '編み図を描くための補助の記号です。編み目ではありません。',
};

const OG_IMAGE = 'https://knittingeditor.com/og-image.png';

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** SVGの文字列から、記号の中身とviewBox・線の太さを取り出す。 */
function glyphParts(svg) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const strokeWidth = /stroke-width="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox || !strokeWidth) throw new Error(`記号のSVGを読めません: ${svg.slice(0, 40)}`);
  return { viewBox, strokeWidth, body: svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')) };
}

/** 編み図での置き方。幅・高さと、増減する目数から組み立てる。 */
function placementText(stitch) {
  if (stitch.renderKind === 'whiteout') return '1目分のマスを白く塗ります。編み目ではないので、その段の目数は変わりません。';
  const span = stitch.height === 1
    ? `${stitch.width}目分のマスを使います。`
    : `${stitch.width}目分の幅で、縦${stitch.height}段のマスを使います。`;
  const delta = stitch.produces - stitch.consumes;
  if (delta > 0) return `${span}その段で${delta}目増えます。`;
  if (delta < 0) return `${span}その段で${-delta}目減ります。`;
  return `${span}その段の目数は変わりません。`;
}

/**
 * 記号が使うマスを示す小さな図。記号は`width`×`height`のマスに入れ、
 * 前後のマスを薄く残して、編み図のどこを占めるかが分かるようにする。
 */
function footprintSvg(stitch, parts) {
  const CELL = 22;
  const columns = Math.min(Math.max(stitch.width + 2, 4), 8);
  const rows = stitch.height;
  const left = Math.floor((columns - stitch.width) / 2);
  const width = columns * CELL;
  const height = rows * CELL;
  const lines = [];
  for (let column = 1; column < columns; column++) lines.push(`<path d="M ${column * CELL} 0 V ${height}"/>`);
  for (let row = 1; row < rows; row++) lines.push(`<path d="M 0 ${row * CELL} H ${width}"/>`);
  return `<svg class="footprint-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(stitch.name)}が使うマス">`
    + `<rect class="paper" width="${width}" height="${height}"/>`
    + `<rect class="used" x="${left * CELL}" width="${stitch.width * CELL}" height="${height}"/>`
    + `<g class="grid" fill="none" stroke-width="1">${lines.join('')}</g>`
    + `<g transform="translate(${left * CELL} 0) scale(${CELL / 100})" fill="none" stroke="currentColor" stroke-width="${parts.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${parts.body}</g>`
    + '</svg>';
}

function articleHtml(stitch, labels) {
  const content = CONTENT[stitch.key];
  if (!content) throw new Error(`意味が書かれていない記号です: ${stitch.key}`);
  const parts = glyphParts(stitch.svg);
  const tip = content.tip ? `<span class="tip">${escapeHtml(content.tip)}</span>` : '';
  return `<article class="stitch" id="${stitch.key}" data-stitch="${stitch.key}">
          <div class="symbol" style="--cols:${stitch.width};--rows:${stitch.height}" aria-hidden="true">${stitch.svg}</div>
          <div class="head">
            <h3>${escapeHtml(stitch.name)}</h3>
            <p class="meta"><span class="tag">${labels.standard[stitch.standardStatus]}</span><span>${stitch.height}段×${stitch.width}目</span></p>
          </div>
          <div class="text">
            <p>${escapeHtml(content.summary)}</p>
            <dl>
              <dt>使いどころ</dt><dd>${escapeHtml(content.use)}</dd>
              <dt>編み図での置き方</dt><dd>${placementText(stitch)}${tip}</dd>
            </dl>
          </div>
          <figure class="footprint">
            ${footprintSvg(stitch, parts)}
            <figcaption>使うマス：${stitch.width}目×${stitch.height}段</figcaption>
          </figure>
        </article>`;
}

function pageHtml(stitches, labels, order) {
  const total = stitches.length;
  const sections = order.map((category) => {
    const items = stitches.filter((stitch) => stitch.category === category);
    return `<section class="category" id="${category}" data-category="${category}">
        <h2>${labels.category[category]}の記号（${items.length}）</h2>
        <p>${CATEGORY_INTRO[category]}</p>
        <div class="stitches">
        ${items.map((stitch) => articleHtml(stitch, labels)).join('\n        ')}
        </div>
      </section>`;
  }).join('\n\n      ');

  const toc = order.map((category) => `<a href="#${category}">${labels.category[category]}<span>${stitches.filter((stitch) => stitch.category === category).length}</span></a>`).join('\n        ');

  const description = `棒針編みの編み目記号${total}種類の一覧です。表目、裏目、かけ目、増し目、減目、交差、ねじり目、すべり目の意味と使いどころ、編み図での置き方をまとめました。記号の絵はアプリと同じです。`;

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#3d7a4a" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1f4228" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="編み目記号の一覧｜棒針編み図エディタ" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${PAGE_URL}" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="棒針編み図エディタ" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="棒針の編み図 無料・登録不要" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="${PAGE_URL}" />
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
    <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>編み目記号の一覧｜棒針編み図エディタ</title>
    <style>
      :root {
        --ink: #26322c;
        --paper: #fffdf7;
        --page: #f3f0e8;
        --line: #d5dbd3;
        --muted: #52625a;
        --accent: #3d7a4a;
        --accent-text: #285d35;
        --tag: #e8efe6;
        --tag-text: #33503b;
        --used: #eef3ea;
        --grid: #e6e1d4;
        font-family: Inter, "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
        color: var(--ink);
        background: var(--page);
        line-height: 1.8;
        color-scheme: light dark;
      }
      * { box-sizing: border-box; }
      body { margin: 0; overflow-wrap: anywhere; }
      header, main, footer { width: min(960px, calc(100% - 32px)); margin-inline: auto; }
      header { padding: 28px 0 12px; }
      main { padding: 8px 0 48px; }
      footer { padding: 20px 0 40px; border-top: 1px solid var(--line); }
      h1 { font-size: clamp(1.7rem, 5vw, 2.5rem); line-height: 1.35; }
      h2 { margin-top: 2.2em; line-height: 1.45; }
      p, li { max-width: 72ch; }
      a { color: var(--accent-text); }
      .lead { font-size: 1.08rem; }
      .cta {
        display: inline-block;
        margin-top: 12px;
        padding: 10px 16px;
        border-radius: 10px;
        background: var(--accent);
        color: white;
        font-weight: 700;
        text-decoration: none;
      }
      .note {
        padding: 14px 16px;
        border-left: 4px solid var(--accent);
        background: var(--paper);
      }
      .toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 8px; padding: 0; list-style: none; }
      .toc a {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 5px 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        text-decoration: none;
      }
      .toc span { color: var(--muted); font-size: .85rem; }
      .stitches { display: grid; gap: 14px; margin-top: 20px; }
      .stitch {
        display: grid;
        grid-template-columns: minmax(0, auto) minmax(0, 1fr);
        grid-template-areas: "symbol head" "text text" "figure figure";
        gap: 8px 16px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--paper);
      }
      .symbol {
        grid-area: symbol;
        align-self: start;
        width: min(calc(var(--cols) * 54px), 40vw, 216px);
        aspect-ratio: var(--cols) / var(--rows);
        color: var(--ink);
      }
      .symbol svg { display: block; }
      .head { grid-area: head; }
      .text { grid-area: text; }
      .stitch h3 { margin: 0; font-size: 1.12rem; line-height: 1.5; }
      .meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 2px 0 0; font-size: .82rem; color: var(--muted); }
      .tag { padding: 1px 9px; border-radius: 999px; background: var(--tag); color: var(--tag-text); font-size: .72rem; font-weight: 700; }
      .stitch p { margin: 0 0 8px; }
      .stitch dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; margin: 0; font-size: .92rem; }
      .stitch dt { color: var(--muted); white-space: nowrap; }
      .stitch dd { margin: 0; }
      .tip { display: block; margin-top: 2px; color: var(--muted); }
      .footprint { grid-area: figure; margin: 10px 0 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
      .footprint-svg { display: block; width: auto; height: auto; max-width: 100%; color: var(--ink); }
      .footprint-svg .paper { fill: var(--paper); }
      .footprint-svg .used { fill: var(--used); }
      .footprint-svg .grid { stroke: var(--grid); }
      .footprint figcaption { font-size: .8rem; color: var(--muted); }
      .legal { font-size: .85rem; }
      .faq dt { margin-top: 1em; font-weight: 700; }
      .faq dd { margin: 0; max-width: 72ch; }
      @media (max-width: 759px) {
        .stitch dl { grid-template-columns: minmax(0, 1fr); }
        .stitch dt { margin-top: 10px; }
        .stitch dt:first-child { margin-top: 0; }
      }
      @media (min-width: 760px) {
        .stitch {
          grid-template-columns: minmax(0, auto) minmax(0, 1fr) 190px;
          grid-template-areas: "symbol head figure" "symbol text figure";
          align-items: start;
        }
        .symbol { width: min(calc(var(--cols) * 54px), 240px); }
        .footprint { margin: 0; }
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --ink: #e2e8e3;
          --paper: #1e2420;
          --page: #171c19;
          --line: #3c4741;
          --muted: #a5b2aa;
          --accent-text: #8fcb9b;
          --tag: #2b3a31;
          --tag-text: #b6d8bd;
          --used: #2a342d;
          --grid: #39443d;
        }
        .cta { color: white; }
        .footprint-svg { color: #e2e8e3; }
      }
    </style>
  </head>
  <body>
    <header>
      <a href="/">棒針編み図エディタ</a>
    </header>
    <main>
      <h1>編み目記号の一覧</h1>
      <p class="lead">棒針編みの編み図で使う${total}種類の記号を、意味・使いどころ・編み図での置き方とともにまとめました。記号の絵は、このサイトの編み図エディタで使っているものと同じです。</p>
      <p class="note">記号の名前と並びは、アプリの編み目記号の一覧とそろえています。「1段×2目」の表示は、その記号が編み図で使うマスの大きさです。</p>
      <p><a class="cta" href="/" data-analytics="editor">編み図エディタを開く</a></p>
      <nav class="toc" aria-label="記号の分類">
        ${toc}
      </nav>

      <h2>編み図の記号の読み方</h2>
      <ul>
        <li>編み図は1マスが1目、横1列が1段です。段は下から上へ、目は右から左へ読みます。</li>
        <li>記号は、編み地を表側から見た形で表します。</li>
        <li>「右上」「左上」は、編み目がどちらへ傾くか、どの目が手前（上）になるかを表します。</li>
        <li>幅が2目以上の記号は、その幅のマスを使います。縦2段にまたがる記号もあります。</li>
      </ul>
      <p>往復編みでは、偶数段は裏側を見て編むため、記号を読み替えます。読み替え方と編み図の描き方は<a href="/guide/">使い方</a>にまとめています。</p>

      ${sections}

      <h2>よくある質問</h2>
      <dl class="faq">
        <dt>記号はJISに基づいていますか？</dt>
        <dd>基本の記号は、JIS L 0201の編み目記号に基づいています。JISにない組み合わせ（裏目の交差、2目と1目の交差、ねじり目との組み合わせ）は、JISの記号を組み合わせて表しています。各記号の「JIS」「JIS派生」「拡張」がその目安です。</dd>
        <dt>記号が使うマスの大きさはどう見ますか？</dt>
        <dd>各記号の「1段×2目」のような表示と、そばにある図で、編み図で使うマスを示しています。幅が2目以上の記号は、その幅のマスをまとめて使います。</dd>
        <dt>裏側から編む段の記号はどう読みますか？</dt>
        <dd>往復編みでは、偶数段は裏側を見て編むため、表目と裏目を読み替えます。輪編みでは、すべての段を表側から読みます。詳しくは<a href="/guide/">使い方</a>にまとめています。</dd>
      </dl>

      <h2>記号を使って編み図を描く</h2>
      <p>編み図エディタでは、このページの記号を選んで盤面に置くだけで編み図を描けます。PNGやPDFで保存でき、iPhone・iPadのアプリでも同じ編み図を使えます。</p>
      <p><a class="cta" href="/" data-analytics="editor">編み図エディタを開く</a></p>
      <p>編み図の作り方は<a href="/chart-basics/">編み図の作り方</a>、操作の手順は<a href="/guide/">使い方</a>、すぐに使える模様は<a href="/templates/">テンプレート</a>にまとめています。</p>
    </main>
    <footer>
      <a href="/">棒針編み図エディタへ戻る</a>
      <p><a href="/guide/">使い方</a></p>
      <p><a href="/templates/">編み図のテンプレート</a></p>
      <p><a href="/support/">サポート・お問い合わせ</a></p>
      <p><a href="/privacy/">プライバシーポリシー</a></p>
      <p><a href="/third-party-notices/">第三者ソフトウェアのライセンス</a></p>
      <p class="legal">Apple、Appleのロゴ、iPhone、iPadは、米国およびその他の国で登録されたApple Inc.の商標です。App Storeは、米国およびその他の国で登録されたApple Inc.のサービスマークです。</p>
    </footer>
    <script type="module" src="/analytics.js" data-analytics-entry></script>
  </body>
</html>
`;
}

const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { STITCHES, STITCH_CATEGORY_LABELS, STITCH_CATEGORY_ORDER, STITCH_STANDARD_LABELS } = await server.ssrLoadModule('/packages/editor-core/stitches/catalog.ts');
  const html = pageHtml(STITCHES, { category: STITCH_CATEGORY_LABELS, standard: STITCH_STANDARD_LABELS }, STITCH_CATEGORY_ORDER);
  await mkdir(new URL('../public/stitches/', import.meta.url), { recursive: true });
  await writeFile(OUTPUT, html);
  console.log(`public/stitches/index.html (${STITCHES.length} symbols)`);
} finally {
  await server.close();
}
