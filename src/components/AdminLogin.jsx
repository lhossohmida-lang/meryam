// =============================================================================
//  WALIDA — Admin Login
// -----------------------------------------------------------------------------
//  Email + password gate for the admin portal. Uses Firebase Auth.
//  Same dark-glass aesthetic as the dashboard. Supports:
//    • Sign in
//    • Sign up (first-time admin creation)
//    • Password reset (email link)
// =============================================================================

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Loader2, ArrowRight, Sparkles, AlertCircle,
  CheckCircle2, Eye, EyeOff, UserPlus
} from 'lucide-react';

import {
  adminSignIn, adminSignUp, adminResetPassword
} from '../firebase.js';

const MODES = { SIGNIN: 'signin', SIGNUP: 'signup' };

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/admin';

  const [mode, setMode] = useState(MODES.SIGNIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email || !password) return setError('أدخل البريد وكلمة المرور.');
    setBusy(true);
    try {
      if (mode === MODES.SIGNIN) await adminSignIn(email, password);
      else                       await adminSignUp(email, password, name);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) return setError('أدخل البريد أولاً لإرسال رابط الاستعادة.');
    setError(null); setBusy(true);
    try {
      await adminResetPassword(email);
      setInfo('أُرسل رابط إعادة التعيين إلى بريدك.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === MODES.SIGNUP;

  return (
    <div className="min-h-screen bg-pearl bg-aurora text-ink grid place-items-center p-4">
      {/* Decorative glow blobs */}
      <div aria-hidden className="absolute top-10 left-10 w-60 h-60 rounded-full bg-coral/30 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md glass-strong border-hairline rounded-[32px] p-8"
      >
        {/* Header */}
        <div className="text-center mb-7">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid place-items-center w-14 h-14 mx-auto rounded-3xl bg-coral-peach shadow-glow"
          >
            <Sparkles className="text-white" size={20} />
          </motion.div>
          <h1 className="font-arabic mt-4 text-3xl font-extrabold">براءة</h1>
          <p className="text-shimmer text-[11px] tracking-[0.45em] font-semibold">
            BARAA KIDS · STUDIO
          </p>
          <p className="text-sm text-ink/55 mt-3">
            {isSignup
              ? 'أنشئ حساب الإدارة الأول لتبدأ.'
              : 'سجّل دخولك للوصول إلى لوحة الإدارة.'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-white/5 border border-white/10 rounded-2xl">
          {[
            { id: MODES.SIGNIN, label: 'تسجيل الدخول' },
            { id: MODES.SIGNUP, label: 'حساب جديد' }
          ].map((t) => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setMode(t.id); setError(null); setInfo(null); }}
                className={`relative py-2 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'text-white' : 'text-ink/55 hover:text-ink/80'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-coral to-peach"
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <AnimatePresence>
            {isSignup && (
              <motion.label
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="block"
              >
                <span className="text-xs uppercase tracking-[0.2em] text-ink/55">الاسم</span>
                <div className="mt-2 relative">
                  <UserPlus size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسم العرض"
                    className="w-full bg-white/[0.06] border border-white/10 rounded-2xl pl-11 pr-4 py-3
                               text-white placeholder:text-ink/30 outline-none
                               focus:border-coral focus:bg-white/[0.09] transition"
                  />
                </div>
              </motion.label>
            )}
          </AnimatePresence>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink/55">البريد الإلكتروني</span>
            <div className="mt-2 relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@walida.shop"
                className="w-full bg-white/[0.06] border border-white/10 rounded-2xl pl-11 pr-4 py-3
                           text-white placeholder:text-ink/30 outline-none
                           focus:border-coral focus:bg-white/[0.09] transition"
              />
            </div>
          </label>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-ink/55">كلمة المرور</span>
              {!isSignup && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] text-peach/90 hover:text-peach underline-offset-2 hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </div>
            <div className="mt-2 relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? '6 أحرف على الأقل' : '••••••••'}
                className="w-full bg-white/[0.06] border border-white/10 rounded-2xl pl-11 pr-12 py-3
                           text-white placeholder:text-ink/30 outline-none
                           focus:border-coral focus:bg-white/[0.09] transition"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-ink/80"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-2xl bg-rose-400/10 border border-rose-400/30 text-rose-200 text-sm"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            {info && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-400/10 border border-emerald-400/30 text-emerald-200 text-sm"
              >
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                <span>{info}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="btn-coral w-full mt-2 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {isSignup ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>

        <p className="text-[11px] text-center text-ink/40 mt-6 leading-relaxed">
          الوصول للوحة الإدارة محمي بـ Firebase Auth.<br />
          لتفعيل البريد/كلمة المرور: Console → Authentication → Sign-in method → Email/Password.
        </p>
      </motion.div>
    </div>
  );
}
