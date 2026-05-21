// =============================================================================
//  WALIDA / BARAA KIDS — Product grid card (image-first)
// -----------------------------------------------------------------------------
//  A clean, full-image product card used on the storefront grid. The whole
//  card is the product photo; meta (name, price, category) sits on a
//  soft gradient overlay at the bottom. Click → opens the detail sheet
//  (ProductDetail.jsx) which carries the 3D view, full gallery and zoom.
// =============================================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Box, Images, ImageOff } from 'lucide-react';

import { useCart } from '../App.jsx';

// Heuristic: detect legacy fake-GLB URLs (image bytes labelled .glb).
function hasUsableModel(url) {
  if (!url) return false;
  if (url.includes('/image/upload/')) return false;
  if (/\.(jpe?g|png|webp)$/i.test(url)) return false;
  return true;
}

// Pick the first non-empty image URL from a product, regardless of shape.
function pickPhoto(product) {
  if (product?.imageUrl && product.imageUrl.length) return product.imageUrl;
  if (Array.isArray(product?.images)) {
    const hit = product.images.find((i) => i?.url && String(i.url).length);
    if (hit) return hit.url;
  }
  return null;
}

export default function ProductGridCard({ product, index = 0, onOpen }) {
  const { toggleFavorite, favorites } = useCart() ?? {};
  const isFav = favorites?.includes(product.id);
  const photo = pickPhoto(product);
  const hasModel = hasUsableModel(product.modelUrl);
  const imageCount = product.images?.length ?? (photo ? 1 : 0);
  const [imgError, setImgError] = useState(false);

  // Dev-only: log the product so we can spot bad data shapes immediately.
  if (import.meta.env.DEV && index === 0) {
    // eslint-disable-next-line no-console
    console.log('[walida] first product →', { id: product.id, photo, hasModel, imageCount, raw: product });
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={product.nameAr || 'product'}
      onClick={() => onOpen?.(product)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen?.(product); }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="relative block w-full rounded-[26px] overflow-hidden cursor-pointer
                 bg-white glass-card group select-none"
      style={{ aspectRatio: '3 / 4', minHeight: '220px' }}
    >
      {/* Image (or graceful placeholder) */}
      {photo && !imgError ? (
        <img
          src={photo}
          alt={product.nameAr || ''}
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-rose via-cream to-baby text-ink/40">
          <div className="text-center">
            <ImageOff size={36} className="mx-auto" />
            <p className="mt-2 text-[11px] font-medium text-ink/55">لا توجد صورة</p>
          </div>
        </div>
      )}

      {/* Top-left: favourite */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); toggleFavorite?.(product.id); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.stopPropagation(); toggleFavorite?.(product.id); }
        }}
        className="absolute top-3 left-3 grid place-items-center w-9 h-9 rounded-full glass-strong cursor-pointer z-10"
      >
        <Heart size={15} className={isFav ? 'fill-coral text-coral' : 'text-ink/70'} />
      </span>

      {/* Top-right: 3D + image-count badges */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end z-10">
        {hasModel && (
          <span className="chip bg-white/90 text-coral border-white/95 !py-0.5">
            <Box size={11} /> 3D
          </span>
        )}
        {imageCount > 1 && (
          <span className="chip bg-white/90 text-ink border-white/95 !py-0.5">
            <Images size={11} /> {imageCount}
          </span>
        )}
      </div>

      {/* Bottom gradient + meta */}
      <div className="absolute inset-x-0 bottom-0 p-4 pt-14 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white pointer-events-none">
        <h3 className="font-arabic text-base font-extrabold leading-tight drop-shadow-sm">
          {product.nameAr || product.nameEn || '—'}
        </h3>
        {product.nameEn && product.nameAr !== product.nameEn && (
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-80 mt-0.5 truncate">
            {product.nameEn}
          </p>
        )}
        <div className="mt-2 flex items-end justify-between">
          <span className="text-lg font-extrabold text-peach drop-shadow">
            {product.price ?? 0} <span className="text-xs font-medium opacity-80">دج</span>
          </span>
          {product.category && product.category !== 'general' && (
            <span className="chip bg-white/15 border-white/20 text-white/95 !py-0.5 !text-[10px]">
              {product.category}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
