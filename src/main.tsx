import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeAnalytics } from './analytics';
import '@knitting-editor/editor-core/styles/base.css';
import './styles.css';

initializeAnalytics();
createRoot(document.getElementById('root')!).render(<App />);
