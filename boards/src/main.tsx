import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SITE_NAME } from './lib/config';
import './styles/index.css';
import './styles/board.css';
import './styles/frames.css';
import './styles/cropper.css';

document.title = SITE_NAME;

const host = document.getElementById('root');
if (!host) throw new Error('Missing #root');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
