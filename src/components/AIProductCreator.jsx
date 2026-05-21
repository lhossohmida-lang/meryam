// =============================================================================
//  WALIDA — AI Product Creator (Multi-image edition)
// -----------------------------------------------------------------------------
//  Drag-and-drop multiple images into the studio. Each one becomes part of
//  the product gallery. The admin picks ONE image as the "3D source" — that
//  image is sent through the generative pipeline (Tripo3D / Meshy) to produce
//  a `.glb` model for the interactive WebGL card.
//
//  Final Firestore record shape:
//    {
//      nameAr, nameEn, price, category,
//      images:  [{ url, is3DSource }],   // gallery (any size, primary marked)
//      imageUrl: string,                  // convenience: the 3D-source URL
//      modelUrl: string,                  // .glb on Firebase Storage
//      jobId, source, createdAt
//    }
//
//  UI states:  idle → generating → saving → done | error
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Image as ImageIcon, Sparkles, Loader2, ArrowLeft,
  CheckCircle2, AlertCircle, Wand2, Boxes, X, Box, Plus, Image
} from 'lucide-react';

import { convertImageTo3D } from '../lib/aiPipeline.js';
import { saveProduct, recordGenerationJob, pingFirebase } from '../firebase.js';
import {
  uploadToCloudinary,
  pingCloudinary,
  isCloudinaryConfigured,
  cloudinaryConfig
} from '../lib/cloudinary.js';

