import { useState, type ReactNode } from 'react';
import type { Board } from '../model/Board';
import { defaultPngCellSize, PNG_CELL_SIZE_RANGE, validatePngSize } from '../export/exporters';
import { pdfPageCount, type PdfLayoutOptions } from '../export/pdfLayout';

export interface ExportControlsProps {
  board: Board;
  onPng: (size: number) => void;
  onPdf: (options: PdfLayoutOptions) => void;
  onBackup: (all: boolean) => void;
  onRestore: () => void;
  /** 端末内データが消える条件はWeb版とiOS版で違うので、案内文だけ差し替える。 */
  backupNote: ReactNode;
}

/** 保存・出力パネル。Web版とiOS版で共通。 */
export function ExportControls({ board, onPng, onPdf, onBackup, onRestore, backupNote }: ExportControlsProps) {
  const [pngSize, setPngSize] = useState(() => defaultPngCellSize(board));
  const [layout, setLayout] = useState<PdfLayoutOptions['layout']>('single');
  const [orientation, setOrientation] = useState<PdfLayoutOptions['orientation']>('portrait');
  const [millimeters, setMillimeters] = useState(5);
  const png = validatePngSize(board, pngSize);
  // 推定ページ数はPDF Workerと同じ計算を使う。用紙の有効寸法をここに書き写すと、
  // 余白や分割規則を変えたときに表示と実際の出力がずれる。
  const pdfOptions: PdfLayoutOptions = { layout, orientation, cellMillimeters: millimeters };
  const pages = pdfPageCount(board.rows, board.cols, pdfOptions);
  return <div className="export-controls">
    <h3>PNG</h3><label>1セルの画素数<input type="range" min={PNG_CELL_SIZE_RANGE.min} max={PNG_CELL_SIZE_RANGE.max} value={pngSize} onChange={(event) => setPngSize(Number(event.target.value))} /><output>{pngSize}px</output></label><p>{png.width}×{png.height}px {!png.valid && `— ${png.reason}`}</p><button disabled={!png.valid} onClick={() => onPng(pngSize)}>PNGを保存</button>{!png.valid && <p className="recommend">この盤面はPDF保存をおすすめします。</p>}
    <h3>PDF</h3><label>構成<select value={layout} onChange={(event) => setLayout(event.target.value as PdfLayoutOptions['layout'])}><option value="single">全体を1ページ</option><option value="tiled">読みやすく分割</option></select></label><label>用紙<select value={orientation} onChange={(event) => setOrientation(event.target.value as PdfLayoutOptions['orientation'])}><option value="portrait">A4縦</option><option value="landscape">A4横</option></select></label>{layout === 'tiled' && <label>セル寸法<input type="range" min="2" max="10" value={millimeters} onChange={(event) => setMillimeters(Number(event.target.value))} /><output>{millimeters}mm</output></label>}<p>推定 {pages}ページ{pages > 100 && ' — ページ数が多いため1ページ版もご検討ください'}</p><button onClick={() => onPdf(pdfOptions)}>PDFを保存</button>
    <h3>バックアップ</h3><div className="button-grid"><button onClick={() => onBackup(false)}>この編み図</button><button onClick={() => onBackup(true)}>全データ</button><button onClick={onRestore}>復元</button></div><p>{backupNote}</p>
  </div>;
}
