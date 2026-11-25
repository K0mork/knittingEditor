import { createRoot } from 'react-dom/client';
import App from './App';
import { listenNativeFold } from './nativeBridge';
import { capRootFontSize } from './textSizeCap';
import '@knitting-editor/editor-core/styles/base.css';
import './styles.css';

// webReadyより前に購読し、読み直したページにも現在の姿勢を反映する。
listenNativeFold();

// 最大の文字サイズでも盤面を残すため、最初の描画からAX1で頭打ちにする（#389）。
capRootFontSize();

createRoot(document.getElementById('root')!).render(<App />);
