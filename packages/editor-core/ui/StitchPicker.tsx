import { STITCHES, STITCH_CATEGORY_LABELS, type StitchCategory } from '../stitches/catalog';
import { useModalFocus } from './hooks';

export const STITCH_CATEGORY_ORDER: StitchCategory[] = ['basic', 'decrease', 'cable', 'twist', 'utility'];

export interface StitchPickerProps {
  selectedStitch: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

/** 編み目記号の選択ダイアログ。Web版とiOS版で共通。 */
export function StitchPicker({ selectedStitch, onSelect, onClose }: StitchPickerProps) {
  const pickerRef = useModalFocus<HTMLElement>(onClose, '.stitch-picker-heading button');
  return <div className="stitch-picker-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={pickerRef} className="stitch-picker" role="dialog" aria-modal="true" aria-labelledby="stitch-picker-title" aria-describedby="stitch-picker-description">
      <div className="stitch-picker-heading"><div><h2 id="stitch-picker-title">編み目記号</h2><p id="stitch-picker-description">記号を選ぶと描画モードになります。Escapeで閉じます。</p></div><button onClick={onClose}>閉じる</button></div>
      {STITCH_CATEGORY_ORDER.map((category) => <div className="stitch-category" key={category}>
        <h3>{STITCH_CATEGORY_LABELS[category]}</h3>
        <div className="stitch-grid">
          {STITCHES.filter((stitch) => stitch.category === category).map((stitch) => <button
            className={stitch.key === selectedStitch ? 'stitch-option selected' : 'stitch-option'}
            key={stitch.key}
            aria-pressed={stitch.key === selectedStitch}
            onClick={() => onSelect(stitch.key)}
          >
            <span className="stitch-option-symbol" aria-hidden="true" dangerouslySetInnerHTML={{ __html: stitch.svg }} />
            <span className="stitch-option-name">{stitch.name}</span>
            <small>{stitch.width}×{stitch.height}目</small>
          </button>)}
        </div>
      </div>)}
    </section>
  </div>;
}
