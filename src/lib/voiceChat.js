// =============================================================================
//  WALIDA — Voice chat helpers (Web Speech API)
// -----------------------------------------------------------------------------
//  Browser-native voice I/O for the AI surfaces:
//    • useSpeechRecognition(opts) — React hook for microphone → text
//    • speak(text, opts)           — text-to-speech for AI replies
//    • cancelSpeaking()            — stop any in-flight speech
//    • isSpeechRecognitionSupported() / isSpeechSynthesisSupported()
//
//  Browser support (verified):
//    • Chrome / Edge      → full (uses webkitSpeechRecognition fallback)
//    • Safari iOS 14.5+   → full
//    • Firefox            → TTS works, recognition is gated behind a flag
//
//  Language: defaults to `ar-DZ` (Algerian Arabic) for both recognition and
//  synthesis so it matches the rest of the app's voice. The recognition API
//  silently falls back to a closer locale if `ar-DZ` isn't installed.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getRecognitionCtor());
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ---------------------------------------------------------------------------
//  useSpeechRecognition — microphone → transcript.
//
//  Returns:
//    transcript      live updated as the user speaks
//    listening       true while the mic is hot
//    supported       false on browsers without Web Speech (e.g. Firefox)
//    error           friendly Arabic error string or null
//    start(onFinal)  begin a one-shot recording. onFinal(text) fires when
//                    the user pauses and the engine finalises the result.
//    stop()          end recording early (also fires onFinal with what we
//                    have so far).
// ---------------------------------------------------------------------------
export function useSpeechRecognition({ lang = 'ar-DZ' } = {}) {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [supported] = useState(isSpeechRecognitionSupported);
  const recRef = useRef(null);
  const finalCbRef = useRef(null);

  // Clean up the recognition instance on unmount so we don't leak listeners
  // or keep the microphone hot.
  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort?.();
      } catch {/* no-op */}
      recRef.current = null;
    };
  }, []);

  const start = useCallback((onFinal) => {
    setError(null);
    setTranscript('');
    finalCbRef.current = typeof onFinal === 'function' ? onFinal : null;

    const SR = getRecognitionCtor();
    if (!SR) {
      setError('متصفّحك لا يدعم التعرّف الصوتي. استخدمي Chrome أو Edge.');
      return;
    }

    let rec;
    try {
      rec = new SR();
    } catch (e) {
      setError('تعذّر بدء الميكروفون.');
      return;
    }

    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    let lastInterim = '';
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      lastInterim = text;
      setTranscript(text);
    };
    rec.onerror = (e) => {
      const code = e.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('الميكروفون غير مفعّل. اسمحي للموقع باستخدامه.');
      } else if (code === 'no-speech') {
        setError('لم أسمع شيئاً، حاولي مرّة أخرى.');
      } else if (code === 'aborted') {
        // user stop — not a real error
      } else {
        setError('خطأ في التعرّف الصوتي: ' + code);
      }
    };
    rec.onend = () => {
      setListening(false);
      const final = lastInterim.trim();
      if (final && finalCbRef.current) {
        finalCbRef.current(final);
      }
    };

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (e) {
      setListening(false);
      setError('تعذّر بدء التسجيل.');
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop?.();
    } catch {/* no-op */}
  }, []);

  return { transcript, listening, supported, error, start, stop };
}

// ---------------------------------------------------------------------------
//  speak(text, opts) — read AI replies aloud. Cancels any in-flight speech
//  first so back-to-back calls don't queue up.
//
//  voice pick: prefer a female Arabic voice when one is installed (Microsoft
//  / Apple ship them on most platforms); otherwise fall back to default.
// ---------------------------------------------------------------------------
function pickArabicVoice() {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices?.length) return null;
  // Preferred order: ar-DZ, ar-EG, ar-SA, any ar-*, any voice
  const ranked = voices
    .map((v) => {
      const lang = (v.lang || '').toLowerCase();
      let score = 0;
      if (lang === 'ar-dz') score = 100;
      else if (lang === 'ar-eg') score = 80;
      else if (lang === 'ar-sa') score = 70;
      else if (lang.startsWith('ar')) score = 60;
      // gentle female bias by name heuristics
      const name = (v.name || '').toLowerCase();
      if (/female|woman|laila|amira|salma|hala|reem/.test(name)) score += 5;
      return { v, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.v ?? null;
}

export function speak(text, { lang = 'ar-DZ', rate = 1.0, pitch = 1.0 } = {}) {
  if (!isSpeechSynthesisSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // stop anything currently playing
  const utter = new SpeechSynthesisUtterance(String(text ?? ''));
  utter.lang = lang;
  utter.rate = rate;
  utter.pitch = pitch;
  const voice = pickArabicVoice();
  if (voice) utter.voice = voice;
  synth.speak(utter);
}

export function cancelSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