// ---------------------------------------------------------------------------
//  Glowing loading spinner — tri-ring SVG with the brand gradient and a
//  pulsing glow halo.
// ---------------------------------------------------------------------------
function GlowSpinner({ percent = 0, label = 'Working…' }) {
  const r = 60, c = 2 * Math.PI * r;
  const dash = c - (c * percent) / 100;
  return (
    <div className="relative grid place-items-center">
      <div className="absolute inset-0 rounded-full glow-ring animate-glow" />
      <svg width="160" height="160" viewBox="0 0 160 160" className="rotate-[-90deg]">
        <defs>
          <linearGradient id="walida-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%"   stopColor="#FF8B7A" />
            <stop offset="50%"  stopColor="#FFB4A2" />
            <stop offset="100%" stopColor="#E7D9FF" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
        <circle
          cx="80" cy="80" r={r}
          stroke="url(#walida-ring)"
          strokeWidth="6" strokeLinecap="round" fill="none"
          strokeDasharray={c} strokeDashoffset={dash}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <Sparkles className="mx-auto text-peach mb-1" size={18} />
        <div className="text-white font-semibold text-2xl">{Math.round(percent)}%</div>
        <div className="text-white/60 text-xs max-w-[140px] mx-auto leading-tight mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Local helpers — produce a stable, in-memory record for each picked file
//  so previews and "3D source" picking don't reset between renders.
// ---------------------------------------------------------------------------
function makeAsset(file) {
  return {
    id: cryptoId(),
    file,
    preview: URL.createObjectURL(file),
    mode: '2d'   // default — admin toggles to '3d' per image
  };
}

function cryptoId() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replaceAll('-', '');
}

// ---------------------------------------------------------------------------
//  Multi-image drop zone — accepts many files at once, supports click-to-pick.
// ---------------------------------------------------------------------------
function DropZone({ onFiles, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback((list) => {
    const imgs = Array.from(list || []).filter((f) => f.type.startsWith('image/'));
    if (imgs.length) onFiles(imgs);
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) accept(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative rounded-3xl border border-dashed transition-all overflow-hidden cursor-pointer
        ${dragging ? 'border-coral bg-white/10' : 'border-white/20 bg-white/[0.04]'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/[0.08]'}
        min-h-[200px] grid place-items-center text-center px-6 py-10`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => accept(e.target.files)}
      />
      <div>
        <div className="grid place-items-center w-14 h-14 mx-auto rounded-3xl bg-gradient-to-br from-coral to-peach shadow-glow">
          <Upload className="text-white" size={20} />
        </div>
        <h3 className="mt-4 text-white font-semibold">اسحب صور المنتج هنا</h3>
        <p className="text-white/55 text-sm mt-1 max-w-md mx-auto">
          يمكنك إضافة عدة صور — اختاري واحدة منها كمصدر للنموذج ثلاثي الأبعاد.
        </p>
        <button type="button" className="btn-pill mt-4 !bg-white/10 !text-white/90 !border-white/15">
          <Plus size={14} />
          اختر صور
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Gallery strip — each thumbnail has an independent 2D/3D toggle. Any
//  number of images can be marked for 3D conversion (or none).
// ---------------------------------------------------------------------------
function GalleryStrip({ assets, setMode, removeAsset, disabled }) {
  if (!assets.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      <AnimatePresence>
        {assets.map((a, i) => {
          const is3D = a.mode === '3d';
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className={`relative group rounded-2xl overflow-hidden border transition-all
                ${is3D
                  ? 'border-coral shadow-[0_0_0_2px_rgba(255,139,122,0.35),0_18px_40px_-15px_rgba(255,139,122,0.5)]'
                  : 'border-white/10'}`}
            >
              <div className="relative aspect-square">
                <img src={a.preview} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0" />

                {/* Remove */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAsset(a.id)}
                  className="absolute top-2 right-2 grid place-items-center w-7 h-7 rounded-full bg-black/55 text-white/90 backdrop-blur hover:bg-black/80"
                  aria-label="remove"
                >
                  <X size={12} />
                </button>

                <div className="absolute bottom-2 right-2 left-2 text-[10px] text-white/85 truncate">
                  {a.file.name}
                </div>
              </div>

              {/* Per-image mode toggle */}
              <div className="grid grid-cols-2 gap-0 bg-black/55 backdrop-blur border-t border-white/10">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setMode(a.id, '2d')}
                  className={`relative py-2 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors
                    ${!is3D ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
                >
                  {!is3D && (
                    <motion.span
                      layoutId={`mode-bg-${a.id}`}
                      className="absolute inset-0 bg-gradient-to-br from-baby to-lavender opacity-90"
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">
                    <Image size={11} /> 2D
                  </span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setMode(a.id, '3d')}
                  className={`relative py-2 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors
                    ${is3D ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
                >
                  {is3D && (
                    <motion.span
                      layoutId={`mode-bg-${a.id}`}
                      className="absolute inset-0 bg-gradient-to-br from-coral to-peach"
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">
                    <Box size={11} /> 3D
                  </span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Form fields — minimal but real.
// ---------------------------------------------------------------------------
function Field({ label, hint, ...props }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/55">{label}</span>
      <input
        {...props}
        className="mt-2 w-full bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3
                   text-white placeholder:text-white/30 outline-none
                   focus:border-coral focus:bg-white/[0.09] transition"
      />
      {hint && <span className="text-[11px] text-white/40 mt-1 block">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
//  Main component
// ---------------------------------------------------------------------------
const STATES = {
  IDLE: 'idle',
  GENERATING: 'generating',
  SAVING: 'saving',
  DONE: 'done',
  ERROR: 'error'
};

// ---------------------------------------------------------------------------
//  Setup banner — shown when Cloudinary isn't configured / reachable. Gives
//  exact step-by-step setup instructions inline.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
//  Setup banner — Firebase / Firestore not ready.
// ---------------------------------------------------------------------------
function FirebaseSetupBanner({ onRetry, reason, errorMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 glass-dark border-hairline rounded-3xl p-5 relative overflow-hidden"
    >
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-sky-400 to-fuchsia-400 opacity-25 blur-3xl" />
      <div className="flex items-start gap-3 relative">
        <div className="grid place-items-center w-10 h-10 rounded-2xl bg-sky-400/15 border border-sky-400/30 shrink-0">
          <AlertCircle size={18} className="text-sky-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold">
            {reason === 'auth' ? 'تسجيل الدخول المجهول غير مُفعّل' : 'Firestore غير مُهيّأ بعد'}
          </h4>
          {errorMessage && (
            <p className="mt-2 text-xs text-rose-200 bg-rose-400/10 border border-rose-400/20 rounded-xl px-3 py-2">
              <span className="opacity-70">رسالة:</span> {errorMessage}
            </p>
          )}
          <p className="text-sm text-white/65 mt-2">
            مرتين نقر في Firebase Console — وكل شيء يعمل:
          </p>
          <ol className="mt-3 grid gap-2 text-sm text-white/75 list-decimal pr-5">
            <li>
              <a href="https://console.firebase.google.com/project/mreim-3027a/firestore"
                 target="_blank" rel="noreferrer"
                 className="text-peach underline underline-offset-2">
                Firestore Database
              </a>{' '}→ <span className="text-white font-semibold">Create database</span> → اختاري الموقع (eur3 أو us-central1) → <span className="text-white font-semibold">Start in production mode</span>.
            </li>
            <li>
              <a href="https://console.firebase.google.com/project/mreim-3027a/authentication/providers"
                 target="_blank" rel="noreferrer"
                 className="text-peach underline underline-offset-2">
                Authentication → Sign-in method
              </a>{' '}→ Anonymous → <span className="text-white font-semibold">Enable</span>.
            </li>
            <li>
              في{' '}
              <a href="https://console.firebase.google.com/project/mreim-3027a/firestore/rules"
                 target="_blank" rel="noreferrer"
                 className="text-peach underline underline-offset-2">
                Rules
              </a>
              {' '}الصقي محتوى ملف <code className="text-peach">firestore.rules</code> الموجود في جذر المشروع، ثم <span className="text-white font-semibold">Publish</span>.
            </li>
          </ol>
          <button
            onClick={onRetry}
            className="btn-pill mt-4 !bg-white/10 !text-white/90 !border-white/15"
          >
            <Sparkles size={12} /> أعد الفحص
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CloudinarySetupBanner({ onRetry, reason, errorMessage }) {
  const cfg = cloudinaryConfig();
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 glass-dark border-hairline rounded-3xl p-5 relative overflow-hidden"
    >
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 opacity-25 blur-3xl" />
      <div className="flex items-start gap-3 relative">
        <div className="grid place-items-center w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 shrink-0">
          <AlertCircle size={18} className="text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold">
            {reason === 'missing-env'
              ? 'Cloudinary غير مُعدّ بعد'
              : 'تعذّر الاتصال بـ Cloudinary'}
          </h4>
          {errorMessage && (
            <p className="mt-2 text-xs text-rose-200 bg-rose-400/10 border border-rose-400/20 rounded-xl px-3 py-2">
              <span className="opacity-70">رسالة Cloudinary:</span> {errorMessage}
            </p>
          )}
          <p className="text-sm text-white/65 mt-2">
            Cloudinary مجاني (25GB) — الإعداد دقيقتان فقط:
          </p>
          <ol className="mt-3 grid gap-2 text-sm text-white/75 list-decimal pr-5">
            <li>
              أنشئ حساب على{' '}
              <a href="https://cloudinary.com/users/register_free"
                 target="_blank" rel="noreferrer"
                 className="text-peach underline underline-offset-2">
                cloudinary.com
              </a>{' '}(بلا بطاقة).
            </li>
            <li>
              من الـ Dashboard انسخ <span className="text-white font-semibold">Cloud name</span>.
            </li>
            <li>
              <a href="https://console.cloudinary.com/settings/upload"
                 target="_blank" rel="noreferrer"
                 className="text-peach underline underline-offset-2">
                Settings → Upload
              </a>
              {' '}→ Add upload preset → <span className="text-white font-semibold">Signing mode: Unsigned</span> → Save.
            </li>
            <li>
              أضف القيمتين في ملف <code className="text-peach">.env</code> في جذر المشروع:
              <code className="block mt-1 text-[11px] bg-black/40 rounded-lg p-2 text-emerald-300/90 leading-relaxed font-mono">
                VITE_CLOUDINARY_CLOUD_NAME=&lt;cloud-name&gt;<br />
                VITE_CLOUDINARY_UPLOAD_PRESET=&lt;preset-name&gt;
              </code>
            </li>
            <li>
              أعد تشغيل <code className="text-peach">npm run dev</code>.
            </li>
          </ol>
          {cfg.cloudName && (
            <p className="text-xs text-white/40 mt-3">
              القيمة المُكتشفة حالياً: cloud=<span className="text-white/70">{cfg.cloudName}</span>
              {' · '}preset=<span className="text-white/70">{cfg.preset || '—'}</span>
            </p>
          )}
          <button
            onClick={onRetry}
            className="btn-pill mt-4 !bg-white/10 !text-white/90 !border-white/15"
          >
            <Sparkles size={12} /> أعد الفحص
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function AIProductCreator() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]); // [{id, file, preview, is3DSource}]
  const [meta, setMeta] = useState({ nameAr: '', nameEn: '', price: '', category: '' });
  const [state, setState] = useState(STATES.IDLE);
  const [progress, setProgress] = useState({ percent: 0, label: '' });
  const [error, setError] = useState(null);
  const [savedProductId, setSavedProductId] = useState(null);
  const [cloudOk, setCloudOk] = useState(null);
  const [cloudReason, setCloudReason] = useState(null);
  const [cloudErrorMsg, setCloudErrorMsg] = useState(null);

  const [fbOk, setFbOk] = useState(null);
  const [fbReason, setFbReason] = useState(null);
  const [fbErrorMsg, setFbErrorMsg] = useState(null);

  // Verify Cloudinary + Firebase on mount and on demand.
  async function runHealthCheck() {
    setCloudOk(null);
    setFbOk(null);
    setCloudErrorMsg(null);
    setFbErrorMsg(null);

    // Cloudinary
    if (!isCloudinaryConfigured()) {
      setCloudReason('missing-env');
      setCloudOk(false);
    } else {
      const c = await pingCloudinary();
      setCloudReason(c.ok ? null : 'unreachable');
      setCloudErrorMsg(c.ok ? null : (c.error?.message || null));
      setCloudOk(c.ok);
    }

    // Firebase (auth + Firestore)
    const f = await pingFirebase();
    setFbReason(f.ok ? null : f.reason);
    setFbErrorMsg(f.ok ? null : (f.error?.message || null));
    setFbOk(f.ok);
  }
  useEffect(() => { runHealthCheck(); }, []);

  function addFiles(files) {
    setAssets((prev) => [...prev, ...files.map(makeAsset)]);
  }

  function removeAsset(id) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  function setMode(id, mode) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, mode } : a)));
  }

  // Clean up object URLs on unmount.
  useEffect(() => () => assets.forEach((a) => URL.revokeObjectURL(a.preview)), []); // eslint-disable-line

  function reset() {
    assets.forEach((a) => URL.revokeObjectURL(a.preview));
    setAssets([]);
    setMeta({ nameAr: '', nameEn: '', price: '', category: '' });
    setProgress({ percent: 0, label: '' });
    setError(null);
    setSavedProductId(null);
    setState(STATES.IDLE);
  }

  async function handleGenerate() {
    if (!assets.length) return setError('الرجاء إضافة صورة واحدة على الأقل.');
    if (!meta.nameAr || !meta.price) return setError('الاسم والسعر مطلوبان.');

    setError(null);
    setState(STATES.SAVING);
    setProgress({ percent: 2, label: 'Preparing studio…' });

    const jobId = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))
      .replaceAll('-', '');
    const total = assets.length;
    // Each image takes one "slot"; 3D-flagged images take an extra slot for
    // the model conversion + upload. Used to keep the progress bar honest.
    const slots = total + assets.filter((a) => a.mode === '3d').length;
    let done = 0;
    const setStep = (label, frac = 0) =>
      setProgress({
        percent: Math.min(2 + ((done + frac) / slots) * 95, 97),
        label
      });

    try {
      const uploads = [];

      for (let i = 0; i < total; i++) {
        const a = assets[i];
        const baseLabel = `الصورة ${i + 1}/${total} · رفع`;

        // a) Upload the photo itself (gallery asset).
        setStep(baseLabel, 0);
        const { url: imageUrl } = await uploadToCloudinary(a.file, {
          resourceType: 'image',
          folder: `walida/products/${jobId}`,
          publicId: a.id,
          onProgress: (p) => setStep(`${baseLabel} · ${Math.round(p)}%`, p / 100)
        });
        done += 1;

        let modelUrl = null;

        // b) If this image is marked '3d', run the AI pipeline + upload .glb.
        if (a.mode === '3d') {
          const stage = `الصورة ${i + 1}/${total} · تحويل 3D`;
          setStep(stage, 0);
          const { blob, simulated } = await convertImageTo3D(a.file, {
            onProgress: (p) => setStep(`${stage} · ${Math.round(p.percent)}%`, p.percent / 100 * 0.7)
          });
          if (blob && !simulated) {
            try {
              setStep(`${stage} · رفع النموذج…`, 0.7);
              const res = await uploadToCloudinary(blob, {
                resourceType: 'raw',
                folder: 'walida/models',
                publicId: `${a.id}.glb`,
                onProgress: (p) => setStep(`${stage} · رفع النموذج · ${Math.round(p)}%`, 0.7 + (p / 100) * 0.3)
              });
              modelUrl = res.url;
            } catch (e) {
              console.warn('[walida] .glb upload skipped:', e.message);
            }
          }
          done += 1;
        }

        uploads.push({
          url: imageUrl,
          mode: a.mode,           // '2d' | '3d'
          modelUrl                // null for 2D, Cloudinary URL for 3D (when real)
        });
      }

      // Persist the product (97% → 100%).
      setProgress({ percent: 98, label: 'جاري حفظ المنتج…' });
      const primaryUrl =
        uploads.find((u) => u.mode === '3d' && u.modelUrl)?.url ?? uploads[0].url;
      const productModelUrl = uploads.find((u) => u.modelUrl)?.modelUrl ?? null;

      const productId = await saveProduct({
        nameAr: meta.nameAr,
        nameEn: meta.nameEn || meta.nameAr,
        price: Number(meta.price),
        category: meta.category || 'general',
        images: uploads,           // [{ url, mode, modelUrl }]
        imageUrl: primaryUrl,      // convenience: primary photo
        modelUrl: productModelUrl, // convenience: first available .glb
        jobId,
        source: 'ai-pipeline'
      });

      await recordGenerationJob(jobId, {
        productId, status: 'success', images: uploads
      });

      setSavedProductId(productId);
      setProgress({ percent: 100, label: 'تم!' });
      setState(STATES.DONE);
    } catch (err) {
      console.error('[walida] generate failed', err);
      setError(err?.message || 'حدث خطأ غير متوقع أثناء الرفع.');
      setState(STATES.ERROR);
    }
  }

  const busy = state === STATES.GENERATING || state === STATES.SAVING;
  const count2D = assets.filter((a) => a.mode === '2d').length;
  const count3D = assets.filter((a) => a.mode === '3d').length;

  return (
    <div className="min-h-screen bg-graphite bg-admin-aurora text-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8" dir="ltr">

        {/* Topbar */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/admin" className="glass-dark inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm text-white/80 hover:text-white">
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="text-center">
            <div className="font-arabic text-xl font-extrabold">منشئ المنتجات بالذكاء الاصطناعي</div>
            <div className="text-shimmer text-[10px] tracking-[0.4em] font-semibold">AI PRODUCT CREATOR</div>
          </div>
          <span className="chip bg-white/5 border-white/10 text-white/70">
            <Sparkles size={12} className="text-peach" /> 2D → 3D
          </span>
        </div>

        {/* Setup banners — only show when a service isn't reachable */}
        {fbOk === false && (
          <FirebaseSetupBanner
            onRetry={runHealthCheck}
            reason={fbReason}
            errorMessage={fbErrorMsg}
          />
        )}
        {cloudOk === false && (
          <CloudinarySetupBanner
            onRetry={runHealthCheck}
            reason={cloudReason}
            errorMessage={cloudErrorMsg}
          />
        )}

        {/* Two-column workspace */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Upload + gallery */}
          <div className="glass-dark rounded-3xl p-5 border-hairline">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-semibold">معرض الصور</h3>
              {assets.length > 0 && (
                <span className="chip bg-white/5 border-white/10 text-white/70">
                  {assets.length} {assets.length === 1 ? 'صورة' : 'صور'}
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 mb-4">
              أضيفي عدة صور — ثم اختاري لكل صورة: تبقى كما هي 2D أم تتحوّل إلى نموذج 3D.
            </p>

            <DropZone onFiles={addFiles} disabled={busy} />

            <GalleryStrip
              assets={assets}
              setMode={setMode}
              removeAsset={removeAsset}
              disabled={busy}
            />

            {assets.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs text-white/55 gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2">
                  <span className="chip bg-white/5 border-white/10 text-white/75">
                    <Image size={11} /> {count2D} صورة 2D
                  </span>
                  <span className="chip bg-coral/15 border-coral/30 text-peach">
                    <Box size={11} /> {count3D} نموذج 3D
                  </span>
                </div>
                {!busy && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-white/50 hover:text-white inline-flex items-center gap-1"
                  >
                    <X size={11} /> مسح الكل
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metadata + action */}
          <div className="glass-dark rounded-3xl p-5 border-hairline">
            <h3 className="text-white font-semibold mb-1">تفاصيل المنتج</h3>
            <p className="text-xs text-white/50 mb-4">
              ستظهر مباشرة على الواجهة الأمامية بعد المعالجة.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="الاسم بالعربية"
                placeholder="فستان صيفي زهري"
                value={meta.nameAr}
                onChange={(e) => setMeta({ ...meta, nameAr: e.target.value })}
              />
              <Field
                label="Name (EN)"
                placeholder="Summer Floral Dress"
                value={meta.nameEn}
                onChange={(e) => setMeta({ ...meta, nameEn: e.target.value })}
              />
              <Field
                label="السعر (دج)"
                type="number"
                placeholder="299"
                value={meta.price}
                onChange={(e) => setMeta({ ...meta, price: e.target.value })}
              />
              <Field
                label="الفئة"
                placeholder="dresses · sets · knits"
                value={meta.category}
                onChange={(e) => setMeta({ ...meta, category: e.target.value })}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={busy || !assets.length || cloudOk === false || fbOk === false}
              className="btn-coral w-full mt-6 text-base py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {state === STATES.GENERATING ? 'يجري التحويل…' : 'يجري الحفظ…'}
                </>
              ) : fbOk === false ? (
                <>
                  <AlertCircle size={16} />
                  أنشئ Firestore أولاً
                </>
              ) : cloudOk === false ? (
                <>
                  <AlertCircle size={16} />
                  أعدّ Cloudinary أولاً
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  أنشئ المنتج
                </>
              )}
            </button>

            <ul className="mt-5 grid gap-2 text-xs text-white/55">
              <li className="flex items-center gap-2">
                <Image size={12} className="text-peach" />
                الصور المعلَّمة 2D تُرفع كما هي
              </li>
              <li className="flex items-center gap-2">
                <Box size={12} className="text-peach" />
                الصور المعلَّمة 3D تُحوَّل إلى نموذج .glb
              </li>
              <li className="flex items-center gap-2">
                <Sparkles size={12} className="text-peach" />
                المنتج يُحفظ في Firestore ويظهر فوراً للزبائن
              </li>
            </ul>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-4 flex items-start gap-2 p-3 rounded-2xl bg-rose-400/10 border border-rose-400/30 text-rose-200 text-sm"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Pipeline overlay — gorgeous, stylised, glowing */}
        <AnimatePresence>
          {busy && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-2xl"
            >
              <motion.div
                initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="glass-dark border-hairline rounded-[32px] p-10 text-center w-[min(420px,90vw)]"
              >
                <GlowSpinner percent={progress.percent} label={progress.label} />
                <h3 className="text-white font-semibold mt-6">يصنع السحر…</h3>
                <p className="text-sm text-white/55 mt-1">
                  تحويل الصورة إلى نموذج ثلاثي الأبعاد، ثم رفع المعرض، ثم النشر التلقائي.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success state */}
        <AnimatePresence>
          {state === STATES.DONE && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-2xl"
            >
              <motion.div
                initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }}
                className="glass-dark border-hairline rounded-[32px] p-10 text-center w-[min(440px,90vw)]"
              >
                <div className="grid place-items-center w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-400 shadow-glow">
                  <CheckCircle2 className="text-white" size={26} />
                </div>
                <h3 className="text-white font-semibold mt-5 text-xl">تم النشر بنجاح</h3>
                <p className="text-sm text-white/60 mt-2">
                  المنتج <span className="text-peach">{meta.nameAr}</span> أصبح متاحاً للزبائن.
                </p>
                <p className="text-[11px] text-white/40 mt-2">id: {savedProductId}</p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button onClick={reset} className="btn-pill !bg-white/10 !text-white/80 !border-white/10">
                    إنشاء آخر
                  </button>
                  <button onClick={() => navigate('/')} className="btn-coral text-sm">
                    عرض المتجر
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function fileExt(file) {
  const m = file.name.split('.').pop();
  return (m || 'png').toLowerCase();
}
