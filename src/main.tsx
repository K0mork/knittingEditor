import { prefetchPdfWorker } from '@knitting-editor/editor-core/export/exporters';
import { prefetchBackupWorker } from '@knitting-editor/editor-core/storage/backupTask';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeAnalytics } from './analytics';
import '@knitting-editor/editor-core/styles/base.css';
import './styles.css';

initializeAnalytics();
createRoot(document.getElementById('root')!).render(<App />);

// 開発時のWorkerは分割モジュールなので、内容の先読みは本番Web版だけで行う。
if (!import.meta.env.DEV) {
  const prefetch = () => { void prefetchPdfWorker(); void prefetchBackupWorker(); };
  if (document.readyState === 'complete') prefetch();
  else window.addEventListener('load', prefetch, { once: true });
}
