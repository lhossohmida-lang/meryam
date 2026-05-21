// =============================================================================
//  WALIDA — ProtectedRoute
// -----------------------------------------------------------------------------
//  Wraps admin pages. Subscribes to Firebase Auth and:
//    • While checking → shows a soft glass loader
//    • If no real (non-anonymous) user → redirects to /admin/login
//    • Otherwise → renders children, passing the auth user via context
// =============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { onUser, isAdminUser } from '../firebase.js';

const AdminContext = createContext(null);
export const useAdminUser = () => useContext(AdminContext);

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ ready: false, user: null });

  useEffect(() => {
    const unsub = onUser((user) => setState({ ready: true, user }));
    return unsub;
  }, []);

  // Soft full-screen loader while we wait for the first auth tick.
  if (!state.ready) {
    return (
      <div className="min-h-screen bg-graphite bg-admin-aurora text-white grid place-items-center">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="glass-dark border-hairline rounded-3xl px-8 py-6 flex items-center gap-3"
        >
          <Loader2 size={16} className="animate-spin text-peach" />
          <span className="text-sm text-white/80">جاري التحقق…</span>
        </motion.div>
      </div>
    );
  }

  if (!isAdminUser(state.user)) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <AdminContext.Provider value={state.user}>
      {children}
    </AdminContext.Provider>
  );
}
