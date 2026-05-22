// =============================================================================
//  WALIDA — Admin AI Assistant (dashboard concierge)
// -----------------------------------------------------------------------------
//  A dark-glass floating assistant that lives inside the admin dashboard.
//  Unlike the storefront widget, this one is CONTEXT-AWARE: it receives the
//  current products, orders, and revenue snapshot and forwards them to Gemini
//  as a fresh system prompt on every send. That means the admin can ask:
//
//    "كم منتج عندي؟"           → counts from the actual list
//    "أعطيني اسم لفستان جديد"   → suggests new product copy
//    "كيف أنظم الطلبات؟"        → workflow advice tailored to the store size
//    "اقترحي سعر تريكو ولد"     → suggests pricing in DZD
//
//  The widget hides itself entirely if VITE_GEMINI_API_KEY isn't configured —
//  same safety pattern as AIChatWidget. Visual palette matches the dashboard
//  (graphite + coral) rather than the cream storefront.
// =============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, AlertCircle, Bot, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

import { chatWithAdminAssistant, isGeminiConfigured } from '../lib/gemini.js';
import {
  useSpeechRecognition,
  speak,
  cancelSpeaking,
  isSpeechSynthesisSupported
} from '../lib/voiceChat.js';

const WELCOME_MESSAGE =
  'مرحباً 👋 أنا مساعدتك في إدارة براءة كيدز.\n' +
  'أقدر أساعدك في: تنظيم الطلبات · اقتراح أسماء وأوصاف للمنتجات · تحليل بياناتك · صياغة ردود للزبائن · ' +
  'وقراءة الأسئلة التي يطرحها الزبائن على الشات في الواجهة الأمامية.\n' +
  'جرّبي تكتبي: "ايش يسأل الزبائن؟" أو "اقترحي اسم لفستان صيفي".';

