import { useEffect, useState } from 'react';
import type { Board } from '../model/Board';
import { errorMessage } from '../util/errors';

export interface GridControlsProps {
  board: Board;
  /** 盤面を書き換えたあとに呼ぶ。自動保存の起点。 */
  changed: () => void;
  /** 位置入力。Web版は`window.prompt`、iOS版はアプリ内ダイアログを渡す。 */
  askText: (title: string, defaultValue?: string) => Promise<string | null>;
  askConfirm: (title: string) => Promise<boolean>;
  notify: (message: string) => void;
}

/** 盤面設定パネル。Web版とiOS版で共通。 */
export function GridControls({ board, changed, askText, askConfirm, notify }: GridControlsProps) {
  const [rows, setRows] = useState(board.rows);
  const [cols, setCols] = useState(board.cols);
  useEffect(() => { setRows(board.rows); setCols(board.cols); }, [board.rows, board.cols]);

  const mutateStructure = (operation: () => void) => {
    try { operation(); changed(); }
    catch (error) { notify(errorMessage(error)); }
  };

  const promptIndex = async (kind: 'row' | 'col', action: 'insert' | 'remove') => {
    const maximum = kind === 'row' ? board.rows : board.cols;
    const raw = await askText(`${action === 'insert' ? '挿入位置' : '削除する位置'}を入力してください（1〜${maximum}、表示番号基準）`);
    if (raw === null) return;
    const displayed = Number(raw);
    if (!Number.isInteger(displayed) || displayed < 1 || displayed > maximum) { notify(`1〜${maximum}の整数を入力してください`); return; }
    const index = maximum - displayed;
    mutateStructure(() => {
      if (kind === 'row') action === 'insert' ? board.insertRow(index) : board.removeRow(index);
      else action === 'insert' ? board.insertColumn(index) : board.removeColumn(index);
    });
  };

  // 段番号は下から数える。増減のどちらでも上端側で調整し、編み始め（段1）と
  // 既存の段番号を保つ。増加だけ上端、減少は下端では往復で編み始めが消える。
  const resize = () => mutateStructure(() => board.resize(rows, cols, rows - board.rows, 0));

  return <div className="grid-controls">
    <div className="size-inputs"><label>段数<input type="number" min="1" max="1000" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label><label>列数<input type="number" min="1" max="1000" value={cols} onChange={(event) => setCols(Number(event.target.value))} /></label><button className="primary" onClick={resize}>変更</button></div>
    <h3>追加</h3><div className="button-grid"><button onClick={() => mutateStructure(() => board.resize(board.rows + 1, board.cols, 1, 0))}>上に段</button><button onClick={() => mutateStructure(() => board.resize(board.rows + 1, board.cols))}>下に段</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols + 1, 0, 1))}>左に列</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols + 1))}>右に列</button></div>
    <h3>削除</h3><div className="button-grid"><button onClick={() => mutateStructure(() => board.resize(board.rows - 1, board.cols, -1, 0))}>上の段</button><button onClick={() => mutateStructure(() => board.resize(board.rows - 1, board.cols))}>下の段</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols - 1, 0, -1))}>左の列</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols - 1))}>右の列</button></div>
    <h3>指定位置</h3><div className="button-grid"><button onClick={() => void promptIndex('row', 'insert')}>段を挿入</button><button onClick={() => void promptIndex('col', 'insert')}>列を挿入</button><button onClick={() => void promptIndex('row', 'remove')}>段を削除</button><button onClick={() => void promptIndex('col', 'remove')}>列を削除</button></div>
    <button className="danger" onClick={() => void (async () => { if (await askConfirm('盤面をすべて消去しますか？')) { board.clear(); changed(); notify('盤面を消去しました'); } })()}>全体をクリア</button>
  </div>;
}
