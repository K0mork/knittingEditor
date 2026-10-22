import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ChartProgressStorage, EditorAnalytics } from '../analytics';
import * as exporters from '../export/exporters';
import * as database from '../storage/database';
import { encodeBackup } from '../storage/backupCodec';
import { useEditorController, type EditorController } from './useEditorController';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean | undefined; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
let editor: EditorController;
let raw: string | null;
let cancelled: boolean;
let shareResult: Promise<boolean | undefined> | undefined;
const track = vi.fn();
const read = vi.fn(() => raw);
const storage: ChartProgressStorage = { read, write: (value) => { raw = value; }, remove: () => { raw = null; } };
const records = () => JSON.parse(raw!).charts;

async function mount(analytics: EditorAnalytics = { track, trackFirstEdit: vi.fn(), chartProgressStorage: () => storage }) {
  const source = await database.createDocument('計測テスト', 5, 5);
  const other = await database.createDocument('切替先', 5, 5);
  function Probe() {
    editor = useEditorController({
      autosaveDelayMs: 60_000,
      initialize: async () => ({ documents: [source, other], activeId: source.id, blocks: [] }),
      analytics,
      platform: { saveFile: async () => ({ saved: shareResult ?? Promise.resolve(cancelled ? false : undefined) }) },
      askText: async () => '新しい編み図', askConfirm: async () => true,
    });
    return null;
  }
  await act(async () => { root = createRoot(container); root.render(<Probe />); });
  return source;
}
async function draw() {
  await act(async () => {
    for (let i = 0; i < 20; i++) editor.session.board!.place(Math.floor(i / 5), i % 5, 'knit', '#112233');
    editor.strokeChanged();
    editor.commitStroke();
  });
}
async function png() { await act(async () => { await editor.runPngExport(24); }); }
const events = (name: string) => track.mock.calls.filter(([event]) => event === name);

beforeEach(async () => {
  raw = null; cancelled = false; shareResult = undefined; track.mockReset(); read.mockClear();
  for (const chart of await database.listDocuments()) await database.deleteDocument(chart.id);
  container = document.createElement('div'); document.body.append(container);
  vi.spyOn(exporters, 'renderPng').mockResolvedValue(new Blob(['png']));
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container.remove(); vi.restoreAllMocks();
});

it('counts committed cells once, ignores selection, no-op strokes and Undo/Redo', async () => {
  const source = await mount();
  await draw();
  expect(events('chart_progress')).toHaveLength(1);
  expect(events('chart_progress')[0][1]).toMatchObject({ progress_threshold: '20', touched_cells_bucket: '20-99' });
  await act(async () => { editor.selectStitch('purl'); editor.strokeChanged(); editor.commitStroke(); editor.undo(); editor.redo(); });
  expect(events('chart_progress')).toHaveLength(1);
  await act(async () => { window.dispatchEvent(new Event('pagehide')); });
  expect(records()[source.id]).toMatchObject({ touched: 20, editDays: 1 });
});

it('classifies repeated exports and never sends private tokens', async () => {
  await mount(); await draw(); await png(); await png();
  expect(events('chart_exported').map(([, params]) => params.export_state)).toEqual(['edited_first', 'same_state']);
  expect(events('chart_progress_exported')).toHaveLength(1);
  for (const [, params] of events('chart_exported')) {
    expect(Object.keys(params).sort()).toEqual(['board_size_bucket', 'chart_origin', 'export_format', 'export_state', 'progress_bucket']);
  }
});

it('does not commit cancelled sharing and clears busy before sharing completes', async () => {
  const source = await mount(); await draw(); cancelled = true; await png();
  expect(events('chart_exported')).toHaveLength(1);
  expect(events('chart_progress_exported')).toHaveLength(0);
  expect(records()[source.id].lastExportHash).toBeUndefined();
  expect(editor.busy).toBeUndefined();
  cancelled = false; await png();
  expect(events('chart_exported')[1][1].export_state).toBe('edited_first');
});

