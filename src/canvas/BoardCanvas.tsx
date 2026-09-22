import { useEffect, useRef } from 'react';
import { Board, cellColor, cellStitchId, colorHex, type PatternBlock, type Point, type Rect } from '../model/Board';
import { STITCH_BY_ID, STITCH_BY_KEY } from '../stitches/catalog';
import { drawGlyph } from '../stitches/glyphs';

export type CanvasMode = 'draw' | 'erase' | 'select' | 'paste';

interface Props {
  board: Board;
  revision: number;
  stitchKey: string;
  color: string;
  mode: CanvasMode;
  selection?: Rect;
  pasteBlock?: PatternBlock;
  onChange: () => void;
  onSelectionChange: (rect?: Rect) => void;
  onPasteComplete: (ok: boolean) => void;
}

interface Viewport { x: number; y: number; cell: number }
interface PointerPosition { x: number; y: number }

const LABEL_SIZE = 28;

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
  const viewportRef = useRef<Viewport>({ x: LABEL_SIZE + 8, y: LABEL_SIZE + 8, cell: 30 });
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const gestureRef = useRef<{ distance: number; center: PointerPosition; viewport: Viewport } | undefined>(undefined);
  const gestureBlockedRef = useRef(false);
  const lastCellRef = useRef<Point | undefined>(undefined);
  const selectionStartRef = useRef<Point | undefined>(undefined);
  const strokeFootprintRef = useRef(new Set<number>());
  // 1本指のタップは指を離すまで確定しない。触れた瞬間に置くと、2本指ジェスチャの
  // 開始時に先に触れた指の位置へ記号が入ってしまうため。
  const pendingTapRef = useRef<Point | undefined>(undefined);
  const propsRef = useRef(props);
  propsRef.current = props;

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
    context.fillStyle = '#f7f4ed';
    context.fillRect(0, 0, width, height);

    const { board, selection, pasteBlock, mode } = propsRef.current;
    const view = viewportRef.current;
    const firstCol = Math.max(0, Math.floor((-view.x + LABEL_SIZE) / view.cell));
    const firstRow = Math.max(0, Math.floor((-view.y + LABEL_SIZE) / view.cell));
    const lastCol = Math.min(board.cols - 1, Math.ceil((width - view.x) / view.cell));
    const lastRow = Math.min(board.rows - 1, Math.ceil((height - view.y) / view.cell));

    for (let row = firstRow; row <= lastRow; row++) {
      const y = view.y + row * view.cell;
      context.fillStyle = row % 2 === 0 ? '#f3f4f0' : '#ffffff';
      context.fillRect(view.x + firstCol * view.cell, y, (lastCol - firstCol + 1) * view.cell, view.cell);
    }
    context.beginPath();
    for (let row = firstRow; row <= lastRow + 1; row++) {
      const y = Math.round(view.y + row * view.cell) + 0.5;
      context.moveTo(view.x + firstCol * view.cell, y);
      context.lineTo(view.x + (lastCol + 1) * view.cell, y);
    }
    for (let col = firstCol; col <= lastCol + 1; col++) {
      const x = Math.round(view.x + col * view.cell) + 0.5;
      context.moveTo(x, view.y + firstRow * view.cell);
      context.lineTo(x, view.y + (lastRow + 1) * view.cell);
    }
    context.strokeStyle = '#c9cec7';
    context.lineWidth = 1;
    context.stroke();

    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        const value = board.valueAt(row, col);
        if (!value) continue;
        const stitch = STITCH_BY_ID.get(cellStitchId(value));
        if (!stitch) continue;
        const x = view.x + col * view.cell;
        const y = view.y + row * view.cell;
        if (stitch.key === 'erase') {
          context.fillStyle = '#fff';
          context.fillRect(x, y, view.cell, view.cell);
          continue;
        }
        drawGlyph(context, stitch.key, x, y, view.cell, colorHex(cellColor(value)));
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

    context.fillStyle = 'rgba(247,244,237,.96)';
    context.fillRect(0, 0, width, LABEL_SIZE);
    context.fillRect(0, 0, LABEL_SIZE, height);
    context.fillStyle = '#53605a';
    context.font = '11px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let col = firstCol; col <= lastCol; col++) {
      context.fillText(String(board.cols - col), view.x + (col + 0.5) * view.cell, LABEL_SIZE / 2);
    }
    for (let row = firstRow; row <= lastRow; row++) {
      context.fillText(String(board.rows - row), LABEL_SIZE / 2, view.y + (row + 0.5) * view.cell);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(requestDraw);
    observer.observe(canvas);
    requestDraw();
    return () => { observer.disconnect(); cancelAnimationFrame(frameRef.current); };
  }, []);

  useEffect(requestDraw, [props.revision, props.selection, props.mode, props.pasteBlock]);

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
        const worldX = (position.x - view.x) / view.cell;
        const worldY = (position.y - view.y) / view.cell;
        const cell = Math.min(72, Math.max(4, view.cell * Math.exp(-event.deltaY * 0.002)));
        viewportRef.current = { x: position.x - worldX * cell, y: position.y - worldY * cell, cell };
      } else {
        viewportRef.current = { ...view, x: view.x - event.deltaX, y: view.y - event.deltaY };
      }
      requestDraw();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const eventPosition = (event: React.PointerEvent<HTMLCanvasElement>): PointerPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const cellAt = (position: PointerPosition): Point => {
    const view = viewportRef.current;
    return { row: Math.floor((position.y - view.y) / view.cell), col: Math.floor((position.x - view.x) / view.cell) };
  };

  const applyStroke = (from: Point, to: Point) => {
    const { board, stitchKey, color } = propsRef.current;
    const stitch = STITCH_BY_KEY.get(stitchKey);
    if (!stitch) return;
    let changed = false;
    for (const point of rasterLine(from, to)) {
      if (!board.inBounds(point.row, point.col)) continue;
      const footprint: number[] = [];
      for (let y = 0; y < stitch.height; y++) for (let x = 0; x < stitch.width; x++) footprint.push(board.index(point.row + y, point.col + x));
      if (footprint.some((index) => strokeFootprintRef.current.has(index))) continue;
      if (board.place(point.row, point.col, stitchKey, color, false)) {
        footprint.forEach((index) => strokeFootprintRef.current.add(index));
        changed = true;
      }
    }
    if (changed) propsRef.current.onChange();
  };

  const applyErase = (from: Point, to: Point) => {
    const { board } = propsRef.current;
    let changed = false;
    for (const point of rasterLine(from, to)) {
      if (board.inBounds(point.row, point.col) && board.clearAt(point.row, point.col)) changed = true;
    }
    if (changed) propsRef.current.onChange();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = eventPosition(event);
    pointersRef.current.set(event.pointerId, position);
    const cell = cellAt(position);
    lastCellRef.current = cell;
    if (pointersRef.current.size === 2) {
      gestureBlockedRef.current = true;
      // 2本目が触れた時点で、1本目の保留タップは取り消す。
      pendingTapRef.current = undefined;
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        viewport: { ...viewportRef.current },
      };
      return;
    }
    if (event.button === 2) {
      if (props.board.clearAt(cell.row, cell.col)) props.onChange();
      return;
    }
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
    if (props.mode === 'paste') {
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
      const nextCell = Math.min(72, Math.max(4, initial.viewport.cell * distance / initial.distance));
      const worldX = (initial.center.x - initial.viewport.x) / initial.viewport.cell;
      const worldY = (initial.center.y - initial.viewport.y) / initial.viewport.cell;
      viewportRef.current = { x: center.x - worldX * nextCell, y: center.y - worldY * nextCell, cell: nextCell };
      requestDraw();
      return;
    }
    if (gestureBlockedRef.current) return;
    if (!pointersRef.current.has(event.pointerId) || !lastCellRef.current) return;
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
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) gestureRef.current = undefined;

    // 1本指で触れて離した場合だけ、保留していたタップを確定する。
    const pendingTap = pendingTapRef.current;
    pendingTapRef.current = undefined;
    if (pendingTap && !gestureBlockedRef.current && event.type !== 'pointercancel') {
      if (props.mode === 'paste' && props.pasteBlock) {
        props.onPasteComplete(props.board.pasteBlock(props.pasteBlock, pendingTap.row, pendingTap.col));
      } else if (props.mode === 'erase') {
        applyErase(pendingTap, pendingTap);
      } else if (props.mode === 'draw') {
        applyStroke(pendingTap, pendingTap);
      }
    }

    if (pointersRef.current.size === 0 && props.mode === 'select' && props.selection) {
      props.onSelectionChange(props.board.normalizeSelection(props.selection));
    }
    if (pointersRef.current.size === 0) {
      gestureBlockedRef.current = false;
      lastCellRef.current = undefined;
      selectionStartRef.current = undefined;
      strokeFootprintRef.current.clear();
    }
    requestDraw();
  };

  return <canvas
    ref={canvasRef}
    className={`board-canvas mode-${props.mode}`}
    aria-label="編み図編集盤面"
    onContextMenu={(event) => event.preventDefault()}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd}
    onPointerCancel={handlePointerEnd}
  />;
}
