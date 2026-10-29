import { useEffect, useLayoutEffect, useRef, useImperativeHandle, type Ref } from 'react';
import { Board, type PatternBlock, type Point, type Rect } from '../model/Board';
import { boardSurface, DEFAULT_BACKGROUND_COLOR } from '../model/boardColors';
import { STITCH_BY_KEY, STITCHES } from '../stitches/catalog';
import { drawCell } from '../stitches/drawCell';
import { labelStride, showsLabel } from '../export/labels';
import { drawGuideLine } from './guideLines';
import { strokeGrid, type GridLineStyle } from './strokeGrid';

export type CanvasMode = 'draw' | 'erase' | 'select' | 'paste' | 'line';

/** 画面の案内と読み上げで使うモード名。 */
export const CANVAS_MODE_LABELS: Record<CanvasMode, string> = {
  line: '線', draw: '描画', erase: '消去', select: '範囲選択', paste: '貼付',
};

/** ホストから盤面の表示だけを変更する。座標を省略すると表示領域の中央。 */
export interface BoardZoom {
  zoom: (factor: number, clientPosition?: { x: number; y: number }) => void;
}

export const BOARD_ZOOM_FACTOR = 1.25;

interface Props {
  zoomRef?: Ref<BoardZoom>;
  board: Board;
  /** 盤面の地の色（`#rrggbb`）。縞と罫線の色もここから作る。 */
  background?: string;
  revision: number;
  stitchKey: string;
  color: string;
  mode: CanvasMode;
  selection?: Rect;
  pasteBlock?: PatternBlock;
  /** 盤面を書き換えるたびに呼ぶ。なぞり描きでは1筆の間に何度も呼ばれる。 */
  onChange: () => void;
  /** すべての指を離したときに呼ぶ。直前の`onChange`までを元に戻す単位にまとめる。 */
  onEditEnd?: () => void;
  onSelectionChange: (rect?: Rect) => void;
  onPasteComplete: (ok: boolean) => void;
}

export interface Viewport { x: number; y: number; cell: number }
interface PointerPosition { x: number; y: number }

export const LABEL_SIZE = 28;
const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 72;
const clampCellSize = (cell: number) => Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, cell));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 指定位置にあるマス内の点を固定したまま倍率を変える。 */
export function zoomViewportAt(view: Viewport, position: PointerPosition, factor: number): Viewport {
  if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return view;
  const cell = clampCellSize(view.cell * factor);
  return {
    x: position.x - (position.x - view.x) / view.cell * cell,
    y: position.y - (position.y - view.y) / view.cell * cell,
    cell,
  };
}

/**
 * 盤面の位置を、端のマスの中心が表示領域（段・目の番号の帯を除いた部分）の中央に来るところまでに収める。
 * 盤面を画面の外へ動かして見失うことはなく、端のマスは中央に置いて編集できる。
 * 盤面が表示領域より小さいときも同じ規則にし、画面の端に張り付いて動かせなくならないようにする。
 */
export function clampViewport(view: Viewport, board: Pick<Board, 'rows' | 'cols'>, canvas: { width: number; height: number }, band = LABEL_SIZE): Viewport {
  const areaWidth = canvas.width - band;
  const areaHeight = canvas.height - band;
  // 配置前や非表示で大きさが無いときは、中央を決められないので位置を変えない。
  if (areaWidth <= 0 || areaHeight <= 0) return view;
  const centerX = band + areaWidth / 2;
  const centerY = band + areaHeight / 2;
  const x = clamp(view.x, centerX - (board.cols - 0.5) * view.cell, centerX - 0.5 * view.cell);
  const y = clamp(view.y, centerY - (board.rows - 0.5) * view.cell, centerY - 0.5 * view.cell);
  return x === view.x && y === view.y ? view : { ...view, x, y };
}
type CanvasLayout = { width: number; height: number; windowWidth: number; windowHeight: number };

/**
 * ウィンドウが変わった場合だけ、キャンバス右下から編み始めまでの距離を保つ。
 * 縮小して右や下に空きがある盤面は、狭くなった画面では同じ距離の空きが大きな割合を占め、
 * 盤面の左や上が画面の外へ押し出される。その場合は狭くなった分までの空きを使って隠れた側を見せる。
 */