it('exports successfully even when the analytics sender throws', async () => {
  await mount(); await draw(); track.mockImplementation(() => { throw new Error('sender'); });
  await png();
  expect(events('chart_exported')).toHaveLength(1);
  expect(events('operation_failed')).toHaveLength(0);
  expect(editor.busy).toBeUndefined();
});

it('does not access metric storage without an enabled storage provider', async () => {
  await mount({ track, trackFirstEdit: vi.fn() }); await draw(); await png();
  expect(read).not.toHaveBeenCalled(); expect(raw).toBeNull();
  expect(events('chart_progress')).toHaveLength(0);
  expect(events('chart_exported')[0][1]).toEqual({ export_format: 'png', board_size_bucket: 'small' });
});

it('forgets deleted charts and opens duplicated charts with their origin', async () => {
  const source = await mount(); await draw();
  await act(async () => { await editor.duplicateChart(editor.session.activeDocument!); });
  const copy = editor.session.documents.find((chart) => chart.name.endsWith('のコピー'))!;
  await act(async () => { await editor.switchDocument(copy); });
  expect(records()[copy.id]).toMatchObject({ origin: 'duplicated', baseOccupied: 20, maxNet: 0 });
  await act(async () => { await editor.deleteChart(source); });
  expect(records()[source.id]).toBeUndefined();
});

it('tracks background changes as edits without manufacturing cell progress', async () => {
  const source = await mount();
  await act(async () => { editor.session.setBackgroundColor('#abcdef'); window.dispatchEvent(new Event('pagehide')); });
  expect(records()[source.id]).toMatchObject({ editDays: 1, touched: 0, maxNet: 0 });
  await png(); expect(events('chart_exported')[0][1].export_state).toBe('edited_first');
});

it('registers restored origins before opening restored content', async () => {
  const source = await mount();
  const blob = encodeBackup([source], []);
  await act(async () => { await editor.restore(new File([blob], 'restore.knit')); });
  expect(editor.session.activeDocument!.id).not.toBe(source.id);
  expect(records()[editor.session.activeDocument!.id].origin).toBe('restored');
});


it('does not wait for sharing and commits the original chart after switching', async () => {
  const source = await mount(); await draw();
  let finish!: (saved: boolean) => void;
  shareResult = new Promise((resolve) => { finish = resolve; });
  await png();
  expect(editor.busy).toBeUndefined();
  expect(records()[source.id].lastExportHash).toBeUndefined();
  const other = editor.session.documents.find((chart) => chart.id !== source.id)!;
  await act(async () => { await editor.switchDocument(other); finish(true); });
  expect(records()[source.id].lastExportHash).toEqual(expect.any(String));
  expect(records()[other.id].lastExportHash).toBeUndefined();
});

it('keeps the exported chart token when switching during PNG generation', async () => {
  const source = await mount(); await draw();
  let finish!: (blob: Blob) => void;
  vi.mocked(exporters.renderPng).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  let exporting!: Promise<void>;
  await act(async () => { exporting = editor.runPngExport(24); });
  const other = editor.session.documents.find((chart) => chart.id !== source.id)!;
  await act(async () => { await editor.switchDocument(other); finish(new Blob(['png'])); await exporting; });
  expect(records()[source.id].lastExportHash).toEqual(expect.any(String));
  expect(records()[other.id].lastExportHash).toBeUndefined();
});

it('adds progress parameters to PDF exports and commits successful sharing', async () => {
  await mount(); await draw();
  vi.spyOn(exporters, 'renderPdf').mockResolvedValue(new Blob(['pdf']));
  await act(async () => { await editor.runPdfExport({ layout: 'single', orientation: 'portrait', cellMillimeters: 5 }); });
  expect(events('chart_exported')[0][1]).toMatchObject({ export_format: 'pdf', pdf_layout: 'single', export_state: 'edited_first' });
  expect(events('chart_progress_exported')[0][1].export_format).toBe('pdf');
});
