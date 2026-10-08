import { useMemo } from 'react';
import { listBlocks } from '@knitting-editor/editor-core/storage/database';
import { EditorView } from '@knitting-editor/editor-core/ui/EditorView';
import { useEditorController } from '@knitting-editor/editor-core/ui/useEditorController';
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

  return <EditorView
    editor={editor}
    renderTitle={(documentStatus) => <div className="app-title">
      <div className="app-heading-row">
        <h1>棒針編み図エディタ</h1>
        <p className="app-tagline">無料の棒針編み図作成サイト</p>
      </div>
      <p className="app-document-name" aria-live="polite" aria-atomic="true">{documentStatus}</p>
    </div>}
    // 編み図は端末内にだけ保存し、GA4で送る情報はプライバシーポリシーで公表している。編集画面のフッターは
    // 表示しないので、データの扱いを説明するこの案内文からリンクする。
    backupNote={<>端末内データはブラウザ操作で消える場合があります。定期的に保存してください。<br /><a href="/privacy/">プライバシーポリシー</a></>}
    footer={<footer><span>© 2026 棒針編み図エディタ</span><a href="/privacy/">プライバシーポリシー</a></footer>}
  >{shareDialog}</EditorView>;
}
