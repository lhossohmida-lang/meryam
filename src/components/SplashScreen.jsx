// =============================================================================
//  WALIDA — Splash screen (storefront entry intro)
// -----------------------------------------------------------------------------
//  Plays a short brand video every time a visitor opens / refreshes the
//  storefront, then fades out and calls onComplete(). Two assets ship in
//  `public/splash/`:
//
//    • intro-mobile.mp4   → portrait video for narrow viewports
//    • intro-desktop.mp4  → landscape video for wider viewports
//
//  Selection runs once at mount based on `window.innerWidth` (cheap, accurate
//  enough). We don't react to resize mid-play because the splash is ~4s — by
//  the time the user rotates their device the intro is already gone.
//
//  Behaviour:
//    • Auto-plays muted (browser autoplay policies require muted on mobile).
//    • Dismisses on whichever fires first: the 4-second cap, the video's own
//      `onEnded`, a tap, or any key press. That keeps the wait short even if
//      the video is longer than the cap.
//    • Fixed full-viewport overlay with high z-index; covers everything.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

// Hard cap on how long visitors wait before the storefront appears.
// The video itself can be longer — we cut it short with this timer; or
// shorter — `onEnded` triggers dismiss earlier. Whichever comes first wins.
const SPLASH_DURATION_MS = 4000;
const MOBILE_BREAKPOINT_PX = 768;

function pickVideoSrc() {
  if (typeof window === 'undefined') return '/splash/intro-desktop.mp4';
  return window.innerWidth < MOBILE_BREAKPOINT_PX
    ? '/splash/intro-mobile.mp4'
    : '/splash/intro-desktop.mp4';
}

export default function SplashScreen({ onComplete }) {
  const [src] = useState(pickVideoSrc);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef(null);
  const doneRef = useRef(false);

  // Single dismiss path — used by the timer, the skip handler, and the video
  // `onEnded` event. Idempotent via doneRef so onComplete fires exactly once.
  function dismiss() {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    // Match the exit transition duration below before unmounting.
    setTimeout(() => onComplete?.(), 450);
  }

  useEffect(() => {
    const timer = setTimeout(dismiss, SPLASH_DURATION_MS);
    const onKey = () => dismiss();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Some browsers (notably iOS Safari) refuse autoplay until play() is called
  // from a user gesture OR the element is muted+playsinline. We set both
  // attributes below; this useEffect adds an explicit play() call as a belt-
  // and-suspenders fallback for browsers that still drag their feet.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => v.play().catch(() => {/* swallow — user can tap */});
    tryPlay();
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-label="مقدّمة براءة كيدز"
      onClick={dismiss}
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] bg-black grid place-items-center overflow-hidden cursor-pointer"
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Subtle "skip" hint, fades in halfway through so it doesn't compete
          with the brand opening. */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-xs tracking-[0.3em]"
      >
        تخطّي
      </motion.span>
    </motion.div>
  );
}