export function resizeViewport(view: Viewport, previous: CanvasLayout, next: CanvasLayout, board: Pick<Board, 'rows' | 'cols'>, band = LABEL_SIZE): Viewport {
  if (previous.windowWidth === next.windowWidth && previous.windowHeight === next.windowHeight) return view;
  if (previous.width === next.width && previous.height === next.height) return view;
  const x = view.x + next.width - previous.width;
  const y = view.y + next.height - previous.height;
  return {
    ...view,
    x: x + revealHiddenStart(x, board.cols * view.cell, previous.width, next.width, band),
    y: y + revealHiddenStart(y, board.rows * view.cell, previous.height, next.height, band),
  };
}

/**
 * 狭くなった向きで、盤面の始端が帯の外側の余白（初期配置と同じ8px）より外に出た分を、
 * 終端側の空きの範囲で戻す量。広がった向きや大きさが同じ向きは、利用者の表示位置を変えない。
 */
function revealHiddenStart(start: number, length: number, previousSize: number, size: number, band: number): number {
  const hidden = band + 8 - start;
  const gap = size - 8 - (start + length);
  return size < previousSize && hidden > 0 && gap > 0 ? Math.min(hidden, gap, previousSize - size) : 0;
}

/** 初回は倍率を変えず、編み始めの右下まで見える位置に寄せる。 */
export function initialViewport(cell: number, board: Pick<Board, 'rows' | 'cols'>, canvas: { width: number; height: number }, band = LABEL_SIZE): Viewport {
  return clampViewport({
    x: Math.min(band + 8, canvas.width - 8 - board.cols * cell),
    y: Math.min(band + 8, canvas.height - 8 - board.rows * cell),
    cell,
  }, board, canvas, band);
}

/**
 * 画面の罫線。10目・10段ごとの太線は、拡大しているときは太く、縮小しているときは濃さだけで区別する。
 * 最小の4pxまで縮小しても濃さで見分けられるので、通常の線も残してマスを数えられるようにする。
 * 線の色は地の色から作り、暗い地では地より明るい線にする。
 */
export function boardGridStyles(cell: number, background: string = DEFAULT_BACKGROUND_COLOR): { minor: GridLineStyle; major: GridLineStyle } {
  const surface = boardSurface(background, 'screen');
  return {
    minor: { color: surface.minorLine, width: 1 },
    major: { color: surface.majorLine, width: cell >= 12 ? 2 : 1 },
  };
}

/**
 * 番号の文字と帯の幅。帯は文字に合わせて広げるが、既定の1.5倍で止める。
 * 止めたときは、最も長い段番号（labelWidthは既定の文字の大きさで測った幅）が帯に収まるまで文字を縮める。
 */
export function canvasLabelMetrics(rootFontSize: number, labelWidth = 0) {
  const fontSize = 11 * rootFontSize / 16;
  const band = Math.min(LABEL_SIZE * 1.5, Math.max(LABEL_SIZE * rootFontSize / 16, labelWidth + 8));
  return { fontSize: labelWidth + 8 > band ? fontSize * (band - 8) / labelWidth : fontSize, band };
}

/**
 * 実際の文字幅は大きさに正確には比例しないので、縮めた大きさで測り直し、
 * 最も長い段番号の幅に8pxを足しても帯を超えなくなるまで縮める。
 */
export function fitCanvasLabels(rootFontSize: number, measure: (fontSize: number) => number) {
  const metrics = canvasLabelMetrics(rootFontSize, measure(canvasLabelMetrics(rootFontSize).fontSize));
  let fontSize = metrics.fontSize;
  for (let attempt = 0; attempt < 8; attempt++) {
    const width = measure(fontSize);
    if (width + 8 <= metrics.band) break;
    fontSize = Math.min(fontSize * (metrics.band - 8) / width, fontSize - 0.25);
  }
  return { fontSize, band: metrics.band };
}

export function canvasCellAt(position: PointerPosition, view: Viewport, band = LABEL_SIZE): Point | undefined {
  if (position.x < band || position.y < band) return undefined;
  return { row: Math.floor((position.y - view.y) / view.cell), col: Math.floor((position.x - view.x) / view.cell) };
}

