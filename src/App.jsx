// =============================================================================
//  WALIDA — Root Application
// -----------------------------------------------------------------------------
//  Owns:
//   1. Route table (storefront vs. admin)
//   2. Framer Motion <AnimatePresence/> for liquid page transitions
//   3. PWA manifest injection (so the document picks up the brand colours)
//   4. A lightweight CartProvider so the storefront and bottom nav share state
// =============================================================================

import React, { useEffect, createContext, useContext, useMemo, useReducer } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';

import ClientStorefront from './components/ClientStorefront.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import AIProductCreator from './components/AIProductCreator.jsx';
import AdminLogin from './components/AdminLogin.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// ---------------------------------------------------------------------------
//  Cart context — minimal but real. Shared by ProductCard3D, the bottom-nav
//  badge, and (later) the checkout sheet.
// ---------------------------------------------------------------------------
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((i) => i.id === action.product.id);
      const items = existing
        ? state.items.map((i) =>
            i.id === action.product.id ? { ...i, qty: i.qty + 1 } : i
          )
        : [...state.items, { ...action.product, qty: 1 }];
      return { ...state, items };
    }
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'toggleFavorite': {
      const set = new Set(state.favorites);
      set.has(action.id) ? set.delete(action.id) : set.add(action.id);
      return { ...state, favorites: [...set] };
    }
    default:
      return state;
  }
}

function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], favorites: [] });
  const value = useMemo(
    () => ({
      ...state,
      add: (product) => dispatch({ type: 'add', product }),
      remove: (id) => dispatch({ type: 'remove', id }),
      toggleFavorite: (id) => dispatch({ type: 'toggleFavorite', id }),
      total: state.items.reduce((sum, i) => sum + i.qty * i.price, 0),
      count: state.items.reduce((sum, i) => sum + i.qty, 0)
    }),
    [state]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ---------------------------------------------------------------------------
//  PWA + theme bootstrap — injects the manifest link and updates the
//  meta[theme-color] tag depending on the current portal (light vs. dark).
// ---------------------------------------------------------------------------
function useDocumentChrome() {
  const location = useLocation();
  useEffect(() => {
    // Inject manifest if not present
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.webmanifest';
      document.head.appendChild(link);
    }
    // Swap theme colour when entering admin (dark surface)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        location.pathname.startsWith('/admin') ? '#0F1117' : '#FFB4A2'
      );
    }
  }, [location.pathname]);
}

// ---------------------------------------------------------------------------
//  Page transition wrapper — every route fades + slides in.
// ---------------------------------------------------------------------------
const pageVariants = {
  initial: { opacity: 0, y: 16, filter: 'blur(8px)' },
  enter:   { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, filter: 'blur(6px)', transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
};

function Page({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  App
// ---------------------------------------------------------------------------
export default function App() {
  useDocumentChrome();
  const location = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <CartProvider>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Page><ClientStorefront /></Page>} />

            {/* Auth gate */}
            <Route path="/admin/login" element={<Page><AdminLogin /></Page>} />

            {/* Admin (protected) */}
            <Route
              path="/admin"
              element={
                <Page>
                  <ProtectedRoute><AdminDashboard /></ProtectedRoute>
                </Page>
              }
            />
            <Route
              path="/admin/new"
              element={
                <Page>
                  <ProtectedRoute><AIProductCreator /></ProtectedRoute>
                </Page>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </CartProvider>
    </MotionConfig>
  );
}
