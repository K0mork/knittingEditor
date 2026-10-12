import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { Board } from '../model/Board';
import { boardFromDocument, createDocument, exportBackup, importBackup, saveDocument } from './database';

for (const axis of ['row', 'col'] as const) {
  for (const insert of [false, true]) {
    it(`round-trips a ${axis} ${insert ? 'insertion' : 'deletion'} through a multi-cell stitch`, async () => {
      const board = new Board(axis === 'row' ? 4 : 1, axis === 'col' ? 4 : 1);
      board.place(0, 0, axis === 'row' ? 'slip_stitch' : 'right_cross', '#123456', false);
      board.place(axis === 'row' ? 2 : 0, axis === 'col' ? 2 : 0, 'knit', '#abcdef', false);
      if (axis === 'row') { if (insert) board.insertRow(1); else board.removeRow(1); }
      else { if (insert) board.insertColumn(1); else board.removeColumn(1); }
      const source = await createDocument('構造変更の復元', board.rows, board.cols);
      await saveDocument(source, board);
      const result = await importBackup(await exportBackup([source.id]));
      expect(result.count).toBe(1);
      const restored = boardFromDocument(result.documents[0]);
      expect([restored.rows, restored.cols]).toEqual([board.rows, board.cols]);
      expect(restored.cells).toEqual(board.cells);
      expect(restored.occupiedStitchCount).toBe(insert ? 2 : 1);
      for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) expect(restored.anchorAt(row, col)).toEqual(board.anchorAt(row, col));
      }
      expect(restored.clearAt(axis === 'row' ? 1 : 0, axis === 'col' ? 1 : 0)).toBe(true);
      expect(restored.occupiedStitchCount).toBe(insert ? 1 : 0);
    });
  }
}
