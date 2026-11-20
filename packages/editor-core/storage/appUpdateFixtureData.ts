import { Board, type PatternBlock } from '../model/Board';
import { DEFAULT_BACKGROUND_COLOR } from '../model/boardColors';

/**
 * アプリ更新確認（`testSeedDocumentForAppUpdateProbe`・`testUpdatedAppRestoresSeedDocument`）が
 * DEBUGビルドのアプリへ書き込むfixture（#446）の内容。ReactにもDOMにも依存しない。
 *
 * ここは保存したい内容（名前・盤面・地の色・ブロック）だけを表す。保存の記録（`ChartDocument`）は
 * 作らない。書き込みは`debugAppUpdateSeed`が、利用者が編み図を作って保存するときと同じ公開API
 * （`createDocument`・`saveDocument`・`saveBlock`）で行うので、ここで手作りの記録を持つと
 * 本物の保存経路と形が変わって drift する恐れがある。
 *
 * 最初の編み図は、リリース済みの最小fixture（中央の記号1個）と同じ名前・同じ位置の記号を持ち、
 * そこへ色・幅のある記号・点線・背景色を加える。2つ目の編み図は、更新後のテストがfixtureの版を
 * 区別する目印（marker）でもあり、幅のある記号が1個だけ入っている。マスの位置は新規作成の
 * 150段×60目の初期表示（右下の20×20）に収め、UIテストが`saveProbeCell`の座標計算で触れるようにする。
 */
export const APP_UPDATE_FIXTURE_PRIMARY_NAME = 'アプリ更新復元fixture';
export const APP_UPDATE_FIXTURE_MARKER_NAME = 'アプリ更新復元fixture2';
export const APP_UPDATE_FIXTURE_BLOCK_NAME = 'アプリ更新復元ブロック';

/**
 * 記号の既定の色（`useEditorController`の初期値）。リリース済みの最小fixtureと同じ色で
 * 中央の記号を描く。色が保存されず既定へ戻る不具合を見分けられるよう、色付きのセルは
 * これと違う色にする。
 */
export const APP_UPDATE_FIXTURE_DEFAULT_STITCH_COLOR = '#d33c32';
/** 既定と違う色のセルに使う色。`describeColor`は「青緑」と読み上げる。 */
export const APP_UPDATE_FIXTURE_DISTINCT_COLOR = '#264653';
/** 最初の編み図の地の色。`BACKGROUND_PRESETS`の「グレー」でないと、盤面パネルの押された状態で確かめられない。 */
export const APP_UPDATE_FIXTURE_BACKGROUND_COLOR = '#808080';

export interface AppUpdateFixtureDocument {
  name: string;
  board: Board;
  /** 地の色。編集画面は保存時に常に地の色を渡すので、既定の白も明示的に持たせる。 */
  backgroundColor: string;
}

export interface AppUpdateFixture {
  /** 最初の1件を、起動時に開く編み図にする。 */
  documents: AppUpdateFixtureDocument[];
  block: PatternBlock;
}

/** アプリ更新確認のfixture。編み図2つと保存済みブロック1つの内容を作る。 */
export function appUpdateFixture(): AppUpdateFixture {
  const primary = new Board(150, 60);
  // 中央の記号。リリース済みの最小fixtureと同じ意味の内容にする。
  primary.place(139, 49, 'knit', APP_UPDATE_FIXTURE_DEFAULT_STITCH_COLOR);
  // 既定と違う色のセル。
  primary.place(145, 55, 'knit', APP_UPDATE_FIXTURE_DISTINCT_COLOR);
  // 幅2目の記号（右上2目一度）。起点は(135, 52)で、右隣の(135, 53)もその記号が持つ。
  primary.place(135, 52, 'right_up_two_one', APP_UPDATE_FIXTURE_DEFAULT_STITCH_COLOR);
  // 点線のガイド線1本。
  primary.addLine(44, 132, 147);

  // 目印の編み図。幅2目の記号を1個だけ置く。更新後のテストは、右隣のマスを1回消すと
  // 記号全体が消えることで、幅のある記号として残っていたことを確かめる。
  const marker = new Board(150, 60);
  marker.place(140, 50, 'right_up_two_one', APP_UPDATE_FIXTURE_DEFAULT_STITCH_COLOR);

  // 保存済みブロックは、画面の「選択範囲をブロックに保存」と同じ経路（`Board.createBlock`）で作る。
  const blockSource = new Board(2, 2);
  blockSource.place(0, 0, 'knit', APP_UPDATE_FIXTURE_DEFAULT_STITCH_COLOR);
  blockSource.place(1, 1, 'purl', APP_UPDATE_FIXTURE_DISTINCT_COLOR);
  const block = blockSource.createBlock({ top: 0, left: 0, bottom: 1, right: 1 }, APP_UPDATE_FIXTURE_BLOCK_NAME);

  return {
    documents: [
      { name: APP_UPDATE_FIXTURE_PRIMARY_NAME, board: primary, backgroundColor: APP_UPDATE_FIXTURE_BACKGROUND_COLOR },
      { name: APP_UPDATE_FIXTURE_MARKER_NAME, board: marker, backgroundColor: DEFAULT_BACKGROUND_COLOR },
    ],
    block,
  };
}
