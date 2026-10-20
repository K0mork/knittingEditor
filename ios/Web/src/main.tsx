import { createRoot } from 'react-dom/client';
import App from './App';
import { listenNativeFold } from './nativeBridge';
import '@knitting-editor/editor-core/styles/base.css';
import './styles.css';

// webReadyより前に購読し、読み直したページにも現在の姿勢を反映する。
listenNativeFold();

createRoot(document.getElementById('root')!).render(<App />);
