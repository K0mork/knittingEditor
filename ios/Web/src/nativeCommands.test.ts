import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from '@knitting-editor/editor-core/model/Board';
import { defaultPngCellSize } from '@knitting-editor/editor-core/export/exporters';
import { isNativeCommand, listenNativeCommand, NATIVE_COMMANDS, notifyNativeCommandState, type NativeCommand } from './nativeBridge';
import { MENU_PDF_OPTIONS, nativeCommandHandlers, runNativeCommand, type NativeCommandHandlers } from './nativeCommands';

function fakeHandlers(): NativeCommandHandlers {
  return Object.fromEntries(NATIVE_COMMANDS.map((command) => [command, vi.fn()])) as unknown as NativeCommandHandlers;
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.webkit;
});

describe('native menu commands', () => {
  it('accepts only the commands the app menu sends', () => {
    expect(isNativeCommand('undo')).toBe(true);
    expect(isNativeCommand('exportPdf')).toBe(true);
    expect(isNativeCommand('deleteEverything')).toBe(false);
    expect(isNativeCommand({ command: 'undo' })).toBe(false);

    const listener = vi.fn();
    const remove = listenNativeCommand(listener);
    window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'redo' }));
    window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'unknown' }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('redo');
    remove();
    window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'undo' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tells the app whether undo and redo are available', () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
    expect(notifyNativeCommandState({ canUndo: true, canRedo: false })).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ version: 1, type: 'commandState', canUndo: true, canRedo: false });
  });

  it('runs the matching editor action', () => {
    const handlers = fakeHandlers();
    for (const command of NATIVE_COMMANDS) {
      expect(runNativeCommand(command, handlers, { busy: false })).toBe('performed');
      expect(handlers[command]).toHaveBeenCalledTimes(1);
    }
  });

  it('does not start another action while exporting or restoring', () => {
    const handlers = fakeHandlers();
    for (const command of NATIVE_COMMANDS) {
      expect(runNativeCommand(command, handlers, { busy: true })).toBe('blocked');
      expect(handlers[command]).not.toHaveBeenCalled();
    }
  });

  it('keeps a dialog in front: only undo and redo pass through, as with the web shortcuts', () => {
    document.body.innerHTML = '<section role="dialog" aria-modal="true"><button>決定</button></section>';
    const handlers = fakeHandlers();
    const blocked: NativeCommand[] = ['newDocument', 'restoreBackup', 'exportBackup', 'exportAllBackup', 'exportPng', 'exportPdf', 'openGuide'];
    for (const command of blocked) expect(runNativeCommand(command, handlers, { busy: false })).toBe('blocked');
    expect(runNativeCommand('undo', handlers, { busy: false })).toBe('performed');
    expect(handlers.undo).toHaveBeenCalledTimes(1);
  });

  it('undoes typing instead of the board while a text field has focus', () => {
    document.body.innerHTML = '<input aria-label="入力" value="新しい編み図">';
    document.querySelector('input')!.focus();
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const handlers = fakeHandlers();
    expect(runNativeCommand('undo', handlers, { busy: false })).toBe('textEditing');
    expect(runNativeCommand('redo', handlers, { busy: false })).toBe('textEditing');
    expect(execCommand).toHaveBeenNthCalledWith(1, 'undo');
    expect(execCommand).toHaveBeenNthCalledWith(2, 'redo');
    expect(handlers.undo).not.toHaveBeenCalled();
    expect(handlers.redo).not.toHaveBeenCalled();
  });

  it('treats the color and range controls as non-text controls', () => {
    document.body.innerHTML = '<input type="color" value="#000000"><input type="range">';
    const handlers = fakeHandlers();
    for (const input of document.querySelectorAll('input')) {
      input.focus();
      expect(runNativeCommand('undo', handlers, { busy: false })).toBe('performed');
    }
    expect(handlers.undo).toHaveBeenCalledTimes(2);
  });

  it('exports with the same defaults the save panel opens with', () => {
    const board = new Board(20, 20);
    const editor = {
      session: { board },
      createNewDocument: vi.fn(async () => {}),
      backup: vi.fn(async () => {}),
      runPngExport: vi.fn(async () => {}),
      runPdfExport: vi.fn(async () => {}),
      undo: vi.fn(),
      redo: vi.fn(),
    };
    const requestRestore = vi.fn();
    const openGuide = vi.fn();
    const handlers = nativeCommandHandlers(editor as unknown as Parameters<typeof nativeCommandHandlers>[0], { requestRestore, openGuide });

    handlers.exportPng();
    expect(editor.runPngExport).toHaveBeenCalledWith(defaultPngCellSize(board));
    handlers.exportPdf();
    expect(editor.runPdfExport).toHaveBeenCalledWith(MENU_PDF_OPTIONS);
    expect(MENU_PDF_OPTIONS).toEqual({ layout: 'single', orientation: 'portrait', cellMillimeters: 5 });
    handlers.exportBackup();
    handlers.exportAllBackup();
    expect(editor.backup.mock.calls).toEqual([[false], [true]]);
    handlers.newDocument();
    expect(editor.createNewDocument).toHaveBeenCalledTimes(1);
    handlers.undo();
    handlers.redo();
    expect(editor.undo).toHaveBeenCalledTimes(1);
    expect(editor.redo).toHaveBeenCalledTimes(1);
    handlers.restoreBackup();
    handlers.openGuide();
    expect(requestRestore).toHaveBeenCalledTimes(1);
    expect(openGuide).toHaveBeenCalledTimes(1);
  });
});