// Quick-action prompts surfaced as chips below the welcome message.
const QUICK_PROMPTS = [
  'ايش يسأل الزبائن في الشات؟',
  'كم منتج وكم طلب عندي الآن؟',
  'اقترحي 3 أسماء لفستان صيفي زهري',
  'لخّصي شكاوى الزبائن الأخيرة'
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-peach/80"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function Bubble({ role, text }) {
  const mine = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
        ${mine
          ? 'self-end text-white rounded-br-md'
          : 'self-start text-ink/90 rounded-bl-md bg-white/70 border border-ink/10'}`}
      style={mine ? { background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)' } : undefined}
    >
      {text}
    </motion.div>
  );
}

export default function AdminAIAssistant({
  products = [],
  orders = [],
  revenue = 0,
  customerMessages = []
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: WELCOME_MESSAGE }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  // Voice — mic + speaker, same shape as AIChatWidget.
  const [speakReplies, setSpeakReplies] = useState(() => {
    try { return localStorage.getItem('walida.admin.speak') === '1'; } catch { return false; }
  });
  const voice = useSpeechRecognition({ lang: 'ar-DZ' });
  const ttsSupported = isSpeechSynthesisSupported();

  function toggleSpeak() {
    setSpeakReplies((v) => {
      const next = !v;
      try { localStorage.setItem('walida.admin.speak', next ? '1' : '0'); } catch {/* no-op */}
      if (!next) cancelSpeaking();
      return next;
    });
  }

  // Build the live context object once per render — passed to Gemini as the
  // system prompt on every send so the model always sees fresh store state.
  const context = useMemo(() => ({
    products,
    orders,
    revenue,
    customerMessages,
    productCount: products.length,
    orderCount: orders.length
  }), [products, orders, revenue, customerMessages]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  if (!isGeminiConfigured()) return null;

  async function send(textArg) {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;
    setError(null);
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', text }]);

    // Gemini-shaped history (skip the UI-only welcome).
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'model')
      .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

    try {
      const reply = await chatWithAdminAssistant(history, text, context);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
      if (speakReplies) speak(reply, { lang: 'ar-DZ' });
    } catch (err) {
      setError(err?.message || 'تعذّر الوصول إلى المساعدة. حاولي لاحقاً.');
    } finally {
      setSending(false);
    }
  }

  function handleMic() {
    if (voice.listening) {
      voice.stop();
    } else {
      voice.start((finalText) => {
        if (finalText) send(finalText);
      });
    }
  }

  function handleSubmit(e) {
    e?.preventDefault?.();
    send();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const visible = messages.map((m) => ({
    ...m,
    role: m.role === 'model' ? 'assistant' : m.role
  }));

  // Show quick-action chips only when the welcome message is still the
  // only assistant turn (i.e. the admin hasn't started chatting yet).
  const showQuickPrompts = visible.length === 1 && !sending;

  return (
    <>
      {/* Floating launcher — coral glow against the graphite dashboard. */}
      <motion.button
        type="button"
        aria-label="مساعدة الإدارة"
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full grid place-items-center text-white animate-glow"
        style={{
          background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)',
          boxShadow: '0 12px 30px -10px rgba(255, 139, 122, 0.6), 0 0 40px rgba(255, 180, 162, 0.45)'
        }}
      >
        <Bot size={22} />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'rgba(255, 139, 122, 0.35)', animationDuration: '2.4s' }}
        />
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="walida-admin-ai"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{    opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50 border-hairline rounded-[28px] overflow-hidden flex flex-col
                       bottom-6 right-6 left-6
                       sm:left-auto sm:right-6 sm:bottom-6
                       sm:w-[420px] max-h-[80vh] sm:max-h-[78vh] glass-strong"
            role="dialog"
            aria-modal="true"
            aria-label="مساعدة الإدارة"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-ink/10">
              <div
                className="grid place-items-center w-10 h-10 rounded-2xl text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)' }}
              >
                <Sparkles size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-arabic text-base font-extrabold text-ink leading-tight">
                  مساعدة الإدارة
                </div>
                <div className="text-[11px] text-ink/55 truncate">
                  {products.length} منتج · {orders.length} طلب · {customerMessages.length} رسالة شات
                </div>
              </div>
              {ttsSupported && (
                <button
                  type="button"
                  onClick={toggleSpeak}
                  className={`grid place-items-center w-9 h-9 rounded-full bg-ink/5 transition
                    ${speakReplies ? 'text-coral' : 'text-ink/65 hover:text-ink'}`}
                  aria-label={speakReplies ? 'إيقاف القراءة الصوتية' : 'تشغيل القراءة الصوتية'}
                  title={speakReplies ? 'القراءة الصوتية مفعّلة' : 'تشغيل القراءة الصوتية'}
                >
                  {speakReplies ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid place-items-center w-9 h-9 rounded-full bg-ink/5 text-ink/65 hover:text-ink"
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

              {showQuickPrompts && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="self-start mt-2 flex flex-wrap gap-2 max-w-full"
                >
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p)}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-ink/5 border border-ink/10 text-ink/80
                                 hover:bg-ink/10 hover:text-ink transition"
                    >
                      {p}
                    </button>
                  ))}
                </motion.div>
              )}

              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="self-start bg-white/70 border border-ink/10 rounded-2xl rounded-bl-md px-3 py-2"
                >
                  <TypingDots />
                </motion.div>
              )}

              {error && (
                <div className="self-stretch flex items-start gap-2 p-3 rounded-2xl bg-rose-400/10 border border-rose-400/30 text-rose-200 text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Voice transcript preview */}
            {voice.listening && (
              <div className="px-3 pt-2 text-[11px] text-coral flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-coral animate-pulse" />
                <span className="truncate">{voice.transcript || 'أنا أستمع…'}</span>
              </div>
            )}
            {voice.error && (
              <div className="px-3 pt-2 text-[11px] text-rose-600">
                {voice.error}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 p-3 border-t border-ink/10 bg-white/55"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={sending || voice.listening}
                placeholder={voice.listening ? 'أنا أستمع…' : 'اكتبي سؤالك أو طلبك...'}
                aria-label="اكتبي سؤالك"
                className="flex-1 bg-white/70 border border-ink/10 rounded-2xl px-4 py-2.5
                           text-sm text-ink placeholder:text-ink/30 outline-none
                           focus:border-coral focus:bg-white/90 transition disabled:opacity-60"
              />
              {voice.supported && (
                <button
                  type="button"
                  onClick={handleMic}
                  disabled={sending}
                  className={`grid place-items-center w-11 h-11 rounded-2xl shrink-0 transition
                    ${voice.listening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-white/80 text-coral border border-ink/10 hover:bg-white/95'}`}
                  aria-label={voice.listening ? 'إيقاف التسجيل' : 'تحدّثي'}
                  title={voice.listening ? 'إيقاف التسجيل' : 'تحدّثي بدل الكتابة'}
                >
                  {voice.listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
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
