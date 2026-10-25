import { NO_ANALYTICS } from '../analytics';
import * as exporters from '../export/exporters';
import { WorkerVersionError } from '../util/workerStarter';
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { encodeBackup } from '../storage/backupCodec';
import * as database from '../storage/database';
import { useEditorController, type EditorController } from './useEditorController';

// eslint-disable-next-line no-var
declare global { var IS_REACT_ACT_ENVIRONMENT: boolean | undefined; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let editor: EditorController;
let source: database.ChartDocument;
let confirmResult = true;
const track = vi.fn();
const saveFile = vi.fn(async () => ({ saved: Promise.resolve(undefined) }));
const askConfirm = vi.fn(async () => confirmResult);
let savedBlock: ReturnType<Board['createBlock']>;
const quota = new DOMException('test quota', 'QuotaExceededError');

beforeEach(async () => {
  track.mockClear();
  saveFile.mockReset();
  saveFile.mockResolvedValue({ saved: Promise.resolve(undefined) });
  confirmResult = true;
  askConfirm.mockClear();
  for (const document of await database.listDocuments()) await database.deleteDocument(document.id);
  for (const block of await database.listBlocks()) await database.deleteBlock(block.id);
  source = await database.createDocument('元の編み図', 4, 4);
  const other = await database.createDocument('別の編み図', 4, 4);
  await database.setSetting('activeDocumentId', source.id);
  savedBlock = database.boardFromDocument(source).createBlock({ top: 0, left: 0, bottom: 0, right: 0 }, '保存したブロック');
  await database.saveBlock(savedBlock);
  container = document.createElement('div');
  document.body.append(container);
  function Probe() {
    editor = useEditorController({
      autosaveDelayMs: 60_000,
      initialize: async () => ({ documents: [source, other], activeId: source.id, blocks: [savedBlock] }),
      platform: { saveFile },
      askText: async () => '変更した名前',
      askConfirm,
      analytics: { track, trackFirstEdit: vi.fn() },
    });
    return null;
  }
  await act(async () => { root = createRoot(container); root.render(<Probe />); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

async function edit() {
  await act(async () => {
    editor.session.board!.resize(5, 6);
    editor.session.board!.place(0, 0, 'knit', '#123456');
    editor.changed();
    editor.session.setBackgroundColor('#808080');
  });
}

describe('duplicateChart', () => {
  it.each(['before autosave', 'pending', 'failed'])('duplicates the live board %s and keeps independent cells', async (timing) => {
    await edit();
    let release!: () => void;
    let saving: Promise<unknown> | undefined;
    if (timing === 'pending') {
      const original = database.saveDocument;
      vi.spyOn(database, 'saveDocument').mockImplementationOnce((document, board) => {
        const snapshot = new Board(board.rows, board.cols, board.cells);
        return new Promise((resolve) => { release = () => { void original(document, snapshot).then(resolve); }; });
      });
      await act(async () => { saving = editor.session.saveNow(); });
      await act(async () => {
        editor.session.board!.place(1, 1, 'purl', '#654321');
        editor.changed();
      });
    } else if (timing === 'failed') {
      vi.spyOn(database, 'saveDocument').mockRejectedValue(quota);
      await act(async () => { expect(await editor.session.saveNow()).toBe('failed'); });
    }
    const snapshot = editor.session.activeSnapshot()!;
    await act(async () => { await expect(editor.duplicateChart(source)).resolves.toBeUndefined(); });
    const copy = (await database.listDocuments()).find((document) => document.name === '元の編み図のコピー')!;
    expect(copy).toBeDefined();
    expect(copy.rows).toBe(5);
    expect(copy.cols).toBe(6);
    expect(copy.backgroundColor).toBe('#808080');
    expect(new Uint32Array(copy.cells)).toEqual(new Uint32Array(snapshot.cells));
    expect(editor.message).toBe('編み図を複製しました');
    expect(editor.session.activeDocument?.id).toBe(source.id);
    if (saving) await act(async () => { release(); expect(await saving).toBe('pending'); });
    vi.restoreAllMocks();
    await act(async () => { editor.session.board!.clearAt(0, 0); editor.changed(); });
    await act(async () => { await editor.session.saveNow(); });
    expect(database.boardFromDocument(copy).valueAt(0, 0)).not.toBe(0);
    await act(async () => { await editor.switchDocument(copy); });
    expect(editor.session.board!.valueAt(0, 0)).not.toBe(0);
    await act(async () => { editor.session.board!.place(0, 2, 'knit', '#abcdef'); editor.changed(); });
    await act(async () => { await editor.session.saveNow(); });
    const original = (await database.listDocuments()).find((document) => document.id === source.id)!;
    expect(new Uint32Array(original.cells)[0]).toBe(0);
    expect(new Uint32Array(original.cells)[2]).toBe(0);
    expect(new Uint32Array(copy.cells)[0]).not.toBe(0);
    expect(new Uint32Array(snapshot.cells)[0]).not.toBe(0);
  });

  it('duplicates an inactive chart from its saved record', async () => {
    await edit();
    const other = editor.session.documents.find((document) => document.id !== source.id)!;
    await act(async () => { await editor.duplicateChart(other); });
    const copy = editor.session.documents.find((document) => document.name === '別の編み図のコピー')!;
    expect(copy.rows).toBe(4);
    expect(new Uint32Array(copy.cells).every((cell) => cell === 0)).toBe(true);
  });
});

describe('restore with edits during import', () => {
  async function startRestore() {
    const file = new File([encodeBackup([source], [])], 'restore.knit');
    const original = database.importBackup;
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(database, 'importBackup').mockImplementationOnce(async (file) => {
      entered();
      await gate;
      return original(file);
    });
    let restoring!: Promise<void>;
    await act(async () => {
      editor.togglePanel('export');
      restoring = editor.restore(file);
      await started;
    });
    expect(editor.busy).toBe('バックアップを処理中');
    return { release, restoring };
  }

  async function draw(row: number) {
    await act(async () => {
      editor.session.board!.place(row, 0, 'knit', '#123456');
      editor.changed();
    });
  }

  it.each(['draw', 'undo', 'unchanged'] as const)('saves %s before switching to the restored chart', async (action) => {
    await draw(0);
    const { release, restoring } = await startRestore();
    if (action === 'draw') await draw(1);
    if (action === 'undo') await act(async () => { editor.undo(); });
    const expected = editor.session.activeSnapshot()!;
    await act(async () => { release(); await restoring; });
    const documents = await database.listDocuments();
    const stored = documents.find((document) => document.id === source.id)!;
    expect(new Uint32Array(stored.cells)).toEqual(new Uint32Array(expected.cells));
    expect(new Uint32Array(stored.cells).filter(Boolean)).toHaveLength(action === 'draw' ? 2 : action === 'undo' ? 0 : 1);
    const restored = documents.find((document) => document.name === `${source.name}（復元）`)!;
    expect(restored.id).not.toBe(source.id);
    expect(new Uint32Array(restored.cells).every((cell) => cell === 0)).toBe(true);
    expect(editor.session.activeDocument?.id).toBe(restored.id);
    expect(editor.panel).toBeUndefined();
    expect(editor.message).toBe('1件の編み図を復元しました');
    expect(track).toHaveBeenCalledWith('backup_restored', { document_count_bucket: '1' });
  });

  it.each(['failed', 'pending'] as const)('keeps the current board and reports restore success when switching is %s', async (outcome) => {
    const { release, restoring } = await startRestore();
    await draw(0);
    const board = editor.session.board;
    if (outcome === 'failed') vi.spyOn(database, 'saveDocument').mockRejectedValueOnce(quota);
    else {
      const original = database.saveDocument;
      vi.spyOn(database, 'saveDocument').mockImplementationOnce(async (document, target) => {
        const snapshot = new Board(target.rows, target.cols, target.cells);
        target.place(1, 0, 'purl', '#654321');
        editor.changed();
        return original(document, snapshot);
      });
    }
    await act(async () => { release(); await restoring; });
    expect(editor.session.activeDocument?.id).toBe(source.id);
    expect(editor.session.board).toBe(board);
    expect(editor.session.board!.valueAt(0, 0)).not.toBe(0);
    expect(editor.session.dirty).toBe(true);
    expect(editor.session.canUndo).toBe(true);
    expect(editor.panel).toBe('export');
    expect(editor.message).toBe('1件を復元しました。編集中の編み図が未保存のため、切り替えていません。');
    expect(editor.session.documents.find((document) => document.name === `${source.name}（復元）`)).toBeDefined();
    expect((await database.listDocuments()).find((document) => document.name === `${source.name}（復元）`)).toBeDefined();
    expect(track).toHaveBeenCalledWith('backup_restored', { document_count_bucket: '1' });
    expect(editor.busy).toBeUndefined();
  });

  it('points to the chart list when the restored chart cannot be opened', async () => {
    const { release, restoring } = await startRestore();
    vi.spyOn(database, 'setSetting').mockRejectedValueOnce(new Error('settings unavailable'));
    await act(async () => { release(); await restoring; });
    expect(editor.session.activeDocument?.id).toBe(source.id);
    expect(editor.message).toBe('1件を復元しました。復元した編み図は「編み図」の一覧から開いてください。');
    expect(editor.session.documents.find((document) => document.name === `${source.name}（復元）`)).toBeDefined();
    expect(track).toHaveBeenCalledWith('backup_restored', { document_count_bucket: '1' });
    expect(editor.busy).toBeUndefined();
  });
});

describe('management failures', () => {
  it.each([
    ['createDocument', '編み図の作成', () => editor.createNewDocument()],
    ['renameDocument', '編み図の名前変更', () => editor.renameChart(source)],
    ['duplicateDocument', '編み図の複製', () => editor.duplicateChart(source)],
    ['deleteDocuments', '編み図の削除', () => editor.deleteChart(source)],
    ['saveBlock', 'ブロックの保存', () => editor.saveSelectionAsBlock()],
    ['deleteBlock', 'ブロックの削除', () => editor.removeBlock(savedBlock)],
  ] as const)('catches %s rejection and preserves the data and list', async (method, label, action) => {
    await act(async () => { editor.setSelection({ top: 0, left: 0, bottom: 0, right: 0 }); });
    const before = await database.listDocuments();
    const board = editor.session.board;
    const selection = editor.selection;
    vi.spyOn(database, method).mockRejectedValueOnce(quota);
    await act(async () => { await expect(action()).resolves.toBeUndefined(); });
    expect(editor.message).toBe(`${label}に失敗しました。もう一度お試しください。`);
    expect(editor.session.documents).toHaveLength(before.length);
    expect(editor.session.documents).toEqual(expect.arrayContaining(before));
    expect(await database.listDocuments()).toEqual(before);
    expect(editor.session.activeDocument?.id).toBe(source.id);
    expect(editor.session.board).toBe(board);
    expect(editor.selection).toEqual(selection);
    expect(editor.session.blocks).toEqual([savedBlock]);
    expect(await database.listBlocks()).toEqual([savedBlock]);
  });

  it('catches active-setting failure when opening another chart', async () => {
    vi.spyOn(database, 'setSetting').mockRejectedValueOnce(quota);
    const before = editor.session.board;
    await act(async () => { await expect(editor.switchDocument(editor.session.documents[1])).resolves.toBeUndefined(); });
    expect(editor.message).toContain('編み図を開けませんでした');
    expect(editor.session.board).toBe(before);
    expect(editor.session.activeDocument?.id).toBe(source.id);
  });

  it('does not create a new chart if saving the current edits fails', async () => {
    await edit();
    vi.spyOn(database, 'saveDocument').mockRejectedValueOnce(quota);
    await act(async () => { await editor.createNewDocument(); });
    expect(editor.message).toContain('編み図を作成できませんでした');
    expect(await database.listDocuments()).toHaveLength(2);
    expect(editor.session.dirty).toBe(true);
    expect(editor.session.canUndo).toBe(true);
  });

  it.each(['create', 'delete'])('rolls back %s if the active setting write fails', async (operation) => {
    const before = await database.listDocuments();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'settings') throw quota;
      return put.apply(this, args);
    });
    await act(async () => {
      if (operation === 'create') await editor.createNewDocument();
      else await editor.deleteChart(source);
    });
    expect(editor.message).toContain('に失敗しました');
    expect(await database.listDocuments()).toEqual(before);
    expect(editor.session.documents).toHaveLength(before.length);
    expect(editor.session.documents).toEqual(expect.arrayContaining(before));
    expect(editor.session.activeDocument?.id).toBe(source.id);
    expect(await database.getSetting('activeDocumentId')).toBe(source.id);
  });

  it('reflects saved and deleted blocks only after successful storage writes', async () => {
    await act(async () => { editor.setSelection({ top: 0, left: 0, bottom: 0, right: 0 }); });
    await act(async () => { await editor.saveSelectionAsBlock(); });
    expect(editor.session.blocks).toHaveLength(2);
    expect(editor.selection).toBeUndefined();
    expect(editor.message).toBe('ブロックを保存しました');
    await act(async () => { await editor.removeBlock(savedBlock); });
    expect(editor.session.blocks).toHaveLength(1);
    expect(await database.listBlocks()).toEqual(editor.session.blocks);
  });

  it('keeps a chart on cancellation and deletes only the confirmed chart', async () => {
    const before = [...editor.session.documents];
    confirmResult = false;
    await act(async () => { await editor.deleteChart(source); });
    expect(askConfirm).toHaveBeenLastCalledWith(`「${source.name}」を削除しますか？`, { destructive: true });
    expect(editor.session.documents).toEqual(before);
    expect(await database.listDocuments()).toHaveLength(2);
    track.mockClear();
  confirmResult = true;
    await act(async () => { await editor.deleteChart(source); });
    expect(editor.session.documents.map((chart) => chart.id)).toEqual(before.filter((chart) => chart.id !== source.id).map((chart) => chart.id));
    expect(await database.listDocuments()).toEqual(editor.session.documents);
  });

  it('keeps the chart list open after deleting the open chart but closes it when opening a chart', async () => {
    await act(async () => { editor.togglePanel('documents'); });
    await act(async () => { await editor.deleteChart(source); });
    expect(editor.session.activeDocument?.id).not.toBe(source.id);
    expect(editor.panel).toBe('documents');
    const created = await database.createDocument('追加の編み図', 4, 4);
    await act(async () => { editor.session.updateDocument(created); });
    await act(async () => { await editor.switchDocument(created); });
    expect(editor.session.activeDocument?.id).toBe(created.id);
    expect(editor.panel).toBeUndefined();
  });

  it('deletes several confirmed charts at once and keeps at least one', async () => {
    const third = await database.createDocument('三つ目の編み図', 4, 4);
    await act(async () => { editor.session.updateDocument(third); editor.togglePanel('documents'); });
    const [other] = editor.session.documents.filter((chart) => chart.id !== source.id && chart.id !== third.id);

    // 全件は消さない。確認も出さない。
    await act(async () => { await editor.deleteCharts(editor.session.documents); });
    expect(askConfirm).not.toHaveBeenCalled();
    expect(await database.listDocuments()).toHaveLength(3);

    confirmResult = false;
    await act(async () => { await editor.deleteCharts([source, third]); });
    expect(askConfirm).toHaveBeenLastCalledWith('選んだ2件の編み図を削除しますか？', { destructive: true });
    expect(await database.listDocuments()).toHaveLength(3);

    track.mockClear();
  confirmResult = true;
    await act(async () => { await editor.deleteCharts([source, third]); });
    expect(editor.session.documents.map((chart) => chart.id)).toEqual([other.id]);
    expect(await database.listDocuments()).toEqual(editor.session.documents);
    // 開いていた編み図を消したので、残りへ切り替える。一覧は開いたまま。
    expect(editor.session.activeDocument?.id).toBe(other.id);
    expect(await database.getSetting('activeDocumentId')).toBe(other.id);
    expect(editor.panel).toBe('documents');
  });

  it('reflects successful rename and delete without another storage read', async () => {
    await edit();
    await act(async () => { await editor.renameChart(source); });
    expect(editor.session.activeDocument?.name).toBe('変更した名前');
    expect(editor.session.documents.find((document) => document.id === source.id)?.name).toBe('変更した名前');
    await act(async () => { await editor.deleteChart(source); });
    expect(editor.session.documents).toHaveLength(1);
    expect(editor.session.activeDocument?.id).toBe(editor.session.documents[0].id);
    expect(await database.getSetting('activeDocumentId')).toBe(editor.session.activeDocument?.id);
    expect(await database.listDocuments()).toEqual(editor.session.documents);
  });
});

describe('worker version notification', () => {
  it.each([false, true])('offers reload only when local saving is healthy: saveFailed=%s', async (failed) => {
    if (failed) {
      vi.spyOn(database, 'saveDocument').mockRejectedValue(quota);
      await edit();
      await act(async () => { await editor.session.saveNow(); });
      expect(editor.session.saveFailed).toBe(true);
    }
    vi.spyOn(exporters, 'renderPdf').mockRejectedValue(new WorkerVersionError());
    await act(async () => { await editor.runPdfExport({ layout: 'single', orientation: 'portrait', cellMillimeters: 5 }); });
    expect(editor.message).toContain('サイトが更新されました');
    if (failed) {
      expect(editor.message).toContain('PNG');
      expect(editor.message).toContain('未保存の編集が失われます');
      expect(editor.notificationAction).toBeUndefined();
      expect(editor.message).not.toContain('再読み込みすると、もう一度');
    } else expect(editor.notificationAction?.label).toBe('再読み込み');
  });
});

it('reports the category for management failures without the message', async () => {
  vi.spyOn(database, 'renameDocument').mockRejectedValue(quota);
  await act(async () => { await editor.renameChart(source); });
  expect(track).toHaveBeenCalledWith('operation_failed', {
    operation_name: 'chart_rename', failure_reason: 'storage_quota',
  });
});

it('reports the category for export failures', async () => {
  vi.spyOn(exporters, 'renderPng').mockRejectedValue(new WorkerVersionError());
  await act(async () => { await editor.runPngExport(24); });
  expect(track).toHaveBeenCalledWith('operation_failed', {
    operation_name: 'png_export', failure_reason: 'site_updated',
  });
});

it.each(['png', 'pdf'] as const)('clears busy and reports a %s file handoff failure without recording success', async (format) => {
  vi.spyOn(exporters, 'renderPng').mockResolvedValue(new Blob(['png']));
  vi.spyOn(exporters, 'renderPdf').mockResolvedValue(new Blob(['pdf']));
  let rejectSave!: (error: Error) => void;
  saveFile.mockReturnValueOnce(new Promise((_, reject) => { rejectSave = reject; }));
  let exporting!: Promise<void>;
  await act(async () => {
    exporting = format === 'png' ? editor.runPngExport(24)
      : editor.runPdfExport({ layout: 'single', orientation: 'portrait', cellMillimeters: 5 });
  });
  expect(editor.busy).toBe(format === 'png' ? 'PNGを生成中' : 'PDFを生成中');
  expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), `${source.name}.${format}`);
  await act(async () => { rejectSave(new WorkerVersionError()); await exporting; });
  expect(editor.busy).toBeUndefined();
  expect(editor.message).toContain('サイトが更新されました');
  expect(editor.notificationAction?.label).toBe('再読み込み');
  expect(track).toHaveBeenCalledWith('operation_failed', {
    operation_name: `${format}_export`, failure_reason: 'site_updated',
  });
  expect(track.mock.calls.some(([event]) => event === 'chart_exported')).toBe(false);
});

