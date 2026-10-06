import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packCell } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import type { ChartDocument } from '../storage/database';
import { DocumentList, type DocumentListProps } from './DocumentList';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** jsdomにはCanvasの描画が無いので、`putImageData`へ渡された画素だけを記録する。 */
const drawn: Array<{ canvas: HTMLCanvasElement; data: number[]; width: number; height: number }> = [];

beforeEach(() => {
  drawn.length = 0;
  globalThis.ImageData ??= class {
    constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
  } as unknown as typeof ImageData;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return {
      putImageData: (image: ImageData) => drawn.push({ canvas: this, data: Array.from(image.data), width: image.width, height: image.height }),
    } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
});

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  vi.restoreAllMocks();
});

const knit = STITCH_BY_KEY.get('knit')!.id;

function chart(id: string, name: string, updatedAt: number, cells: number[] = [0, 0, 0, 0], rows = 2, cols = 2): ChartDocument {
  return { id, name, rows, cols, cells: Uint32Array.from(cells).buffer, createdAt: 0, updatedAt };
}

function render(props: Partial<DocumentListProps> & Pick<DocumentListProps, 'documents'>) {
  const handlers = { onOpen: vi.fn(), onRename: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() };
  container ??= document.body.appendChild(document.createElement('div'));
  root ??= createRoot(container);
  act(() => root!.render(<DocumentList activeId={props.documents[0].id} {...handlers} {...props} />));
  return handlers;
}

describe('DocumentList', () => {
  it('shows a thumbnail, the size and the update time, and reads the name first', () => {
    const updatedAt = Date.now();
    render({ documents: [chart('a', 'ケーブル', updatedAt, [packCell(knit, 0xff_0000), 0, 0, 0]), chart('b', '地模様', updatedAt - 1000)] });
    const items = [...container!.querySelectorAll('li.document')];
    expect(items).toHaveLength(2);
    const open = items[0].querySelector<HTMLButtonElement>('.document-open')!;
    expect(open.getAttribute('aria-label')).toMatch(/^ケーブル、2段×2目、更新 今日 \d{1,2}:\d{2}$/);
    expect(open.getAttribute('aria-current')).toBe('true');
    expect(items[1].querySelector('.document-open')!.hasAttribute('aria-current')).toBe(false);
    expect(items[0].querySelector('time')!.getAttribute('datetime')).toBe(new Date(updatedAt).toISOString());
    expect(items[0].textContent).toContain('2段×2目');

    const canvas = items[0].querySelector('canvas')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect([canvas.width, canvas.height]).toEqual([2, 2]);
    const first = drawn.find((entry) => entry.canvas === canvas)!;
    expect(first.data.slice(0, 4)).toEqual([255, 0, 0, 255]);
    expect(first.data.slice(4, 8)).toEqual([255, 255, 255, 255]);
  });

  it('redraws the thumbnail when the chart is saved with new cells', () => {
    const documents = [chart('a', 'ケーブル', 1)];
    render({ documents });
    const canvas = container!.querySelector('canvas')!;
    expect(drawn.filter((entry) => entry.canvas === canvas).at(-1)!.data.slice(0, 4)).toEqual([255, 255, 255, 255]);

    render({ documents: [chart('a', 'ケーブル', 2, [packCell(knit, 0x00_00ff), 0, 0, 0])] });
    expect(drawn.filter((entry) => entry.canvas === canvas).at(-1)!.data.slice(0, 4)).toEqual([0, 0, 255, 255]);
  });

  it('rewrites today as yesterday when the date changes while the list is open', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 7, 23, 59));
      render({ documents: [chart('a', 'ケーブル', new Date(2026, 9, 7, 23, 0).getTime())] });
      const time = () => container!.querySelector('time')!.textContent;
      expect(time()).toBe('更新 今日 23:00');
      act(() => { vi.advanceTimersByTime(30 * 1000); });
      expect(time()).toBe('更新 今日 23:00');
      act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
      expect(time()).toBe('更新 昨日 23:00');
      expect(container!.querySelector('.document-open')!.getAttribute('aria-label')).toBe('ケーブル、2段×2目、更新 昨日 23:00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rewrites the date when the page becomes visible again after the timer was held back', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 7, 23, 0));
      render({ documents: [chart('a', 'ケーブル', new Date(2026, 9, 7, 22, 0).getTime())] });
      // 中断中にタイマーが進まず、時刻だけが翌日になった状態。
      vi.setSystemTime(new Date(2026, 9, 8, 8, 0));
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(container!.querySelector('time')!.textContent).toBe('更新 昨日 22:00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('scales thumbnails down smoothly only when they are larger than the frame', () => {
    render({ documents: [chart('a', '小さい', 1), chart('b', '枠と同じ', 1, [], 62, 10), chart('c', '大きい', 1, [], 70, 10)] });
    const classes = [...container!.querySelectorAll('canvas')].map((canvas) => canvas.className);
    // 枠より小さい縮小画像はセルの境目をぼかさずに拡大し、枠より大きいものは段や目が抜けないよう滑らかに縮める。
    expect(classes).toEqual(['document-thumbnail', 'document-thumbnail', 'document-thumbnail downscaled']);
  });

  it('wires the open, rename, duplicate and delete buttons, and keeps the last chart from being deleted', () => {
    const only = chart('a', 'ひとつだけ', 1);
    const handlers = render({ documents: [only] });
    const button = (name: string) => container!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    act(() => container!.querySelector<HTMLButtonElement>('.document-open')!.click());
    act(() => button('名前変更').click());
    act(() => button('複製').click());
    expect(handlers.onOpen).toHaveBeenCalledWith(only);
    expect(handlers.onRename).toHaveBeenCalledWith(only);
    expect(handlers.onDuplicate).toHaveBeenCalledWith(only);
    expect(button('削除').disabled).toBe(true);
  });
});
