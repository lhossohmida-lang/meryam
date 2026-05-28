// =============================================================================
//  WALIDA — Application Entry Point
// -----------------------------------------------------------------------------
//  Hydrates the root, mounts <App/>, and registers the PWA service worker.
//  Kept intentionally small — all routing + providers live inside <App/>.
// =============================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import App from './App.jsx';
import './global.css';

// Eagerly initialise Firebase so analytics / auth listeners are ready
// before the first paint.
import './firebase.js';

// PWA: auto-update silently in the background (safely checks for service worker support, e.g. not in file:// Electron)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Choose HashRouter under file:// (Electron / local PWA packages) and BrowserRouter on Web (http / https)
const Router = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? HashRouter
  : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
