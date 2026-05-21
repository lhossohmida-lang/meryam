// =============================================================================
//  WALIDA — Application Entry Point
// -----------------------------------------------------------------------------
//  Hydrates the root, mounts <App/>, and registers the PWA service worker.
//  Kept intentionally small — all routing + providers live inside <App/>.
// =============================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import App from './App.jsx';
import './global.css';

// Eagerly initialise Firebase so analytics / auth listeners are ready
// before the first paint.
import './firebase.js';

// PWA: auto-update silently in the background.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
