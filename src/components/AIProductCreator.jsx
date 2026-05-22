// =============================================================================
//  WALIDA — Product Creator (Multi-image edition)
// -----------------------------------------------------------------------------
//  Drag-and-drop multiple images into the studio. Each one becomes part of
//  the product gallery. All images are uploaded as-is (2D).
//
//  Final Firestore record shape:
//    {
//      nameAr, nameEn, price, category,
//      images:  [{ url }],   // gallery
//      imageUrl: string,     // convenience: primary photo
//      jobId, source, createdAt
//    }
//
//  UI states:  idle → saving → done | error
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Image as ImageIcon, Sparkles, Loader2, ArrowLeft,
  CheckCircle2, AlertCircle, Wand2, X, Plus, Image
} from 'lucide-react';

import { saveProduct, pingFirebase } from '../firebase.js';
import {
  uploadToCloudinary,
  pingCloudinary,
  isCloudinaryConfigured,
  cloudinaryConfig
} from '../lib/cloudinary.js';

// ---------------------------------------------------------------------------
//  Glowing loading spinner
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
//  Local helpers
// ---------------------------------------------------------------------------
function makeAsset(file) {
  return {
    id: cryptoId(),
    file,
    preview: URL.createObjectURL(file)
  };
}

function cryptoId() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replaceAll('-', '');
}

// ---------------------------------------------------------------------------
//  Multi-image drop zone
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
          يمكنك إضافة عدة صور للمنتج.
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
//  Gallery strip — image thumbnails with remove button.
// ---------------------------------------------------------------------------
function GalleryStrip({ assets, removeAsset, disabled }) {
  if (!assets.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      <AnimatePresence>
        {assets.map((a, i) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="relative group rounded-2xl overflow-hidden border border-white/10"
          >
            <div className="relative aspect-square">
              <img src={a.preview} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0" />

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
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Form fields
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
  SAVING: 'saving',
  DONE: 'done',
  ERROR: 'error'
};

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
              </a>{' '}→ <span className="text-white font-semibold">Create database</span> → اختاري الموقع → <span className="text-white font-semibold">Start in production mode</span>.
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
  const [assets, setAssets] = useState([]);
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

  async function runHealthCheck() {
    setCloudOk(null);
    setFbOk(null);
    setCloudErrorMsg(null);
    setFbErrorMsg(null);

    if (!isCloudinaryConfigured()) {
      setCloudReason('missing-env');
      setCloudOk(false);
    } else {
      const c = await pingCloudinary();
      setCloudReason(c.ok ? null : 'unreachable');
      setCloudErrorMsg(c.ok ? null : (c.error?.message || null));
      setCloudOk(c.ok);
    }

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
    setProgress({ percent: 2, label: 'Preparing…' });

    const jobId = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))
      .replaceAll('-', '');
    const total = assets.length;

    try {
      const uploads = [];

      for (let i = 0; i < total; i++) {
        const a = assets[i];
        const label = `الصورة ${i + 1}/${total} · رفع`;
        setProgress({
          percent: Math.min(2 + ((i / total) * 93), 95),
          label
        });
        const { url: imageUrl } = await uploadToCloudinary(a.file, {
          resourceType: 'image',
          folder: `walida/products/${jobId}`,
          publicId: a.id,
          onProgress: (p) => setProgress({
            percent: Math.min(2 + (((i + p / 100) / total) * 93), 95),
            label: `${label} · ${Math.round(p)}%`
          })
        });
        uploads.push({ url: imageUrl });
      }

      setProgress({ percent: 98, label: 'جاري حفظ المنتج…' });

      const productId = await saveProduct({
        nameAr: meta.nameAr,
        nameEn: meta.nameEn || meta.nameAr,
        price: Number(meta.price),
        category: meta.category || 'general',
        images: uploads,
        imageUrl: uploads[0].url,
        jobId,
        source: 'product-creator'
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

  const busy = state === STATES.SAVING;

  return (
    <div className="min-h-screen bg-graphite bg-admin-aurora text-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8" dir="ltr">

        {/* Topbar */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/admin" className="glass-dark inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm text-white/80 hover:text-white">
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="text-center">
            <div className="font-arabic text-xl font-extrabold">منشئ المنتجات</div>
            <div className="text-shimmer text-[10px] tracking-[0.4em] font-semibold">PRODUCT CREATOR</div>
          </div>
          <span className="w-10" />
        </div>

        {/* Setup banners */}
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
              أضيفي عدة صور للمنتج.
            </p>

            <DropZone onFiles={addFiles} disabled={busy} />

            <GalleryStrip
              assets={assets}
              removeAsset={removeAsset}
              disabled={busy}
            />

            {assets.length > 0 && !busy && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={reset}
                  className="text-white/50 hover:text-white inline-flex items-center gap-1 text-xs"
                >
                  <X size={11} /> مسح الكل
                </button>
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
                  يجري الحفظ…
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
                الصور تُرفع على Cloudinary
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

        {/* Saving overlay */}
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
                <h3 className="text-white font-semibold mt-6">جاري الرفع…</h3>
                <p className="text-sm text-white/55 mt-1">
                  رفع الصور ثم النشر التلقائي.
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
