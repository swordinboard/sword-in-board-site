import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BOARD_TITLE } from './lib/config';
import './styles/index.css';
import './styles/board.css';
import './styles/frames.css';
import './styles/cropper.css';

document.title = BOARD_TITLE;

const host = document.getElementById('root');
if (!host) throw new Error('Missing #root');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
