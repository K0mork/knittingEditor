import { useMemo } from 'react';
import type { Board } from '../model/Board';
import { collectUsedColors, USED_COLOR_LIMIT, usedColorLabel } from '../model/usedColors';
import { useModalFocus } from './hooks';
import { useInputEnvironment } from './inputEnvironment';

export interface ColorPickerProps {
  board: Board;
  /** 盤面が変わったときだけ色を数え直すために受け取る。 */
  revision: number;
  selectedColor: string;
  /** 一覧の色を選んだとき。描画モードへ切り替えて閉じる。 */
  onSelect: (color: string) => void;
  /** 色選択で色を変えたとき。色選択はつまみを動かすたびに呼ぶので、閉じずに色だけ変える。 */
  onChange: (color: string) => void;
  onClose: () => void;
}

/**
 * 記号の色を選ぶダイアログ。Web版とiOS版で共通。
 *
 * 編み図で使っている色を多い順に並べ、前に使った色へ1回で戻れるようにする。
 * 一覧にない色は、従来の色選択（`<input type="color">`）で選ぶ。
 */
export function ColorPicker({ board, revision, selectedColor, onSelect, onChange, onClose }: ColorPickerProps) {
  const pickerRef = useModalFocus<HTMLElement>(onClose, '.color-picker-heading button');
  const { keyboard } = useInputEnvironment();
  // 開いている間だけ数え、なぞり描きのたびには数えない。開いている間に盤面が変わったときだけ数え直す。
  const summary = useMemo(() => collectUsedColors(board.cells), [board, revision]);
  const hidden = summary.total - summary.colors.length;
  const selected = selectedColor.toLowerCase();

  return <div className="color-picker-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={pickerRef} className="color-picker" role="dialog" aria-modal="true" aria-labelledby="color-picker-title" aria-describedby="color-picker-description">
      <div className="color-picker-heading"><div><h2 id="color-picker-title">記号の色</h2><p id="color-picker-description">使っている色を選ぶと描画モードになります。{keyboard && 'Escapeで閉じます。'}</p></div><button onClick={onClose}>閉じる</button></div>
      <h3 id="used-colors-title">この編み図で使っている色</h3>
      {summary.total === 0
        ? <p className="color-picker-note">まだ記号を置いていません。</p>
        : <div className="used-color-grid" role="group" aria-labelledby="used-colors-title">
          {summary.colors.map((item) => <button
            key={item.color}
            className={item.hex === selected ? 'used-color selected' : 'used-color'}
            style={{ backgroundColor: item.hex }}
            aria-label={usedColorLabel(item)}
            aria-pressed={item.hex === selected}
            title={item.hex}
            onClick={() => onSelect(item.hex)}
          />)}
        </div>}
      {hidden > 0 && <p className="color-picker-note">使っている順に{USED_COLOR_LIMIT}色を表示しています。ほかに{hidden}色あります。</p>}
      <h3>ほかの色</h3>
      <label className="color-picker-custom">
        <input type="color" value={selectedColor} onChange={(event) => onChange(event.target.value)} />
        <span>色を選ぶ</span>
        <code aria-hidden="true">{selected}</code>
      </label>
    </section>
  </div>;
}
