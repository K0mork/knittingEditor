import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { cellStitchId } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { boardFromDocument, initializeStorage } from './database';

describe('legacy migration', () => {
  beforeAll(() => {
    localStorage.clear();
    localStorage.setItem('knittingChartData', JSON.stringify({
      numRows: 3,
      numCols: 4,
      grid: [
        [{ type: 'knit', color: '#123456' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }],
        [{ type: 'empty' }, { type: 'right_cross', color: '#000000', multi: 2 }, { type: 'empty', isContinuation: true }, { type: 'empty' }],
        [{ type: 'empty' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }],
      ],
    }));
  });

  it('converts the legacy localStorage chart into the packed model', async () => {
    const { documents, activeId } = await initializeStorage();
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe(activeId);
    expect(documents[0].name).toBe('移行した編み図');
    const board = boardFromDocument(documents[0]);
    expect(cellStitchId(board.valueAt(0, 0))).toBe(STITCH_BY_KEY.get('knit')!.id);
    expect(board.anchorAt(1, 2)).toEqual({ row: 1, col: 1 });
  });
});
