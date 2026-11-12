import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

// フォント定義は表示をブロックしないよう後から読み込む（読み込み前はシステムフォントで表示）
void import('./styles/fonts.css');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
