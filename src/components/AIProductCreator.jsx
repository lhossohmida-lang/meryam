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
  CheckCircle2, AlertCircle, Wand2, Boxes, X, Box, Plus, Star
} from 'lucide-react';

import { convertImageTo3D } from '../lib/aiPipeline.js';
import { saveProduct, recordGenerationJob } from '../firebase.js';
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
    is3DSource: false
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
//  Gallery strip — preview each picked file as a thumbnail, with a "set as
//  3D source" star and a remove button. Exactly one file can be the 3D source
//  at any time.
// ---------------------------------------------------------------------------
function GalleryStrip({ assets, set3DSource, removeAsset, disabled }) {
  if (!assets.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3"
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
            className={`relative group rounded-2xl overflow-hidden aspect-square border transition-all
              ${a.is3DSource
                ? 'border-coral shadow-[0_0_0_2px_rgba(255,139,122,0.4),0_18px_40px_-15px_rgba(255,139,122,0.55)]'
                : 'border-white/10'}
            `}
          >
            <img src={a.preview} alt="" className="w-full h-full object-cover" />

            {/* 3D source badge */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => set3DSource(a.id)}
              className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold
                ${a.is3DSource
                  ? 'bg-coral text-white shadow'
                  : 'bg-black/55 text-white/85 backdrop-blur hover:bg-black/75'}`}
            >
              {a.is3DSource ? <Box size={10} /> : <Star size={10} />}
              {a.is3DSource ? '3D' : 'اجعلها 3D'}
            </button>

            {/* Remove */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeAsset(a.id)}
              className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded-full bg-black/55 text-white/90 backdrop-blur hover:bg-black/75"
              aria-label="remove"
            >
              <X size={12} />
            </button>

            <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white/85 truncate">
              {a.file.name}
            </div>
          </motion.div>
        ))}
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
function CloudinarySetupBanner({ onRetry, reason }) {
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
          <p className="text-sm text-white/65 mt-1">
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
  const [cloudOk, setCloudOk] = useState(null);     // null=checking, true/false after ping
  const [cloudReason, setCloudReason] = useState(null);

  // Verify Cloudinary config on mount + on demand.
  async function runHealthCheck() {
    setCloudOk(null);
    if (!isCloudinaryConfigured()) {
      setCloudReason('missing-env');
      setCloudOk(false);
      return;
    }
    const res = await pingCloudinary();
    setCloudReason(res.ok ? null : 'unreachable');
    setCloudOk(res.ok);
  }
  useEffect(() => { runHealthCheck(); }, []);

  // Auto-mark the first uploaded file as the 3D source so the admin always
  // has a sensible default.
  function addFiles(files) {
    setAssets((prev) => {
      const incoming = files.map(makeAsset);
      const next = [...prev, ...incoming];
      if (!next.some((a) => a.is3DSource) && next.length) next[0].is3DSource = true;
      return next;
    });
  }

  function removeAsset(id) {
    setAssets((prev) => {
      const next = prev.filter((a) => a.id !== id);
      // If we just removed the 3D source, promote the first remaining asset.
      if (next.length && !next.some((a) => a.is3DSource)) next[0].is3DSource = true;
      return next;
    });
  }

  function set3DSource(id) {
    setAssets((prev) => prev.map((a) => ({ ...a, is3DSource: a.id === id })));
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
    const source = assets.find((a) => a.is3DSource) ?? assets[0];
    if (!meta.nameAr || !meta.price) return setError('الاسم والسعر مطلوبان.');

    setError(null);
    setState(STATES.GENERATING);
    setProgress({ percent: 4, label: 'Preparing studio…' });

    try {
      // 1) Run the 3D pipeline on the chosen source image (0 → 50%).
      const { blob, jobId } = await convertImageTo3D(source.file, {
        onProgress: (p) =>
          setProgress({ label: p.label, percent: Math.min(p.percent * 0.5, 50) })
      });

      // 2) Upload gallery images sequentially to Cloudinary, tracking each
      //    file's progress (50% → 85%).
      setState(STATES.SAVING);
      const uploads = [];
      const totalFiles = assets.length;
      for (let i = 0; i < totalFiles; i++) {
        const a = assets[i];
        const baseLabel = `جاري رفع الصورة ${i + 1}/${totalFiles}`;
        setProgress({ percent: 50 + (i / totalFiles) * 35, label: baseLabel });
        const { url } = await uploadToCloudinary(a.file, {
          resourceType: 'image',
          folder: `walida/products/${jobId}`,
          publicId: a.id,
          onProgress: (filePercent) => {
            const overall = 50 + ((i + filePercent / 100) / totalFiles) * 35;
            setProgress({ percent: overall, label: `${baseLabel} · ${Math.round(filePercent)}%` });
          }
        });
        uploads.push({ url, is3DSource: a.is3DSource });
      }

      // 3) Upload the generated .glb as a raw asset (85% → 95%).
      setProgress({ percent: 85, label: 'جاري رفع النموذج ثلاثي الأبعاد…' });
      const { url: modelUrl } = await uploadToCloudinary(blob, {
        resourceType: 'raw',
        folder: `walida/models`,
        publicId: `${jobId}.glb`,
        onProgress: (p) => setProgress({
          percent: 85 + (p / 100) * 10,
          label: `جاري رفع النموذج ثلاثي الأبعاد · ${Math.round(p)}%`
        })
      });

      // 4) Persist the product record in Firestore (95% → 100%).
      setProgress({ percent: 96, label: 'جاري حفظ المنتج…' });
      const primaryUrl = uploads.find((u) => u.is3DSource)?.url ?? uploads[0].url;
      const productId = await saveProduct({
        nameAr: meta.nameAr,
        nameEn: meta.nameEn || meta.nameAr,
        price: Number(meta.price),
        category: meta.category || 'general',
        images: uploads,
        imageUrl: primaryUrl,
        modelUrl,
        jobId,
        source: 'ai-pipeline'
      });

      await recordGenerationJob(jobId, {
        productId, status: 'success', images: uploads, modelUrl
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
  const sourceAsset = assets.find((a) => a.is3DSource);

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

        {/* Setup banner — only shows when Cloudinary isn't reachable */}
        {cloudOk === false && (
          <CloudinarySetupBanner onRetry={runHealthCheck} reason={cloudReason} />
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
              أضيفي صور متعددة (عدسات، زوايا، تفاصيل) — ثم اختاري صورة واحدة كمصدر للنموذج ثلاثي الأبعاد.
            </p>

            <DropZone onFiles={addFiles} disabled={busy} />

            <GalleryStrip
              assets={assets}
              set3DSource={set3DSource}
              removeAsset={removeAsset}
              disabled={busy}
            />

            {assets.length > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs text-white/55">
                <span className="inline-flex items-center gap-1.5">
                  <Box size={12} className="text-peach" />
                  مصدر النموذج: {sourceAsset?.file.name ?? '—'}
                </span>
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
                label="السعر (ريال)"
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
              disabled={busy || !assets.length || cloudOk === false}
              className="btn-coral w-full mt-6 text-base py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {state === STATES.GENERATING ? 'يجري التحويل…' : 'يجري الحفظ…'}
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
                <Boxes size={12} className="text-peach" />
                صور المعرض تُرفع كاملة إلى Firebase Storage
              </li>
              <li className="flex items-center gap-2">
                <Box size={12} className="text-peach" />
                الصورة المختارة فقط تُحوَّل إلى نموذج .glb
              </li>
              <li className="flex items-center gap-2">
                <Sparkles size={12} className="text-peach" />
                المنتج يظهر فوراً في صفحة الزبون
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
