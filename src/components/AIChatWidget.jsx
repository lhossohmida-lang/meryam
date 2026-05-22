// =============================================================================
//  WALIDA / BARAA KIDS — AI chat widget (storefront concierge)
// -----------------------------------------------------------------------------
//  A floating Sparkles button that opens a glass chat panel anchored above
//  the BottomNav. Talks to Gemini via src/lib/gemini.js with the FULL turn
//  history so every reply has context.
//
//  Design choices:
//    • Welcome greeting is UI-only — Gemini's SDK requires the conversation
//      history to start with a user turn, so we don't push it to `history`.
//    • If VITE_GEMINI_API_KEY is missing the floating button stays hidden,
//      preventing a broken first impression on fresh installs / forks.
//    • Panel uses .glass-strong + a coral hairline to match the storefront
//      bottom nav and product cards.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, AlertCircle } from 'lucide-react';

import { chatWithAssistant, isGeminiConfigured } from '../lib/gemini.js';

const WELCOME_MESSAGE = 'مرحباً! أنا مساعدة براءة كيدز 👗 كيف أقدر أساعدك اليوم؟';

// ---------------------------------------------------------------------------
//  Typing indicator — three dots that breathe in sequence.
// ---------------------------------------------------------------------------
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-coral/70"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Message bubble — coral for the user, glass for the assistant.
// ---------------------------------------------------------------------------
function Bubble({ role, text }) {
  const mine = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
        ${mine
          ? 'self-end text-white rounded-br-md'
          : 'self-start text-ink rounded-bl-md glass'}`}
      style={mine ? { background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)' } : undefined}
    >
      {text}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  AIChatWidget — the whole thing. Single export, drop-in.
// ---------------------------------------------------------------------------
export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    // role:'assistant' is the UI shape (NOT the Gemini SDK shape). Gemini's
    // history is rebuilt before each send below from the user/model turns.
    { role: 'assistant', text: WELCOME_MESSAGE }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to the newest message + focus the input when the panel opens.
  // Hooks must run unconditionally — the "hide when unconfigured" check happens
  // AFTER all hooks are declared (see early-return below).
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // Hide the entire widget when the API key isn't configured. Placed AFTER
  // hooks so React's hook order stays consistent across renders.
  if (!isGeminiConfigured()) return null;

  async function handleSend(e) {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    setInput('');
    setSending(true);

    // Optimistically append the user turn.
    setMessages((prev) => [...prev, { role: 'user', text }]);

    // Build Gemini-shaped history from prior turns ONLY (skip the welcome
    // greeting since it's UI-only and would violate Gemini's "first turn must
    // be a user turn" rule).
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'model')
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

    try {
      const reply = await chatWithAssistant(history, text);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setError(err?.message || 'تعذّر الوصول إلى المساعدة. حاولي لاحقاً.');
    } finally {
      setSending(false);
    }
  }

  // Send on Enter, allow Shift+Enter for newlines.
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  // For rendering, assistant + model bubbles both show on the left.
  const visible = messages.map((m) => ({
    ...m,
    role: m.role === 'model' ? 'assistant' : m.role
  }));

  return (
    <>
      {/* Floating launcher */}
      <motion.button
        type="button"
        aria-label="مساعدة براءة كيدز"
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full grid place-items-center text-white animate-glow"
        style={{
          background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)',
          boxShadow: '0 12px 30px -10px rgba(255, 139, 122, 0.6), 0 0 40px rgba(255, 180, 162, 0.45)'
        }}
      >
        <Sparkles size={22} />
        {/* Soft pulsing halo */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'rgba(255, 139, 122, 0.35)', animationDuration: '2.4s' }}
        />
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="walida-ai-panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{    opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50 border-hairline rounded-[28px] overflow-hidden flex flex-col
                       bottom-4 right-4 left-4
                       sm:left-auto sm:right-4 sm:bottom-4
                       sm:w-[380px] max-h-[78vh] sm:max-h-[72vh] glass-strong"
            style={{ background: 'rgba(255, 245, 242, 0.92)' }}
            role="dialog"
            aria-modal="true"
            aria-label="مساعدة براءة كيدز"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/40">
              <div
                className="grid place-items-center w-10 h-10 rounded-2xl text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)' }}
              >
                <Sparkles size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-arabic text-base font-extrabold text-ink leading-tight">
                  مساعدة براءة كيدز
                </div>
                <div className="text-[11px] text-ink/55 truncate">
                  مقاسات · ألوان · اقتراحات
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid place-items-center w-9 h-9 rounded-full glass text-ink/70 hover:text-ink"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5"
            >
              {visible.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} />
              ))}

              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="self-start glass rounded-2xl rounded-bl-md px-3 py-2"
                >
                  <TypingDots />
                </motion.div>
              )}

              {error && (
                <div className="self-stretch flex items-start gap-2 p-3 rounded-2xl bg-rose-100/80 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 p-3 border-t border-white/40 bg-white/40"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={sending}
                placeholder="اسأليني عن المقاسات أو المنتجات..."
                aria-label="اكتبي رسالتك"
                className="flex-1 bg-white/80 border border-white/80 rounded-2xl px-4 py-2.5
                           text-sm text-ink placeholder:text-ink/40 outline-none
                           focus:border-coral focus:bg-white transition disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid place-items-center w-11 h-11 rounded-2xl text-white shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)' }}
                aria-label="إرسال"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