export function canvasLabels(total: number, first: number, last: number, origin: number, cell: number, extent: number, band: number, limit: number) {
  const stride = labelStride(cell, extent, 4);
  const labels: { number: number; position: number }[] = [];
  for (let index = first; index <= last; index++) {
    const number = total - index;
    const position = origin + (index + 0.5) * cell;
    if (showsLabel(number, stride) && position - extent / 2 >= band && position + extent / 2 <= limit) labels.push({ number, position });
  }
  return labels;
}

// 複数セルを占める記号は、起点セルが表示範囲の外にあっても一部が画面へかかる。
// 起点の探索範囲を最大記号の寸法だけ広げ、端で記号が丸ごと消えないようにする。
const MAX_STITCH_WIDTH = Math.max(...STITCHES.map((stitch) => stitch.width));
const MAX_STITCH_HEIGHT = Math.max(...STITCHES.map((stitch) => stitch.height));

export function glyphSearchStart(firstRow: number, firstCol: number): Point {
  return {
    row: Math.max(0, firstRow - MAX_STITCH_HEIGHT + 1),
    col: Math.max(0, firstCol - MAX_STITCH_WIDTH + 1),
  };
}

/** マスの外側と段・目番号の帯の色。端末の外観で変わるので、共通CSSの変数から読む。 */
export interface CanvasChrome { surround: string; labelBand: string; label: string }

export const LIGHT_CANVAS_CHROME: CanvasChrome = { surround: '#f7f4ed', labelBand: 'rgba(247,244,237,.96)', label: '#53605a' };

/** 共通CSS（`--canvas-*`）の色を読む。変数が無いとき（テストなど）は明るい配色の色を使う。 */
export function readCanvasChrome(element: Element = document.documentElement): CanvasChrome {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    surround: read('--canvas-surround', LIGHT_CANVAS_CHROME.surround),
    labelBand: read('--canvas-label-band', LIGHT_CANVAS_CHROME.labelBand),
    label: read('--canvas-label', LIGHT_CANVAS_CHROME.label),
  };
}

function rasterLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  let x0 = from.col, y0 = from.row;
  const x1 = to.col, y1 = to.row;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ row: y0, col: x0 });
    if (x0 === x1 && y0 === y1) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
  }
  return points;
}

