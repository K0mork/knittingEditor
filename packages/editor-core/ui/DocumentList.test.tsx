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
  vi.unstubAllGlobals();
});

const knit = STITCH_BY_KEY.get('knit')!.id;

function chart(id: string, name: string, updatedAt: number, cells: number[] = [0, 0, 0, 0], rows = 2, cols = 2): ChartDocument {
  return { id, name, rows, cols, cells: Uint32Array.from(cells).buffer, createdAt: 0, updatedAt };
}

function render(props: Partial<DocumentListProps> & Pick<DocumentListProps, 'documents'>) {
  const handlers = { onOpen: vi.fn(), onRename: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn(), onDeleteMany: vi.fn() };
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
    act(() => button('ひとつだけの名称を変更').click());
    act(() => button('ひとつだけを複製').click());
    expect(handlers.onOpen).toHaveBeenCalledWith(only);
    expect(handlers.onRename).toHaveBeenCalledWith(only);
    expect(handlers.onDuplicate).toHaveBeenCalledWith(only);
    expect(button('ひとつだけを削除').disabled).toBe(true);
  });

  it('names each action button with its visible text and the chart it acts on', () => {
    const documents = [chart('a', 'ケーブル', 1), chart('b', '地模様', 1)];
    const handlers = render({ documents });
    const actions = (index: number) => [...container!.querySelectorAll('li.document')[index].querySelectorAll<HTMLButtonElement>('.document-actions button')]
      .map((button) => ({ text: button.textContent, name: button.getAttribute('aria-label') }));
    expect(actions(0)).toEqual([
      { text: '名称', name: 'ケーブルの名称を変更' },
      { text: '複製', name: 'ケーブルを複製' },
      { text: '削除', name: 'ケーブルを削除' },
    ]);
    expect(actions(1)).toEqual([
      { text: '名称', name: '地模様の名称を変更' },
      { text: '複製', name: '地模様を複製' },
      { text: '削除', name: '地模様を削除' },
    ]);
    // 表示の文字を読み上げ名に含め、音声コントロールで表示どおりに呼んでも押せるようにする。
    for (const { text, name } of [...actions(0), ...actions(1)]) expect(name).toContain(text);

    const button = (name: string) => container!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    act(() => button('地模様の名称を変更').click());
    act(() => button('ケーブルを複製').click());
    act(() => button('地模様を削除').click());
    expect(handlers.onRename).toHaveBeenCalledWith(documents[1]);
    expect(handlers.onDuplicate).toHaveBeenCalledWith(documents[0]);
    expect(handlers.onDelete).toHaveBeenCalledWith(documents[1]);

    // 名前を変えると、ボタンの読み上げ名も新しい名前になる。
    render({ documents: [chart('a', 'ケーブル', 1), chart('b', '縄編み', 2)] });
    expect(actions(1).map(({ name }) => name)).toEqual(['縄編みの名称を変更', '縄編みを複製', '縄編みを削除']);
    expect(container!.querySelector('button[aria-label^="地模様"]')).toBeNull();
  });

  it('selects charts with checkboxes and deletes them together, keeping at least one', () => {
    const documents = [chart('a', 'ケーブル', 3), chart('b', '地模様', 2), chart('c', '縄編み', 1)];
    const handlers = render({ documents });
    const checkbox = (name: string) => container!.querySelector<HTMLInputElement>(`input[type="checkbox"][aria-label="${name}を選ぶ"]`)!;
    const bar = () => container!.querySelector<HTMLElement>('[role="group"][aria-label="選んだ編み図"]');
    const barButton = (text: string) => [...bar()!.querySelectorAll('button')].find((button) => button.textContent === text)!;
    expect(container!.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    // 何も選んでいないときは、まとめて削除するバーを出さない。
    expect(bar()).toBeNull();

    act(() => checkbox('ケーブル').click());
    act(() => checkbox('縄編み').click());
    expect(checkbox('ケーブル').checked).toBe(true);
    expect(checkbox('地模様').checked).toBe(false);
    expect(bar()!.querySelector('p')!.textContent).toBe('2件を選択中');
    act(() => barButton('2件を削除').click());
    expect(handlers.onDeleteMany).toHaveBeenCalledWith([documents[0], documents[2]]);

    // 全件を選ぶと、1件は残すので削除できない。
    act(() => checkbox('地模様').click());
    expect(bar()!.querySelector('p')!.textContent).toBe('3件を選択中。1件は残してください');
    expect(barButton('3件を削除').disabled).toBe(true);

    // 削除などで一覧から消えた編み図は、選んだ件数に数えない。
    render({ documents: [documents[1]] });
    expect(bar()!.querySelector('p')!.textContent).toBe('1件を選択中。1件は残してください');
    render({ documents: [documents[1], chart('d', '新しい編み図', 4)] });
    expect(barButton('1件を削除').disabled).toBe(false);

    act(() => barButton('選択を解除').click());
    expect(bar()).toBeNull();
    expect(checkbox('地模様').checked).toBe(false);
  });
});

it('defers off-screen thumbnails and disconnects observers on visibility, document changes and unmount', () => {
  const observers: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; intersect: (visible: boolean) => void }> = [];
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ observe: this.observe, disconnect: this.disconnect,
        intersect: (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver) });
    }
  });
  render({ documents: [chart('lazy', '遅延描画', 1)] });
  const canvas = container!.querySelector('canvas')!;
  expect(observers[0].observe).toHaveBeenCalledWith(canvas);
  expect(drawn).toHaveLength(0);
  act(() => observers[0].intersect(false));
  expect(drawn).toHaveLength(0);
  expect(observers[0].disconnect).not.toHaveBeenCalled();
  render({ documents: [chart('lazy', '遅延描画', 2, [packCell(knit, 0xff_0000), 0, 0, 0])] });
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(observers[1].observe).toHaveBeenCalledWith(canvas);
  expect(drawn).toHaveLength(0);
  act(() => observers[1].intersect(true));
  expect(observers[1].disconnect).toHaveBeenCalledOnce();
  expect(drawn).toHaveLength(1);
  expect(drawn[0].data.slice(0, 4)).toEqual([255, 0, 0, 255]);
  render({ documents: [chart('lazy', '遅延描画', 3)] });
  expect(observers[1].disconnect).toHaveBeenCalledTimes(2);
  expect(drawn).toHaveLength(1);
  act(() => root!.unmount());
  root = undefined;
  expect(observers[2].disconnect).toHaveBeenCalledOnce();
});
