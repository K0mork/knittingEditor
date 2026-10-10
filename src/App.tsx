import { useCallback, useMemo } from 'react';
import { listBlocks } from '@knitting-editor/editor-core/storage/database';
import { EditorView } from '@knitting-editor/editor-core/ui/EditorView';
import { useEditorController } from '@knitting-editor/editor-core/ui/useEditorController';
import { createGuideNavigation } from '@knitting-editor/editor-core/ui/guideNavigation';
import { webAnalytics } from './analytics';
import { createWebPlatform } from './platform';
import { useShareOffer } from './ShareFileDialog';
import { initializeStorage } from './storage/database';

// Web版はブラウザ標準のダイアログをそのまま使う。iOS版はWKWebViewでの見た目と
// キーボード表示が合わないため、アプリ内ダイアログへ差し替えている。
const askText = (title: string, defaultValue = '') => Promise.resolve(window.prompt(title, defaultValue));
const askConfirm = (title: string) => Promise.resolve(window.confirm(title));

async function initialize() {
  const storage = await initializeStorage();
  return { ...storage, blocks: await listBlocks() };
}

export default function App() {
  const { offerShare, dialog: shareDialog } = useShareOffer();
  const platform = useMemo(() => createWebPlatform(offerShare), [offerShare]);
  const editor = useEditorController({ initialize, platform, analytics: webAnalytics, askText, askConfirm });

  const navigateToGuide = useMemo(() => createGuideNavigation({
    save: () => editor.session.saveNow(),
    notify: editor.notify,
    navigate: (destination) => window.location.assign(destination),
  }), [editor.session.saveNow, editor.notify]);
  const openGuide = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    // 新しいタブで開く操作は編集画面を破棄しないので、リンク本来の動作を保つ。
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    void navigateToGuide(event.currentTarget.href);
  }, [navigateToGuide]);

  return <EditorView
    editor={editor}
    onGuideClick={openGuide}
    renderTitle={(documentStatus) => <div className="app-title">
      <div className="app-heading-row">
        <h1>棒針編み図エディタ</h1>
        <p className="app-tagline">無料の棒針編み図作成サイト</p>
      </div>
      <p className="app-document-name" aria-live="polite" aria-atomic="true">{documentStatus}</p>
    </div>}
    backupNote="端末内データはブラウザ操作で消える場合があります。定期的に保存してください。"
    documentsNote={<a href="/privacy/">プライバシーポリシー（アクセス解析について）</a>}
    footer={<footer><span>© 2026 棒針編み図エディタ</span><a href="/privacy/">プライバシーポリシー</a></footer>}
  >{shareDialog}</EditorView>;
}
