import { listBlocks } from '@knitting-editor/editor-core/storage/database';
import { EditorView } from '@knitting-editor/editor-core/ui/EditorView';
import { useEditorController } from '@knitting-editor/editor-core/ui/useEditorController';
import { webAnalytics } from './analytics';
import { webPlatform } from './platform';
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
  const editor = useEditorController({ initialize, platform: webPlatform, analytics: webAnalytics, askText, askConfirm });

  return <EditorView
    editor={editor}
    renderTitle={(documentStatus) => <div className="app-title">
      <div className="app-heading-row">
        <h1>棒針編み図エディタ</h1>
        <p className="app-tagline">無料の棒針編み図作成サイト</p>
      </div>
      <p className="app-document-name" aria-live="polite" aria-atomic="true">{documentStatus}</p>
    </div>}
    backupNote="端末内データはブラウザ操作で消える場合があります。定期的に保存してください。"
    footer={<footer><span>© 2026 棒針編み図エディタ</span><a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noreferrer">プライバシー</a></footer>}
  />;
}
