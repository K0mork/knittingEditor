import { useCallback, useEffect, useRef } from 'react';
import { initializeStorage, listBlocks } from '@knitting-editor/editor-core/storage/database';
import { base64ToBytes } from '@knitting-editor/editor-core/util/base64';
import { EditorView } from '@knitting-editor/editor-core/ui/EditorView';
import { noteHardwareKeyboard } from '@knitting-editor/editor-core/ui/inputEnvironment';
import { useEditorController } from '@knitting-editor/editor-core/ui/useEditorController';
import { useAppDialog } from './AppDialog';
import { withTimeout } from './async';
import {
  listenNativeBackupSelected, listenNativeCommand, listenNativeError, notifyNativeCommandState, notifyNativeReady, requestNativeBackupOpen,
} from './nativeBridge';
import { nativeCommandHandlers, runNativeCommand } from './nativeCommands';
import { iosPlatform } from './platform';

declare global {
  interface Window {
    knittingEditorFlushPendingSave?: () => Promise<boolean>;
  }
}

export const STORAGE_INITIALIZATION_TIMEOUT_MS = 10_000;
export const GUIDE_NAVIGATION_SAVE_TIMEOUT_MS = 2_000;

function initialize() {
  return withTimeout(
    (async () => {
      const storage = await initializeStorage();
      return { ...storage, blocks: await listBlocks() };
    })(),
    STORAGE_INITIALIZATION_TIMEOUT_MS,
    '端末内データの準備が10秒以内に完了しませんでした。再読み込みを試してください。',
  );
}

export default function App() {
  const { askText, askConfirm, dialog } = useAppDialog();
  // 分析は渡さない。アプリ版は製品イベントを一切送らない。
  const editor = useEditorController({ initialize, platform: iosPlatform, askText, askConfirm });
  const { saveNow } = editor.session;

  // ネイティブ側からの通知は一度だけ購読し、最新の復元・通知処理をrefで参照する。
  const restoreRef = useRef(editor.restore);
  const notifyRef = useRef(editor.notify);
  restoreRef.current = editor.restore;
  notifyRef.current = editor.notify;

  // アプリがバックグラウンドへ移るときは待たずに書き込む。共通の保存経路を通すので、
  // 書き込み中に入った編集は未保存のまま残り、「保存済み」表示にはならない。
  const flushPendingSave = useCallback(async () => await saveNow('background') !== 'failed', [saveNow]);

  useEffect(() => {
    const handler = () => { void flushPendingSave(); };
    window.addEventListener('knittingEditorAppWillResignActive', handler);
    const nativeFlush = async () => flushPendingSave();
    window.knittingEditorFlushPendingSave = nativeFlush;
    return () => {
      window.removeEventListener('knittingEditorAppWillResignActive', handler);
      if (window.knittingEditorFlushPendingSave === nativeFlush) delete window.knittingEditorFlushPendingSave;
    };
  }, [flushPendingSave]);

  // 使い方ページへの遷移でReactは破棄される。WKWebViewはbeforeunloadの確認を
  // 表示しないため、保留中の自動保存を完了させてから移動する。
  const navigateToGuide = useCallback((destination: string) => {
    // 保存が滞っても使い方ページを開けなくならないよう、待ち時間を区切る。
    void withTimeout(flushPendingSave(), GUIDE_NAVIGATION_SAVE_TIMEOUT_MS, '保存の完了を待てませんでした')
      .catch(() => false)
      .finally(() => window.location.assign(destination));
  }, [flushPendingSave]);
  const openGuide = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigateToGuide(event.currentTarget.href);
  }, [navigateToGuide]);

  // メニューバーとキーボードショートカットの操作。購読は一度だけにし、最新の操作をrefで参照する。
  const commands = nativeCommandHandlers(editor, {
    requestRestore: () => { if (!requestNativeBackupOpen()) editor.fileInputRef.current?.click(); },
    openGuide: () => navigateToGuide(new URL('/guide/', window.location.href).href),
  });
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const busyRef = useRef(editor.busy);
  busyRef.current = editor.busy;

  useEffect(() => {
    const removeBackupListener = listenNativeBackupSelected(({ filename, dataBase64 }) => {
      try {
        void restoreRef.current(new File([base64ToBytes(dataBase64)], filename, { type: 'application/gzip' }));
      } catch {
        notifyRef.current('バックアップを読み込めませんでした');
      }
    });
    const removeErrorListener = listenNativeError((message) => notifyRef.current(message));
    const removeCommandListener = listenNativeCommand((command) => {
      // ショートカットはメニューバーが先に受け取り、ページの`keydown`へ届かない。
      // 記号の一覧の「Escapeで閉じます。」などを出せるよう、キーボードがあるとみなす。
      noteHardwareKeyboard();
      runNativeCommand(command, commandsRef.current, { busy: busyRef.current !== undefined });
    });
    notifyNativeReady();
    return () => {
      removeBackupListener();
      removeErrorListener();
      removeCommandListener();
    };
  }, []);

  // メニューの「元に戻す」「やり直す」を、画面のボタンと同じ条件で選べるようにする。
  const { canUndo, canRedo } = editor.session;
  useEffect(() => { notifyNativeCommandState({ canUndo, canRedo }); }, [canUndo, canRedo]);

  return <EditorView
    editor={editor}
    renderTitle={(documentStatus) => <div className="app-title"><h1>棒針編み図エディタ</h1><p aria-live="polite" aria-atomic="true">{documentStatus}</p></div>}
    onGuideClick={openGuide}
    requestRestore={requestNativeBackupOpen}
    backupNote="アプリを削除すると端末内のデータも消えます。定期的にバックアップを保存してください。"
    footer={<footer><span>© 2026 棒針編み図エディタ</span><a href="/guide/" onClick={openGuide}>使い方</a></footer>}
  >
    {dialog}
  </EditorView>;
}
