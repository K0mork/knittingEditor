import { describe, expect, it } from 'vitest';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { Board, MAX_BOARD_SIZE, packCell } from './Board';
import { renderThumbnail, THUMBNAIL_MAX_SIDE, ThumbnailCache, thumbnailSize } from './thumbnail';

const id = (key: string) => STITCH_BY_KEY.get(key)!.id;

function pixel(thumbnail: ReturnType<typeof renderThumbnail>, x: number, y: number): number[] {
  const offset = (y * thumbnail.width + x) * 4;
  return Array.from(thumbnail.pixels.slice(offset, offset + 4));
}

describe('thumbnailSize', () => {
  it('keeps one pixel per cell up to the maximum side', () => {
    expect(thumbnailSize(20, 30)).toEqual({ width: 30, height: 20, step: 1 });
    expect(thumbnailSize(THUMBNAIL_MAX_SIDE, 1)).toEqual({ width: 1, height: THUMBNAIL_MAX_SIDE, step: 1 });
  });

  it('merges cells so that the longer side fits and keeps the aspect ratio', () => {
    expect(thumbnailSize(MAX_BOARD_SIZE, MAX_BOARD_SIZE)).toEqual({ width: 91, height: 91, step: 11 });
    expect(thumbnailSize(97, 10)).toEqual({ width: 5, height: 49, step: 2 });
    expect(thumbnailSize(1, MAX_BOARD_SIZE)).toEqual({ width: 91, height: 1, step: 11 });
  });
});

describe('renderThumbnail', () => {
  it('paints each stitch with its color and leaves empty cells white', () => {
    const board = new Board(2, 3);
    board.place(0, 0, 'knit', '#d33c32');
    board.place(1, 2, 'purl', '#123456');
    const thumbnail = renderThumbnail(board.rows, board.cols, board.cells);
    expect([thumbnail.width, thumbnail.height]).toEqual([3, 2]);
    expect(pixel(thumbnail, 0, 0)).toEqual([0xd3, 0x3c, 0x32, 255]);
    expect(pixel(thumbnail, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(thumbnail, 2, 1)).toEqual([0x12, 0x34, 0x56, 255]);
  });

  it('fills every cell that a multi-cell stitch covers', () => {
    const board = new Board(1, 3);
    board.place(0, 1, 'right_up_two_one', '#0000ff');
    const thumbnail = renderThumbnail(board.rows, board.cols, board.cells);
    expect(pixel(thumbnail, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(thumbnail, 1, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(thumbnail, 2, 0)).toEqual([0, 0, 255, 255]);
  });

  it('draws the white-out stitch as white whatever its stored color', () => {
    const cells = Uint32Array.of(packCell(id('erase'), 0x00_00ff));
    expect(pixel(renderThumbnail(1, 1, cells), 0, 0)).toEqual([255, 255, 255, 255]);
  });

  it('averages merged cells by area, including the empty ones', () => {
    // 97段なので2セルずつまとめる。左上の画素は2×2セルのうち1セルだけが黒。
    const board = new Board(97, 2);
    board.place(0, 0, 'knit', '#000000');
    const thumbnail = renderThumbnail(board.rows, board.cols, board.cells);
    expect(thumbnail.step).toBe(2);
    expect(pixel(thumbnail, 0, 0)).toEqual([191, 191, 191, 255]);
    // 最後の段は1段だけの画素になる。面積1で割る。
    board.place(96, 1, 'knit', '#000000');
    expect(pixel(renderThumbnail(board.rows, board.cols, board.cells), 0, 48)).toEqual([128, 128, 128, 255]);
  });

  it('reads legacy cells that store only the stitch ID as black stitches', () => {
    // 旧形式は色を持たず、値がそのまま記号ID。boardFromDocumentと同じく黒の記号として読む。
    const thumbnail = renderThumbnail(1, 3, Uint32Array.of(id('knit'), 0, id('purl')));
    expect(pixel(thumbnail, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(thumbnail, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(thumbnail, 2, 0)).toEqual([0, 0, 0, 255]);
  });

  it('skips unknown stitches and stitches that run past the edge, as the board does when loading', () => {
    const cells = Uint32Array.of(packCell(200, 0), 0xff, packCell(id('right_up_two_one'), 0));
    const thumbnail = renderThumbnail(1, 3, cells);
    for (let x = 0; x < 3; x++) expect(pixel(thumbnail, x, 0)).toEqual([255, 255, 255, 255]);
  });

  it('tolerates a cell array shorter than the board', () => {
    const thumbnail = renderThumbnail(2, 2, Uint32Array.of(packCell(id('knit'), 0)));
    expect(pixel(thumbnail, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(thumbnail, 1, 1)).toEqual([255, 255, 255, 255]);
  });

  it('builds the thumbnail of a full 1000×1000 board in a single quick pass', () => {
    const cells = new Uint32Array(MAX_BOARD_SIZE * MAX_BOARD_SIZE);
    const knit = packCell(id('knit'), 0xd3_3c32);
    const purl = packCell(id('purl'), 0x12_3456);
    for (let index = 0; index < cells.length; index++) cells[index] = (index % 7 === 0) ? purl : knit;
    renderThumbnail(MAX_BOARD_SIZE, MAX_BOARD_SIZE, cells);
    const started = performance.now();
    const thumbnail = renderThumbnail(MAX_BOARD_SIZE, MAX_BOARD_SIZE, cells);
    const elapsed = performance.now() - started;
    expect(thumbnail.pixels.length).toBe(91 * 91 * 4);
    // 手元では数ms。遅いCIでも一覧を開く操作を止めない範囲を上限にする。
    expect(elapsed).toBeLessThan(250);
  });
});

describe('ThumbnailCache', () => {
  const document = (updatedAt: number, cells = new Uint32Array(4).buffer) => ({ id: 'a', rows: 2, cols: 2, cells, updatedAt });

  it('reuses the thumbnail while the document is unchanged, even after it is read again', () => {
    const cache = new ThumbnailCache();
    const first = cache.get(document(1));
    // 一覧を読み直すとセル配列は別のArrayBufferになるが、更新日時が同じなら作り直さない。
    expect(cache.get(document(1))).toBe(first);
  });

  it('rebuilds the thumbnail after the document is saved again', () => {
    const cache = new ThumbnailCache();
    const before = cache.get(document(1));
    const edited = Uint32Array.of(packCell(id('knit'), 0), 0, 0, 0);
    const after = cache.get(document(2, edited.buffer));
    expect(after).not.toBe(before);
    expect(pixel(after, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it('forgets documents that are no longer listed', () => {
    const cache = new ThumbnailCache();
    cache.get(document(1));
    cache.get({ ...document(1), id: 'b' });
    cache.retain(['b']);
    expect(cache.size).toBe(1);
  });
});
