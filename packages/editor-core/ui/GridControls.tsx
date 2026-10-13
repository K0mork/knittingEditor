import { useRef, useState } from 'react';
import { Board } from '../model/Board';
import { BACKGROUND_PRESETS } from '../model/boardColors';
import { errorMessage } from '../util/errors';

export interface GridControlsProps {
  board: Board;
  /** 盤面の地の色（`#rrggbb`）。 */
  backgroundColor: string;
  /** 地の色を変えたとき。色選択はつまみを動かすたびに呼ぶ。 */
  onBackgroundColorChange: (color: string) => void;
  /** 盤面を書き換えたあとに呼ぶ。自動保存の起点。 */
  changed: () => void;
  /** 位置入力。Web版は`window.prompt`、iOS版はアプリ内ダイアログを渡す。 */
  askText: (title: string, defaultValue?: string) => Promise<string | null>;
  askConfirm: (title: string) => Promise<boolean>;
  notify: (message: string) => void;
}

/** 盤面設定パネル。Web版とiOS版で共通。 */
export function GridControls({ board, backgroundColor, onBackgroundColorChange, changed, askText, askConfirm, notify }: GridControlsProps) {
  const [rows, setRows] = useState(String(board.rows));
  const [cols, setCols] = useState(String(board.cols));
  const [dimensions, setDimensions] = useState({ board, rows: board.rows, cols: board.cols });
  const resizing = useRef(false);
  // 初回の受動effectで入力を戻さない。実寸法の変更（取り消しを含む）だけ同期する。
  if (dimensions.board !== board || dimensions.rows !== board.rows || dimensions.cols !== board.cols) {
    setDimensions({ board, rows: board.rows, cols: board.cols });
    setRows(String(board.rows));
    setCols(String(board.cols));
  }

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

  const resizeBoard = async (nextRows: number, nextCols: number, rowOffset = 0, colOffset = 0) => {
    if (resizing.current) return;
    resizing.current = true;
    try {
      Board.validateSize(nextRows, nextCols);
      const removed = board.countStitchesRemovedByResize(nextRows, nextCols, rowOffset, colOffset);
      if (removed > 0 && !await askConfirm(`記号${removed}個が消えます。変更しますか？`)) return;
      mutateStructure(() => board.resize(nextRows, nextCols, rowOffset, colOffset));
    } catch (error) { notify(errorMessage(error)); }
    finally { resizing.current = false; }
  };

  // 段は下、目は右から数える。上端・左端で増減して既存の番号を保つ。
  const resize = () => void resizeBoard(Number(rows), Number(cols), Number(rows) - board.rows, Number(cols) - board.cols);

  return <div className="grid-controls">
    <div className="size-inputs"><label>段数<input type="number" min="1" max="1000" value={rows} onChange={(event) => setRows(event.target.value)} /></label><label>列数<input type="number" min="1" max="1000" value={cols} onChange={(event) => setCols(event.target.value)} /></label><button className="primary" onClick={resize}>変更</button></div>
    <h3 id="background-color-title">背景色</h3>
    <div className="background-presets" role="group" aria-labelledby="background-color-title">
      {BACKGROUND_PRESETS.map((preset) => <button key={preset.color} className="background-preset" aria-pressed={backgroundColor === preset.color}
        onClick={() => onBackgroundColorChange(preset.color)}>
        <span className="background-swatch" aria-hidden="true" style={{ backgroundColor: preset.color }} />{preset.label}
      </button>)}
    </div>
    <label className="color-picker-custom background-custom">
      <input type="color" value={backgroundColor} onChange={(event) => onBackgroundColorChange(event.target.value)} />
      <span>ほかの色を選ぶ</span>
      <code aria-hidden="true">{backgroundColor}</code>
    </label>
    <h3>追加</h3><div className="button-grid"><button onClick={() => mutateStructure(() => board.resize(board.rows + 1, board.cols, 1, 0))}>上に段</button><button onClick={() => mutateStructure(() => board.resize(board.rows + 1, board.cols))}>下に段</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols + 1, 0, 1))}>左に列</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols + 1))}>右に列</button></div>
    <h3>削除</h3><div className="button-grid"><button onClick={() => mutateStructure(() => board.resize(board.rows - 1, board.cols, -1, 0))}>上の段</button><button onClick={() => mutateStructure(() => board.resize(board.rows - 1, board.cols))}>下の段</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols - 1, 0, -1))}>左の列</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols - 1))}>右の列</button></div>
    <h3>指定位置</h3><div className="button-grid"><button onClick={() => void promptIndex('row', 'insert')}>段を挿入</button><button onClick={() => void promptIndex('col', 'insert')}>列を挿入</button><button onClick={() => void promptIndex('row', 'remove')}>段を削除</button><button onClick={() => void promptIndex('col', 'remove')}>列を削除</button></div>
    <button className="danger" onClick={() => void (async () => { if (await askConfirm('盤面をすべて消去しますか？')) { board.clear(); changed(); notify('盤面を消去しました'); } })()}>全体をクリア</button>
  </div>;
}