it('reports the original initialization error category', async () => {
  function FailedProbe() {
    useEditorController({
      initialize: async () => { throw quota; },
      platform: { saveFile: async () => ({ saved: Promise.resolve(undefined) }) },
      askText: async () => null,
      askConfirm,
      analytics: { track, trackFirstEdit: vi.fn() },
    });
    return null;
  }
  await act(async () => { root.render(<FailedProbe />); });
  expect(track).toHaveBeenCalledWith('operation_failed', {
    operation_name: 'editor_init', failure_reason: 'storage_quota',
  });
});


describe('save failure analytics', () => {
  it.each(['autosave', 'manual', 'background'] as const)('records %s failures once until a successful write', async (trigger) => {
    const save = vi.spyOn(database, 'saveDocument').mockRejectedValue(quota);
    await edit();
    await act(async () => { await editor.session.saveNow(trigger); });
    expect(track.mock.calls.filter(([name]) => name === 'save_failed')).toEqual([
      ['save_failed', { save_trigger: trigger, failure_reason: 'storage_quota' }],
    ]);
    expect(editor.message).toContain('保存');
    await edit();
    await act(async () => {
      await editor.session.saveNow('autosave');
      await editor.session.saveNow('manual');
      await editor.session.saveNow('background');
    });
    expect(track.mock.calls.filter(([name]) => name === 'save_failed')).toHaveLength(1);
    save.mockRestore();
    // 成功と次の失敗の間に再描画がなくても抑制を解除する。
    await act(async () => {
      await editor.session.saveNow();
      expect(track.mock.calls.filter(([name]) => name === 'save_failed')).toHaveLength(1);
      editor.session.changed();
      vi.spyOn(database, 'saveDocument').mockRejectedValue(new Error('送らない文面'));
      await editor.session.saveNow('manual');
    });
    expect(track.mock.calls.filter(([name]) => name === 'save_failed')).toEqual([
      ['save_failed', { save_trigger: trigger, failure_reason: 'storage_quota' }],
      ['save_failed', { save_trigger: 'manual', failure_reason: 'unknown' }],
    ]);
  });

  it('keeps the default NO_ANALYTICS path silent and preserves save notifications', async () => {
    function OfflineProbe() {
      editor = useEditorController({
        initialize: async () => ({ documents: [source], activeId: source.id, blocks: [] }),
        platform: { saveFile: async () => ({ saved: Promise.resolve(undefined) }) },
        askText: async () => null,
        askConfirm,
      });
      return null;
    }
    const noopTrack = vi.spyOn(NO_ANALYTICS, 'track');
    await act(async () => { root.render(<OfflineProbe />); });
    track.mockClear();
    noopTrack.mockClear();
    await edit();
    vi.spyOn(database, 'saveDocument').mockRejectedValue(new DOMException('送らない文面', 'UnknownError'));
    await act(async () => { await editor.session.saveNow(); });
    expect(noopTrack).toHaveBeenCalledWith('save_failed', { save_trigger: 'manual', failure_reason: 'storage' });
    expect(track).not.toHaveBeenCalled();
    expect(editor.session.saveFailed).toBe(true);
    expect(editor.session.dirty).toBe(true);
    expect(editor.message).toContain('保存');
  });
});