export function BoardCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const canvasSizeRef = useRef<CanvasLayout | undefined>(undefined);
  const keyboardResizeRef = useRef(false);
  const viewportRef = useRef<Viewport>({ x: LABEL_SIZE + 8, y: LABEL_SIZE + 8, cell: 30 });
  const initializedBoardRef = useRef<Board | undefined>(undefined);
  const initialViewportRecoveryRef = useRef<{ width: number; height: number } | undefined>(undefined);
  const pointerButtonsRef = useRef(new Map<number, number>());
  const strokeStartedRef = useRef(false);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const gestureRef = useRef<{ distance: number; center: PointerPosition; viewport: Viewport } | undefined>(undefined);
  const gestureBlockedRef = useRef(false);
  const lastCellRef = useRef<Point | undefined>(undefined);
  const selectionStartRef = useRef<Point | undefined>(undefined);
  const strokeFootprintRef = useRef(new Set<number>());
  // 1本指のタップは指を離すまで確定しない。触れた瞬間に置くと、2本指ジェスチャの
  // 開始時に先に触れた指の位置へ記号が入ってしまうため。
  const lineStartRef = useRef<Point | undefined>(undefined);
  const lineDragRef = useRef<Point | undefined>(undefined);
  const pendingTapRef = useRef<Point | undefined>(undefined);
  const provisionalRef = useRef<Board | undefined>(undefined);
  const touchChangedRef = useRef(false);
  const touchOriginRef = useRef<{ board: Board; revision: number } | undefined>(undefined);
  const previousSelectionRef = useRef<Rect | undefined>(undefined);
  const bandRef = useRef(LABEL_SIZE);
  const propsRef = useRef(props);
  propsRef.current = props;
  // 描くたびに計算済みスタイルを読まないよう、外観が変わったときだけ読み直す。
  const chromeRef = useRef<CanvasChrome>(LIGHT_CANVAS_CHROME);

  /** 番号の文字の大きさと帯の幅。最も長い段番号を実際の文字で測って決める。 */
  const measureLabels = (context: CanvasRenderingContext2D, rows: number) => {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return fitCanvasLabels(rootFontSize, (size) => {
      context.font = `${size}px system-ui`;
      return context.measureText(String(rows)).width;
    });
  };

  /**
   * 初めて表示する編み図を、表示領域の大きさが分かった時点で編み始めの右下が見える位置に置く。
   * 一時的に縮んだ領域で置いた場合だけ、利用者が動かす前の復帰時に一度置き直す。
   */
  const placeInitialViewport = (width: number, height: number, band: number) => {
    const board = propsRef.current.board;
    if (initializedBoardRef.current === board || width <= band || height <= band) return;
    const previous = canvasSizeRef.current;
    // キーボード中はkeyboardResizeRefにより縮む前のサイズが残る。上書き前に比較し、
    // innerHeightとcanvasのどちらが先に戻っても、canvas自体の復帰を待つ。
    initialViewportRecoveryRef.current = previous && (width < previous.width || height < previous.height)
      ? { width: previous.width, height: previous.height } : undefined;
    viewportRef.current = initialViewport(viewportRef.current.cell, board, { width, height }, band);
    initializedBoardRef.current = board;
    canvasSizeRef.current = { width, height, windowWidth: window.innerWidth, windowHeight: window.innerHeight };
  };

  const requestDraw = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(draw);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const chrome = chromeRef.current;
    context.fillStyle = chrome.surround;
    context.fillRect(0, 0, width, height);

    const { selection, pasteBlock, mode, background = DEFAULT_BACKGROUND_COLOR } = propsRef.current;
    const board = provisionalRef.current ?? propsRef.current.board;
    const { fontSize, band } = measureLabels(context, board.rows);
    context.font = `${fontSize}px system-ui`;
    const colExtent = context.measureText(String(board.cols)).width;
    bandRef.current = band;
    const surface = boardSurface(background, 'screen');
    // 画面の大きさ（回転・可変ウィンドウ）や段数・列数、編み図が変わると、
    // 今の位置が範囲の外になることがあるので、描くたびに範囲へ戻す。
    placeInitialViewport(width, height, band);
    const next = { width, height, windowWidth: window.innerWidth, windowHeight: window.innerHeight };
    const previous = canvasSizeRef.current;
    const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]') ?? false;
    // WKWebViewのキーボードはinnerHeightも縮める。閉じる途中のblur後も元の高さまで待ち、
    // 一時的なclampでpan位置が失われるのを防ぐ。幅が変わる回転等は通常のリサイズに戻す。
    keyboardResizeRef.current = !!previous && previous.windowWidth === next.windowWidth
      && next.windowHeight < previous.windowHeight && (editing || keyboardResizeRef.current);
    if (!keyboardResizeRef.current) {
      if (width > band && height > band) {
        if (previous) {
          const recovery = initialViewportRecoveryRef.current;
          if (recovery && width >= recovery.width && height >= recovery.height) {
            viewportRef.current = initialViewport(viewportRef.current.cell, board, { width, height }, band);
            initialViewportRecoveryRef.current = undefined;
          } else {
            viewportRef.current = resizeViewport(viewportRef.current, previous, next, board, band);
          }
        }
        canvasSizeRef.current = next;
      }
      viewportRef.current = clampViewport(viewportRef.current, board, { width, height }, band);
    }
    const view = viewportRef.current;
    const firstCol = Math.max(0, Math.floor((-view.x + band) / view.cell));
    const firstRow = Math.max(0, Math.floor((-view.y + band) / view.cell));
    const lastCol = Math.min(board.cols - 1, Math.ceil((width - view.x) / view.cell));
    const lastRow = Math.min(board.rows - 1, Math.ceil((height - view.y) / view.cell));

    for (let row = firstRow; row <= lastRow; row++) {
      const y = view.y + row * view.cell;
      context.fillStyle = row % 2 === 0 ? surface.stripe : surface.background;
      context.fillRect(view.x + firstCol * view.cell, y, (lastCol - firstCol + 1) * view.cell, view.cell);
    }
    const grid = boardGridStyles(view.cell, background);
    strokeGrid(context, { x: view.x, y: view.y, cell: view.cell, rows: board.rows, cols: board.cols, firstRow, lastRow, firstCol, lastCol }, grid.minor, grid.major);

    const { row: firstGlyphRow, col: firstGlyphCol } = glyphSearchStart(firstRow, firstCol);
    for (let row = firstGlyphRow; row <= lastRow; row++) {
      for (let col = firstGlyphCol; col <= lastCol; col++) {
        const value = board.valueAt(row, col);
        if (value) drawCell(context, value, view.x + col * view.cell, view.y + row * view.cell, view.cell);
      }
    }

    for (const line of board.lines) {
      if (line.col < firstCol || line.col > lastCol || line.bottom < firstRow || line.top > lastRow) continue;
      drawGuideLine(context, view.x + (line.col + 0.5) * view.cell, view.y + (line.top + 1) * view.cell, view.y + line.bottom * view.cell, view.cell, background);
    }
    if (mode === 'line') {
      const start = lineDragRef.current ?? lineStartRef.current;
      if (start) {
        context.fillStyle = 'rgba(45, 125, 72, .2)';
        context.strokeStyle = '#2d7d48';
        context.lineWidth = 2;
        context.fillRect(view.x + start.col * view.cell, view.y + start.row * view.cell, view.cell, view.cell);
        context.strokeRect(view.x + start.col * view.cell, view.y + start.row * view.cell, view.cell, view.cell);
        const end = lineDragRef.current && lastCellRef.current;
        if (end && end.row >= start.row + 2) drawGuideLine(context, view.x + (start.col + 0.5) * view.cell, view.y + (start.row + 1) * view.cell, view.y + end.row * view.cell, view.cell, background);
      }
    }

    const preview = mode === 'paste' && pasteBlock && lastCellRef.current
      ? { top: lastCellRef.current.row, left: lastCellRef.current.col, bottom: lastCellRef.current.row + pasteBlock.rows - 1, right: lastCellRef.current.col + pasteBlock.cols - 1 }
      : selection;
    if (preview) {
      const valid = preview.top >= 0 && preview.left >= 0 && preview.bottom < board.rows && preview.right < board.cols;
      context.fillStyle = valid ? 'rgba(45, 125, 72, .18)' : 'rgba(190, 50, 50, .2)';
      context.strokeStyle = valid ? '#2d7d48' : '#bf3232';
      context.lineWidth = 2;
      const x = view.x + preview.left * view.cell;
      const y = view.y + preview.top * view.cell;
      const rectWidth = (preview.right - preview.left + 1) * view.cell;
      const rectHeight = (preview.bottom - preview.top + 1) * view.cell;
      context.fillRect(x, y, rectWidth, rectHeight);
      context.strokeRect(x, y, rectWidth, rectHeight);
    }

    context.fillStyle = chrome.labelBand;
    context.fillRect(0, 0, width, band);
    context.fillRect(0, 0, band, height);
    context.fillStyle = chrome.label;
    context.font = `${fontSize}px system-ui`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const label of canvasLabels(board.cols, firstCol, lastCol, view.x, view.cell, colExtent, band, width)) {
      context.fillText(String(label.number), label.position, band / 2);
    }
    for (const label of canvasLabels(board.rows, firstRow, lastRow, view.y, view.cell, fontSize, band, height)) {
      context.fillText(String(label.number), band / 2, label.position);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(requestDraw);
    observer.observe(canvas);
    observer.observe(document.documentElement);
    window.addEventListener('resize', requestDraw);
    const fontObserver = new MutationObserver(requestDraw);
    fontObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    const updateChrome = () => { chromeRef.current = readCanvasChrome(); requestDraw(); };
    updateChrome();
    scheme?.addEventListener?.('change', updateChrome);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', requestDraw);
      fontObserver.disconnect();
      scheme?.removeEventListener?.('change', updateChrome);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // 初期位置は最初の描画（次のフレーム）を待たずに決める。描画より先に届いたスクロールや
  // タッチが、後から初期位置で上書きされて失われたり、違うマスに入ったりしないようにする。
  // 表示前で大きさが無いときは、描画のたびに置き直しを試みる。
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || initializedBoardRef.current === props.board || !canvas.clientWidth || !canvas.clientHeight) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const { band } = measureLabels(context, props.board.rows);
    bandRef.current = band;
    placeInitialViewport(canvas.clientWidth, canvas.clientHeight, band);
  }, [props.board]);

  useEffect(() => {
    lineStartRef.current = undefined;
    lineDragRef.current = undefined;
    pendingTapRef.current = undefined;
    requestDraw();
  }, [props.mode, props.board]);

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      lineStartRef.current = undefined;
      lineDragRef.current = undefined;
      pendingTapRef.current = undefined;
      requestDraw();
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);

  useEffect(() => {
    const origin = touchOriginRef.current;
    if (origin && (origin.board !== props.board || origin.revision !== props.revision)) {
      provisionalRef.current = undefined;
      touchChangedRef.current = false;
    }
  }, [props.board, props.revision]);

  useEffect(requestDraw, [props.board, props.background, props.revision, props.selection, props.mode, props.pasteBlock]);

  /** 移動・拡大の結果を範囲に収めて反映する。 */
  const setViewport = (next: Viewport) => {
    const canvas = canvasRef.current;
    initialViewportRecoveryRef.current = undefined;
    viewportRef.current = canvas
      ? clampViewport(next, propsRef.current.board, { width: canvas.clientWidth, height: canvas.clientHeight }, bandRef.current)
      : next;
    requestDraw();
  };

  useImperativeHandle(props.zoomRef, () => ({
    zoom(factor, clientPosition) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // client座標を盤面内へ変換する。道具列など盤面の外の位置は受け付けない。
      if (clientPosition && (clientPosition.x < rect.left || clientPosition.x >= rect.right || clientPosition.y < rect.top || clientPosition.y >= rect.bottom)) return;
      const position = clientPosition
        ? { x: clientPosition.x - rect.left, y: clientPosition.y - rect.top }
        : { x: (bandRef.current + canvas.clientWidth) / 2, y: (bandRef.current + canvas.clientHeight) / 2 };
      setViewport(zoomViewportAt(viewportRef.current, position, factor));
    },
  }), []);

  // ReactのonWheelはpassiveで登録されるためpreventDefaultが効かず、
  // トラックパッドのピンチが盤面ではなくページ全体を拡大してしまう。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const position = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const view = viewportRef.current;
      if (event.ctrlKey || event.metaKey) {
        setViewport(zoomViewportAt(view, position, Math.exp(-event.deltaY * 0.002)));
      } else {
        setViewport({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY });
      }
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const eventPosition = (event: React.PointerEvent<HTMLCanvasElement>): PointerPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const cellAt = (position: PointerPosition) => canvasCellAt(position, viewportRef.current, bandRef.current);

  const changed = () => {
    if (provisionalRef.current) touchChangedRef.current = true;
    else propsRef.current.onChange();
  };

  const touchIsCurrent = () => {
    const origin = touchOriginRef.current;
    return !origin || (origin.board === propsRef.current.board && origin.revision === propsRef.current.revision);
  };

  // ピンチになる可能性のある接触だけでは、盤面全体を複製しない。
  const editableBoard = () => {
    if (touchOriginRef.current && !provisionalRef.current) {
      const board = touchOriginRef.current.board;
      provisionalRef.current = new Board(board.rows, board.cols, board.cells, board.lines);
    }
    return provisionalRef.current ?? propsRef.current.board;
  };

  const resetGesture = () => {
    const [a, b] = [...pointersRef.current.values()];
    gestureRef.current = a && b ? {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      viewport: { ...viewportRef.current },
    } : undefined;
  };

  const applyStroke = (from: Point, to: Point) => {
    if (!touchIsCurrent()) return;
    const { stitchKey, color } = propsRef.current;
    const board = provisionalRef.current ?? propsRef.current.board;
    const stitch = STITCH_BY_KEY.get(stitchKey);
    if (!stitch) return;
    let changed = false;
    for (const point of rasterLine(from, to)) {
      if (!board.inBounds(point.row, point.col)) continue;
      const footprint: number[] = [];
      for (let y = 0; y < stitch.height; y++) for (let x = 0; x < stitch.width; x++) footprint.push(board.index(point.row + y, point.col + x));
      if (footprint.some((index) => strokeFootprintRef.current.has(index))) continue;
      if (point.row + stitch.height > board.rows || point.col + stitch.width > board.cols) continue;
      if (editableBoard().place(point.row, point.col, stitchKey, color, false)) {
        footprint.forEach((index) => strokeFootprintRef.current.add(index));
        changed = true;
      }
    }
    if (changed) {
      if (provisionalRef.current) touchChangedRef.current = true;
      else propsRef.current.onChange();
    }
  };

  const applyErase = (from: Point, to: Point) => {
    if (!touchIsCurrent()) return;
    const board = provisionalRef.current ?? propsRef.current.board;
    let changed = false;
    for (const point of rasterLine(from, to)) {
      if (!board.inBounds(point.row, point.col)) continue;
      const current = provisionalRef.current ?? board;
      if (current.ownerAt(point.row, point.col) < 0 && !current.lineThrough(point.row, point.col)) continue;
      const target = editableBoard();
      const erasedLine = target.eraseLinesAt(point.row, point.col);
      if (target.clearAt(point.row, point.col) || erasedLine) changed = true;
    }
    if (changed) {
      if (provisionalRef.current) touchChangedRef.current = true;
      else propsRef.current.onChange();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = eventPosition(event);
    pointersRef.current.set(event.pointerId, position);
    pointerButtonsRef.current.set(event.pointerId, event.button);
    resetGesture();
    const cell = cellAt(position);
    lastCellRef.current = cell;
    if (pointersRef.current.size === 2) {
      gestureBlockedRef.current = true;
      // 2本目が触れた時点で、1本目の保留タップは取り消す。
      pendingTapRef.current = undefined;
      lineDragRef.current = undefined;
      provisionalRef.current = undefined;
      touchChangedRef.current = false;
      if (props.mode === 'select') props.onSelectionChange(previousSelectionRef.current);
      selectionStartRef.current = undefined;
      requestDraw();
      return;
    }
    if (pointersRef.current.size !== 1 || gestureBlockedRef.current) return;
    previousSelectionRef.current = props.selection;
    if (!cell) return;
    strokeStartedRef.current = true;
    if (event.pointerType === 'touch' && (props.mode === 'draw' || props.mode === 'erase')) {
      touchOriginRef.current = { board: props.board, revision: props.revision };
      touchChangedRef.current = false;
    }
    if (event.button === 2) {
      if (props.board.ownerAt(cell.row, cell.col) >= 0 && editableBoard().clearAt(cell.row, cell.col)) changed();
      return;
    }
    if (props.mode === 'line' && !props.board.inBounds(cell.row, cell.col)) return;
    if (props.mode === 'select') {
      if (!props.board.inBounds(cell.row, cell.col)) {
        props.onSelectionChange(undefined);
        requestDraw();
        return;
      }
      selectionStartRef.current = cell;
      props.onSelectionChange({ top: cell.row, left: cell.col, bottom: cell.row, right: cell.col });
    } else {
      if (props.mode !== 'paste') strokeFootprintRef.current.clear();
      pendingTapRef.current = cell;
    }
    requestDraw();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const position = eventPosition(event);
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, position);
    const cell = cellAt(position);
    if (props.mode === 'paste' && !gestureBlockedRef.current) {
      lastCellRef.current = cell;
      // 貼り付けはプレビューの位置で確定させる。
      if (pendingTapRef.current) pendingTapRef.current = cell;
      requestDraw();
    }
    if (pointersRef.current.size >= 2 && gestureRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const initial = gestureRef.current;
      const nextCell = clampCellSize(initial.viewport.cell * distance / initial.distance);
      const worldX = (initial.center.x - initial.viewport.x) / initial.viewport.cell;
      const worldY = (initial.center.y - initial.viewport.y) / initial.viewport.cell;
      setViewport({ x: center.x - worldX * nextCell, y: center.y - worldY * nextCell, cell: nextCell });
      return;
    }
    if (gestureBlockedRef.current) return;
    if (!pointersRef.current.has(event.pointerId)) return;
    // 描くモードの右ボタンは押したマスを消すだけで、押したまま動かしても何もしない。
    if (props.mode === 'draw' && pointerButtonsRef.current.get(event.pointerId) === 2) return;
    if (!cell) {
      lastCellRef.current = undefined;
      pendingTapRef.current = undefined;
      return;
    }
    if (!lastCellRef.current) {
      if (!selectionStartRef.current && !strokeStartedRef.current) return;
      lastCellRef.current = cell;
    }
    if (props.mode === 'line' && pendingTapRef.current) {
      const start = pendingTapRef.current;
      if (cell.row !== start.row || cell.col !== start.col) lineDragRef.current = start;
    }
    if (props.mode === 'select' && selectionStartRef.current) {
      const start = selectionStartRef.current;
      props.onSelectionChange({ top: start.row, left: start.col, bottom: cell.row, right: cell.col });
    } else if (props.mode === 'draw') {
      pendingTapRef.current = undefined;
      applyStroke(lastCellRef.current, cell);
    } else if (props.mode === 'erase') {
      pendingTapRef.current = undefined;
      applyErase(lastCellRef.current, cell);
    }
    lastCellRef.current = cell;
    requestDraw();
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const button = pointerButtonsRef.current.get(event.pointerId);
    pointerButtonsRef.current.delete(event.pointerId);
    pointersRef.current.delete(event.pointerId);
    resetGesture();

    // 1本指で触れて離した場合だけ、保留していたタップを確定する。
    const pendingTap = cellAt(eventPosition(event)) ? pendingTapRef.current : undefined;
    pendingTapRef.current = undefined;
    if (pendingTap && button !== 2 && !gestureBlockedRef.current && event.type !== 'pointercancel') {
      if (props.mode === 'line') {
        const end = cellAt(eventPosition(event));
        const drag = lineDragRef.current;
        const start = drag ?? lineStartRef.current;
        if (drag && end) {
          if (props.board.addLine(drag.col, drag.row, end.row)) props.onChange();
          lineStartRef.current = undefined;
        } else if (start && start.col === pendingTap.col && pendingTap.row >= start.row + 2) {
          if (props.board.addLine(start.col, start.row, pendingTap.row)) props.onChange();
          lineStartRef.current = undefined;
        } else if (props.board.eraseLinesAt(pendingTap.row, pendingTap.col)) {
          props.onChange();
          lineStartRef.current = undefined;
        } else {
          lineStartRef.current = start?.row === pendingTap.row && start.col === pendingTap.col ? undefined : pendingTap;
        }
      } else if (props.mode === 'paste' && props.pasteBlock) {
        props.onPasteComplete(props.board.pasteBlock(props.pasteBlock, pendingTap.row, pendingTap.col));
      } else if (props.mode === 'erase') {
        applyErase(pendingTap, pendingTap);
      } else if (props.mode === 'draw') {
        applyStroke(pendingTap, pendingTap);
      }
    }

    if (pointersRef.current.size === 0 && !gestureBlockedRef.current && selectionStartRef.current && props.mode === 'select' && props.selection) {
      // pointermoveのReact更新より先にpointerupが届いても、離した位置まで選択する。
      // 数字帯やキャンセルでは、これまでと同じく最後に反映された範囲を使う。
      const end = event.type === 'pointerup' ? cellAt(eventPosition(event)) : undefined;
      const start = selectionStartRef.current;
      const selection = end
        ? { top: start.row, left: start.col, bottom: end.row, right: end.col }
        : props.selection;
      props.onSelectionChange(props.board.normalizeSelection(selection));
    }
    if (pointersRef.current.size === 0) {
      if (provisionalRef.current && touchChangedRef.current && touchIsCurrent() && event.type !== 'pointercancel') {
        const temporary = provisionalRef.current;
        props.board.restore(temporary.rows, temporary.cols, temporary.cells, temporary.lines);
        props.onChange();
      }
      lineDragRef.current = undefined;
      provisionalRef.current = undefined;
      touchChangedRef.current = false;
      touchOriginRef.current = undefined;
      props.onEditEnd?.();
      gestureBlockedRef.current = false;
      strokeStartedRef.current = false;
      lastCellRef.current = undefined;
      selectionStartRef.current = undefined;
      strokeFootprintRef.current.clear();
    }
    requestDraw();
  };

  const modeLabel = CANVAS_MODE_LABELS[props.mode];
  const selectionLabel = props.selection
    ? `選択範囲は${props.selection.bottom - props.selection.top + 1}段、${props.selection.right - props.selection.left + 1}目`
    : '選択範囲なし';

  return <>
    <p id="board-instructions" className="visually-hidden">盤面をタップまたはドラッグして編集します。2本指またはトラックパッドで移動・拡大できます。現在は{modeLabel}モードです。</p>
    <canvas
      ref={canvasRef}
      className={`board-canvas mode-${props.mode}`}
      role="region"
      aria-label={`編み図編集盤面。${props.board.rows}段、${props.board.cols}目。記号${props.board.occupiedStitchCount}個。${modeLabel}モード。${selectionLabel}`}
      aria-describedby="board-instructions"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    />
  </>;
}
