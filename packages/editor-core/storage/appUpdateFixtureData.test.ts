import { describe, expect, it } from 'vitest';
import { Board, cellColor, cellStitchId, packCell, parseColor } from '../model/Board';
import { DEFAULT_BACKGROUND_COLOR, backgroundColorOf } from '../model/boardColors';
import { STITCH_BY_ID } from '../stitches/catalog';
import {
  APP_UPDATE_FIXTURE_DISTINCT_COLOR,
  APP_UPDATE_FIXTURE_PRIMARY_NAME,
  APP_UPDATE_FIXTURE_MARKER_NAME,
  APP_UPDATE_FIXTURE_BLOCK_NAME,
  APP_UPDATE_FIXTURE_BACKGROUND_COLOR,
  appUpdateFixture,
} from './appUpdateFixtureData';

describe('appUpdateFixture', () => {
  it('describes two named documents, the primary first, and one block', () => {
    const fixture = appUpdateFixture();
    expect(fixture.documents.map((document) => document.name))
      .toEqual([APP_UPDATE_FIXTURE_PRIMARY_NAME, APP_UPDATE_FIXTURE_MARKER_NAME]);
    expect(fixture.block.name).toBe(APP_UPDATE_FIXTURE_BLOCK_NAME);
  });

  it('keeps the centre symbol of the released minimal fixture', () => {
    const primary = appUpdateFixture().documents[0].board;
    // 位置は初期表示の中央で、色も記号も既定のまま。リリース済みの最小fixtureと同じ内容にする。
    expect(primary.valueAt(139, 49)).toBe(packCell(1, parseColor('#d33c32')));
    expect(primary.anchorAt(139, 49)).toEqual({ row: 139, col: 49 });
  });

  it('adds a distinctly coloured cell, a two-cell stitch, a dashed line and a background colour', () => {
    const { board: primary, backgroundColor } = appUpdateFixture().documents[0];
    // 記号は中央・色付き・幅2目の3個。
    expect(primary.occupiedStitchCount).toBe(3);
    // 色付きのセルは、記号の既定の色と違う色で保存されている。
    expect(cellColor(primary.valueAt(145, 55))).toBe(parseColor(APP_UPDATE_FIXTURE_DISTINCT_COLOR));
    // 幅2目の記号（右上2目一度）。起点の右隣も同じ記号が持つマスで、色は既定のまま。
    expect(STITCH_BY_ID.get(cellStitchId(primary.valueAt(135, 52)))?.key).toBe('right_up_two_one');
    expect(cellColor(primary.valueAt(135, 52))).toBe(parseColor('#d33c32'));
    expect(primary.ownerAt(135, 53)).toBe(primary.index(135, 52));
    // 点線のガイド線1本。
    expect(primary.lines).toEqual([{ col: 44, top: 132, bottom: 147 }]);
    // 地の色は白以外で、盤面パネルのプリセット「グレー」と一致する。
    expect(backgroundColor).toBe(APP_UPDATE_FIXTURE_BACKGROUND_COLOR);
    expect(backgroundColorOf(appUpdateFixture().documents[0])).toBe('#808080');
  });

  it('places exactly one two-cell stitch on the marker document', () => {
    const marker = appUpdateFixture().documents[1];
    expect(marker.board.occupiedStitchCount).toBe(1);
    expect(marker.board.lines).toEqual([]);
    // 編集画面は保存時に常に地の色を渡すので、目印も既定の白を明示的に持つ。
    expect(marker.backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
    expect(backgroundColorOf(marker)).toBe('#ffffff');
    // 幅2目の記号の右隣のマスも、その記号が持つマス。更新後のテストはここを1回消す。
    expect(marker.board.ownerAt(140, 51)).toBe(marker.board.index(140, 50));
  });

  it('saves a block made through Board.createBlock', () => {
    const block = appUpdateFixture().block;
    expect(block.name).toBe(APP_UPDATE_FIXTURE_BLOCK_NAME);
    expect([block.rows, block.cols]).toEqual([2, 2]);
    expect(block.anchors).toEqual([
      { row: 0, col: 0, value: packCell(1, parseColor('#d33c32')) },
      { row: 1, col: 1, value: packCell(2, parseColor(APP_UPDATE_FIXTURE_DISTINCT_COLOR)) },
    ]);
    // 貼り付けて同じ盤面へ戻せることまで確かめる。
    const pasted = new Board(2, 2);
    expect(pasted.pasteBlock(block, 0, 0)).toBe(true);
    expect(pasted.valueAt(0, 0)).toBe(block.anchors[0].value);
    expect(pasted.valueAt(1, 1)).toBe(block.anchors[1].value);
    expect(pasted.valueAt(0, 1)).toBe(0);
  });
});
