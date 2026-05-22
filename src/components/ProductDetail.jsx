// =============================================================================
//  WALIDA / BARAA KIDS — Product Detail Sheet
// -----------------------------------------------------------------------------
//  Slide-up sheet that opens when a storefront card is tapped. Contains:
//   • Image gallery — full-bleed carousel with dot indicators
//   • Zoom overlay — tap any image to pinch / drag zoom (1×–4×)
//   • Full meta    — name, price, description, category
//   • Actions      — add to cart, buy now, favourite
// =============================================================================

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useMotionValue } from 'framer-motion';
import {
  X, Heart, ShoppingBag, Zap, ChevronLeft, ChevronRight,
  Image as ImageIcon, ZoomIn, ZoomOut
} from 'lucide-react';

import { useCart } from '../App.jsx';

// ---------------------------------------------------------------------------
//  Zoom overlay — fullscreen image, double-tap or pinch / drag to zoom.
// ---------------------------------------------------------------------------
function ZoomViewer({ url, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function reset() { setScale(1); x.set(0); y.set(0); }
  function zoomIn()  { setScale((s) => Math.min(s + 0.6, 4)); }
  function zoomOut() { setScale((s) => Math.max(s - 0.6, 1)); if (scale <= 1.6) { x.set(0); y.set(0); } }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/95"
      onClick={onClose}
    >
      <motion.img
        src={url}
        alt={alt}
        drag={scale > 1}
        dragMomentum={false}
        dragElastic={0.05}
        style={{ scale, x, y, cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        onClick={(e) => { e.stopPropagation(); if (scale === 1) zoomIn(); }}
        onDoubleClick={(e) => { e.stopPropagation(); scale > 1 ? reset() : setScale(2.4); }}
        className="max-h-[90vh] max-w-[92vw] select-none touch-none"
        draggable={false}
      />

      {/* Toolbar */}
      <div
        className="absolute top-4 inset-x-4 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="grid place-items-center w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur"
          aria-label="إغلاق"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 1}
            className="grid place-items-center w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur disabled:opacity-40"
            aria-label="تصغير"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 4}
            className="grid place-items-center w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur disabled:opacity-40"
            aria-label="تكبير"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="absolute bottom-6 inset-x-0 text-center text-xs text-white/65 pointer-events-none">
        اضغطي مرتين للتكبير · اسحبي للتنقّل · X للإغلاق
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Image carousel — swipe / arrow nav + dot indicators.
// ---------------------------------------------------------------------------
function Gallery({ images, onZoom }) {
  const [i, setI] = useState(0);
  const total = images.length;
  if (!total) return null;
  const prev = () => setI((p) => (p - 1 + total) % total);
  const next = () => setI((p) => (p + 1) % total);

  return (
    <div className="relative aspect-square bg-rose/40">
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={images[i].url}
          src={images[i].url}
          alt=""
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4 }}
          onClick={() => onZoom(images[i].url)}
          className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
          draggable={false}
        />
      </AnimatePresence>

      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute top-1/2 right-3 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full glass-strong"
            aria-label="السابق"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={next}
            className="absolute top-1/2 left-3 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full glass-strong"
            aria-label="التالي"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? 'w-6 bg-white' : 'w-1.5 bg-white/55'
                }`}
                aria-label={`صورة ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      <span className="absolute top-3 left-3 chip bg-white/85 text-ink border-white/95 !py-0.5">
        <ImageIcon size={11} /> {i + 1}/{total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Sheet shell — full-height slide-up.
// ---------------------------------------------------------------------------
export default function ProductDetail({ product, open, onClose }) {
  const cart = useCart();
  const [zoomUrl, setZoomUrl] = useState(null);

  React.useEffect(() => { setZoomUrl(null); }, [product?.id]);

  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length) {
      return product.images.filter((i) => i?.url);
    }
    return product.imageUrl ? [{ url: product.imageUrl }] : [];
  }, [product]);

  const isFav = product && cart?.favorites?.includes(product.id);

  return (
    <AnimatePresence>
      {open && product && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => { if (info.offset.y > 110) onClose(); }}
            className="fixed bottom-0 inset-x-0 z-50 glass-strong border-hairline rounded-t-[32px] max-h-[92vh] overflow-hidden flex flex-col"
          >
            {/* Drag handle */}
            <div className="pt-3 pb-1 grid place-items-center">
              <span className="w-12 h-1.5 rounded-full bg-ink/15" />
            </div>

            {/* Close + favourite (sticky on top) */}
            <div className="px-5 pt-1 pb-3 flex items-center justify-between">
              <button
                onClick={onClose}
                className="grid place-items-center w-10 h-10 rounded-full glass text-ink/70"
                aria-label="إغلاق"
              >
                <X size={16} />
              </button>
              <button
                onClick={() => cart?.toggleFavorite(product.id)}
                className="grid place-items-center w-10 h-10 rounded-full glass"
                aria-label="مفضّلة"
              >
                <Heart size={16} className={isFav ? 'fill-coral text-coral' : 'text-ink/70'} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Gallery */}
              <div className="px-5">
                <div className="relative rounded-[24px] overflow-hidden bg-rose/30">
                  <Gallery images={images} onZoom={setZoomUrl} />
                </div>
              </div>

              {/* Info */}
              <div className="px-5 pt-6 pb-4 text-right">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-arabic text-2xl font-extrabold text-ink leading-tight">
                      {product.nameAr}
                    </h2>
                    {product.nameEn && (
                      <p className="text-[11px] uppercase tracking-[0.2em] text-ink/55 mt-1">
                        {product.nameEn}
                      </p>
                    )}
                    {product.category && product.category !== 'general' && (
                      <span className="chip mt-3 inline-flex">
                        {product.category}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-extrabold text-coral leading-tight">
                      {product.price}
                    </div>
                    <div className="text-xs text-ink/60 font-medium">دج</div>
                  </div>
                </div>

                {product.description && (
                  <p className="mt-4 text-sm leading-relaxed text-ink/75">
                    {product.description}
                  </p>
                )}

                {/* Specs strip */}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="glass-card !rounded-2xl p-3 text-center">
                    <ImageIcon size={14} className="mx-auto text-coral" />
                    <div className="text-xs text-ink/65 mt-1">{images.length} صور</div>
                  </div>
                  <div className="glass-card !rounded-2xl p-3 text-center">
                    <Zap size={14} className="mx-auto text-coral" />
                    <div className="text-xs text-ink/65 mt-1">شحن سريع</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-8 grid grid-cols-2 gap-3 sticky bottom-0">
                <button
                  onClick={() => cart?.add(product)}
                  className="btn-pill w-full justify-center !py-3 !text-base"
                >
                  <ShoppingBag size={16} />
                  أضف للسلة
                </button>
                <button className="btn-coral w-full !py-3 !text-base">
                  <Zap size={16} />
                  شراء الآن
                </button>
              </div>
            </div>
          </motion.div>

          {/* Zoom overlay */}
          <AnimatePresence>
            {zoomUrl && (
              <ZoomViewer
                url={zoomUrl}
                alt={product.nameAr}
                onClose={() => setZoomUrl(null)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
