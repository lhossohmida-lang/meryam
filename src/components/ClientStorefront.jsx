// =============================================================================
//  WALIDA — Client Storefront
// -----------------------------------------------------------------------------
//  The magical, immersive home page.
//
//  Layout (top → bottom):
//   1. Floating header  → brand wordmark + search trigger
//   2. Hero video       → 4-second high-res loop with a soft gradient mask
//                          that melts into the pastel page background
//   3. Category strip   → glass pills with stagger reveal
//   4. Product grid     → uses <ProductGridCard/> with framer-motion stagger
//   5. Bottom nav       → glassmorphism dock (home, grid, heart, cart, user)
// =============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Search, Home, Grid, Heart, ShoppingBag, User, Sparkles, ChevronLeft,
  X, Trash2, Box, AlertCircle, RefreshCw, Download, Smartphone, MonitorSmartphone, QrCode
} from 'lucide-react';

import ProductGridCard from './ProductGridCard.jsx';
import ProductDetail from './ProductDetail.jsx';
import AIChatWidget from './AIChatWidget.jsx';
import SplashScreen from './SplashScreen.jsx';
import { useCart } from '../App.jsx';
import { db } from '../firebase.js';

// ---------------------------------------------------------------------------
//  Categories — the visual filter chips. Products' `category` field maps here.
//  Exported so the admin (edit + create) can reuse the same source of truth.
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  { id: 'all',     ar: 'الكل',       en: 'All' },
  { id: 'dresses', ar: 'فساتين',     en: 'Dresses' },
  { id: 'sets',    ar: 'أطقم',       en: 'Sets' },
  { id: 'knits',   ar: 'تريكو',      en: 'Knits' },
  { id: 'shoes',   ar: 'أحذية',      en: 'Shoes' }
];

// Subset shown to the admin — excludes the synthetic "all" filter chip,
// since a product is always assigned to exactly one real category.
export const PRODUCT_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'all');

// Hero — editorial children's-wear photography matching the Baraa Kids
// brand identity (pastel clothing on hangers, soft gradient background).
// Swap `HERO_IMAGE` with your own Cloudinary upload to use the exact
// Facebook cover. Set `HERO_VIDEO` to a non-empty string to use a video
// instead — falls back to the still image automatically.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=1800&q=85';
const HERO_VIDEO = '';

// ---------------------------------------------------------------------------
//  Header — minimal, floating, scroll-reactive.
// ---------------------------------------------------------------------------
function Header() {
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 120], [0, 22]);
  const bg = useTransform(scrollY, [0, 120], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)']);

  return (
    <motion.header
      style={{
        backdropFilter: useTransform(blur, (v) => `blur(${v}px) saturate(160%)`),
        background: bg
      }}
      className="fixed top-0 inset-x-0 z-40 px-5 py-4 flex items-center justify-between"
    >
      <Link to="/admin" className="grid place-items-center w-10 h-10 rounded-full glass">
        <ChevronLeft size={16} className="rotate-180" />
      </Link>
      <div className="text-center leading-tight">
        <div className="font-arabic text-2xl font-extrabold text-ink">براءة</div>
        <div className="text-shimmer text-[11px] tracking-[0.45em] font-semibold uppercase">
          Baraa Kids
        </div>
      </div>
      <button className="grid place-items-center w-10 h-10 rounded-full glass">
        <Search size={16} />
      </button>
    </motion.header>
  );
}

// ---------------------------------------------------------------------------
//  Hero — looping video with gradient mask melting into the page.
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative mx-4 mt-24 rounded-[28px] overflow-hidden hero-mask">
      <div className="relative aspect-[16/12] sm:aspect-[16/9] bg-gradient-to-br from-rose via-lavender to-baby">

        {/* Hero visual — video if configured, otherwise the editorial still. */}
        {HERO_VIDEO ? (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={HERO_VIDEO}
            poster={HERO_IMAGE}
            autoPlay muted loop playsInline preload="metadata"
          />
        ) : (
          <motion.img
            src={HERO_IMAGE}
            alt="Baraa Kids — premium children's apparel"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Decorative pastel orbs (a la the Facebook cover) */}
        <motion.span
          aria-hidden
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4 }}
          className="absolute top-6 left-10 w-10 h-10 rounded-full bg-white/55 blur-[1px]"
        />
        <motion.span
          aria-hidden
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 0.75, y: 0 }}
          transition={{ duration: 1.2, delay: 0.6 }}
          className="absolute top-20 right-24 w-6 h-6 rounded-full bg-rose/80"
        />
        <motion.span
          aria-hidden
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 0.8, y: 0 }}
          transition={{ duration: 1.2, delay: 0.8 }}
          className="absolute bottom-24 left-1/3 w-8 h-8 rounded-full bg-baby/85"
        />

        {/* Soft brand overlay — melts the image into the page background */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,246,240,0) 35%, rgba(255,246,240,0.55) 85%, rgba(255,246,240,1) 100%)'
          }}
        />

        {/* Editorial caption matching the Facebook cover wording */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="absolute bottom-6 right-6 left-6 sm:left-auto sm:max-w-md text-right text-ink drop-shadow-sm"
        >
          <h1 className="font-arabic text-3xl sm:text-4xl font-extrabold leading-tight">
            ملابس الأطفال الراقية
          </h1>
          <p className="mt-2 text-sm font-medium text-ink/80 max-w-xs sm:max-w-none ml-auto">
            متجركم الإلكتروني لملابس الأطفال الراقية — تصاميم مختارة بعناية.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Category strip — chips with a bubble-pop animation on tap.
//
//  Visual layering:
//    1. Inside each chip: a shared `layoutId="active-chip-bubble"` coral
//       gradient that FLIP-slides between chips as the active state moves.
//    2. In a document.body portal: a pulse ring + 12 coral particles bursting
//       radially from the tap point. The portal escapes the strip's
//       `overflow-x-auto` (which silently coerces overflow-y to auto and
//       would otherwise clip everything taller than 42px).
//
//  Each burst is a one-shot record in the `bursts` array; a 800 ms timer
//  removes it after the animation completes so the DOM stays clean.
// ---------------------------------------------------------------------------
function BurstParticles({ origin, onDone }) {
  // origin = viewport-coord center of the chip at click time.
  useEffect(() => {
    const id = setTimeout(onDone, 800);
    return () => clearTimeout(id);
  }, [onDone]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed pointer-events-none z-[80]"
      style={{ left: origin.x, top: origin.y }}
      aria-hidden
    >
      {/* Expanding pulse ring */}
      <motion.span
        initial={{ scale: 0.5, opacity: 0.75 }}
        animate={{ scale: 3.2, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute rounded-full border-[3px] border-coral"
        style={{ width: 64, height: 64, left: -32, top: -32 }}
      />
      {/* Soft glow disc that bursts and fades */}
      <motion.span
        initial={{ scale: 0.4, opacity: 0.5 }}
        animate={{ scale: 2.4, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute rounded-full bg-coral/40 blur-md"
        style={{ width: 50, height: 50, left: -25, top: -25 }}
      />
      {/* 12 particles flying radially */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.2;
        const dist  = 56 + Math.random() * 18;
        const size  = 6 + Math.round(Math.random() * 4); // 6–10 px
        // Alternate coral / peach for a richer burst
        const color = i % 2 === 0 ? '#FF8B7A' : '#FFB4A2';
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, scale: 1, opacity: 0.95 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              scale: 0,
              opacity: 0
            }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: -(size / 2),
              top:  -(size / 2),
              background: color
            }}
          />
        );
      })}
    </div>,
    document.body
  );
}

function CategoryChip({ category, isActive, index, onClick }) {
  // Each tap pushes a burst record. The portal then renders it independently
  // of this component's layout, so the strip's overflow can't clip it.
  const [bursts, setBursts] = useState([]);
  const nextId = useRef(0);

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const burst = {
      id: ++nextId.current,
      x: rect.left + rect.width  / 2,
      y: rect.top  + rect.height / 2
    };
    setBursts((prev) => [...prev, burst]);
    onClick();
  }

  function removeBurst(id) {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <>
      <motion.button
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 + index * 0.05 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.88 }}
        onClick={handleClick}
        className={`relative px-5 py-2.5 rounded-2xl text-sm font-semibold
          transition-colors duration-300
          ${isActive
            ? 'text-white shadow-glow'
            : 'glass text-ink/80 hover:text-ink'}`}
      >
        {/* Sliding active background — the "bubble" itself. */}
        {isActive && (
          <motion.span
            layoutId="active-chip-bubble"
            className="absolute inset-0 rounded-2xl -z-10"
            style={{ background: 'linear-gradient(135deg, #FF8B7A 0%, #FFB4A2 100%)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
        )}
        <span className="relative z-10">{category.ar}</span>
      </motion.button>

      {bursts.map((b) => (
        <BurstParticles
          key={b.id}
          origin={{ x: b.x, y: b.y }}
          onDone={() => removeBurst(b.id)}
        />
      ))}
    </>
  );
}

function CategoryStrip({ active, onChange }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-6 px-5 flex gap-2.5 overflow-x-auto no-scrollbar"
    >
      {CATEGORIES.map((c, i) => (
        <CategoryChip
          key={c.id}
          category={c}
          index={i}
          isActive={c.id === active}
          onClick={() => onChange(c.id)}
        />
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Empty state — shown when no products exist yet (fresh project).
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="mx-4 mt-8 pb-32"
    >
      <div className="glass-card border-hairline rounded-3xl px-6 py-12 text-center relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-rose to-lavender opacity-60 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-gradient-to-br from-baby to-cream opacity-60 blur-3xl"
        />
        <div className="relative">
          <div className="grid place-items-center w-16 h-16 mx-auto rounded-3xl bg-coral-peach shadow-glow">
            <Sparkles className="text-white" size={22} />
          </div>
          <h3 className="font-arabic mt-5 text-2xl font-extrabold text-ink">
            مجموعة جديدة قادمة قريباً
          </h3>
          <p className="text-ink/60 text-sm mt-2 max-w-sm mx-auto">
            ترقّبي تشكيلتنا الأولى — قطعٌ مختارة بعناية، تصل قريباً.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Skeleton grid — animated placeholders while we wait for the first
//  Firestore snapshot. Prevents the "blank page" feeling.
// ---------------------------------------------------------------------------
function SkeletonGrid() {
  return (
    <section className="mt-6 px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-32">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="relative aspect-[3/4] rounded-[26px] overflow-hidden glass-card"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-rose via-cream to-baby"
            style={{
              backgroundSize: '200% 100%',
              animation: 'walida-shimmer 2.4s linear infinite'
            }}
          />
          <div className="absolute inset-x-3 bottom-3 grid gap-1.5">
            <div className="h-3 w-2/3 rounded-full bg-white/60" />
            <div className="h-3 w-1/3 rounded-full bg-white/50" />
          </div>
        </motion.div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Error state — surfaces Firestore subscription failures so the page is
//  never silently blank.
// ---------------------------------------------------------------------------
function ErrorState({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-8 pb-32"
    >
      <div className="glass-card border-hairline rounded-3xl px-6 py-10 text-center">
        <div className="grid place-items-center w-14 h-14 mx-auto rounded-3xl bg-rose-400/15 border border-rose-400/30">
          <AlertCircle size={22} className="text-rose-500" />
        </div>
        <h3 className="font-arabic mt-4 text-xl font-extrabold text-ink">
          تعذّر تحميل المنتجات
        </h3>
        <p className="text-ink/60 text-sm mt-2 max-w-sm mx-auto">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-pill mt-5 mx-auto">
            <RefreshCw size={14} /> إعادة المحاولة
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Product grid — full-image cards (ProductGridCard) with stagger reveal.
//  Tapping a card calls `onOpen(product)` → the detail sheet.
//  Multiplexes between loading / error / empty / grid states.
// ---------------------------------------------------------------------------
function ProductGrid({ products, loading, error, onRetry, onOpen }) {
  if (error)              return <ErrorState message={error} onRetry={onRetry} />;
  if (loading)            return <SkeletonGrid />;
  if (!products.length)   return <EmptyState />;
  // Plain <section> + per-card animation. Stacking variants on the section
  // with `AnimatePresence mode="popLayout"` + `layout` on the wrapper used
  // to leave cards stuck at opacity:0 on first paint (the parent variant
  // never propagated through the layout-tracked wrapper). The card already
  // animates itself in, so this stays simple and reliable.
  return (
    <section className="mt-6 px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-32">
      {products.map((p, i) => (
        <ProductGridCard key={p.id} product={p} index={i} onOpen={onOpen} />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Bottom navigation — glass dock with real click actions.
// ---------------------------------------------------------------------------
function BottomNav({ active, onSelect }) {
  const { count, favorites } = useCart() ?? {};
  const items = [
    { id: 'home', icon: Home,        label: 'الرئيسية' },
    { id: 'grid', icon: Grid,        label: 'الفئات'   },
    { id: 'fav',  icon: Heart,       label: 'المفضّلة', badge: favorites?.length },
    { id: 'cart', icon: ShoppingBag, label: 'السلة',    badge: count },
    { id: 'me',   icon: User,        label: 'حسابي'    }
  ];
  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-50"
    >
      <div className="glass-strong border-hairline rounded-3xl flex items-center justify-between px-3 py-2">
        {items.map(({ id, icon: Icon, label, badge }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              onClick={() => onSelect(id)}
              className={`relative w-12 h-12 grid place-items-center rounded-2xl transition-all active:scale-95 ${
                isActive ? 'bg-rose text-coral shadow-inner' : 'text-ink/70 hover:text-ink hover:bg-white/40'
              }`}
            >
              <Icon size={18} />
              {badge ? (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-coral text-white text-[10px] font-bold">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}

// ---------------------------------------------------------------------------
//  Bottom sheet — slide-up panel used for cart, favorites, profile, etc.
// ---------------------------------------------------------------------------
function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-md"
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.y > 90) onClose(); }}
            className="fixed bottom-0 inset-x-0 z-50 glass-strong border-hairline rounded-t-[28px] max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="pt-3 pb-1 grid place-items-center">
              <span className="w-10 h-1.5 rounded-full bg-ink/15" />
            </div>
            <div className="px-5 pt-2 pb-3 flex items-center justify-between">
              <h3 className="font-arabic text-xl font-extrabold text-ink">{title}</h3>
              <button
                onClick={onClose}
                className="grid place-items-center w-9 h-9 rounded-full glass text-ink/70"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
//  Cart sheet — shows the user's basket, totals, and a checkout CTA.
// ---------------------------------------------------------------------------
function CartSheet({ open, onClose }) {
  const cart = useCart();
  if (!cart) return null;
  const { items, total, remove } = cart;

  return (
    <Sheet open={open} onClose={onClose} title="سلّتك">
      {items.length === 0 ? (
        <div className="grid place-items-center text-center py-14">
          <div className="grid place-items-center w-16 h-16 rounded-3xl bg-rose shadow-glow mb-4">
            <ShoppingBag size={22} className="text-coral" />
          </div>
          <p className="font-semibold text-ink">السلّة فارغة</p>
          <p className="text-sm text-ink/55 mt-1">أضيفي قطعة لتظهر هنا.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-ink/5">
            {items.map((it) => (
              <li key={it.id} className="py-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-rose shrink-0">
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Box size={16} className="text-coral" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{it.nameAr}</div>
                  <div className="text-xs text-ink/55">
                    {it.qty} × {it.price} دج
                  </div>
                </div>
                <button
                  onClick={() => remove(it.id)}
                  className="grid place-items-center w-8 h-8 rounded-full bg-rose/40 text-coral hover:bg-rose/70 transition"
                  aria-label="حذف"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 glass-card !rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm text-ink/70">الإجمالي</span>
            <span className="text-lg font-bold text-coral">{total} <span className="text-xs text-ink/60 font-medium">دج</span></span>
          </div>

          <button className="btn-coral w-full mt-4">
            <Sparkles size={14} /> إتمام الشراء
          </button>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
//  Favorites sheet — quick view of liked products.
// ---------------------------------------------------------------------------
function FavoritesSheet({ open, onClose, products }) {
  const cart = useCart();
  const liked = products.filter((p) => cart?.favorites?.includes(p.id));
  return (
    <Sheet open={open} onClose={onClose} title="مفضّلتك">
      {liked.length === 0 ? (
        <div className="grid place-items-center text-center py-14">
          <div className="grid place-items-center w-16 h-16 rounded-3xl bg-rose mb-4">
            <Heart size={22} className="text-coral" />
          </div>
          <p className="font-semibold text-ink">لا توجد قطع محفوظة</p>
          <p className="text-sm text-ink/55 mt-1">اضغطي القلب على أي منتج لإضافته هنا.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pt-2">
          {liked.map((p) => {
            const photo = p.imageUrl || p.images?.[0]?.url;
            return (
              <div key={p.id} className="glass-card overflow-hidden">
                <div className="aspect-square bg-rose">
                  {photo && <img src={photo} alt={p.nameAr} className="w-full h-full object-cover" />}
                </div>
                <div className="p-3 text-right">
                  <div className="text-sm font-semibold text-ink truncate">{p.nameAr}</div>
                  <div className="text-coral font-bold mt-1 text-sm">
                    {p.price} <span className="text-ink/60 text-xs font-medium">دج</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
//  Profile sheet — gateway to admin login + future customer profile.
// ---------------------------------------------------------------------------
function ProfileSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="حسابي">
      <div className="py-4 grid gap-3">
        <div className="glass-card !rounded-2xl p-4 text-center">
          <div className="grid place-items-center w-14 h-14 mx-auto rounded-3xl bg-coral-peach shadow-glow">
            <User size={20} className="text-white" />
          </div>
          <p className="mt-3 font-semibold text-ink">مرحباً بكِ في براءة</p>
          <p className="text-sm text-ink/55 mt-1">
            ميزات الحساب الكامل قريباً — متابعة الطلبات، العناوين، التفضيلات.
          </p>
        </div>

        <Link
          to="/admin/login"
          onClick={onClose}
          className="btn-pill justify-center w-full"
        >
          <Sparkles size={14} />
          دخول لوحة الإدارة
        </Link>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
//  AppDownloadBanner — smart download button that detects device type:
//   • Android / any mobile  → direct APK download
//   • iOS                   → PWA install instructions
//   • Desktop / PC          → EXE installer download
// ---------------------------------------------------------------------------
function AppDownloadBanner() {
  const [showInstructions, setShowInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt]     = useState(null);
  const [isPWAInstalled, setIsPWAInstalled]     = useState(false);

  // Detect device type
  const ua        = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIOS     = /iphone|ipad|ipod/i.test(ua);
  const isMobile  = isAndroid || isIOS || /mobile/i.test(ua);

  const APK_URL = '/apk/baraa-kids.apk';
  const EXE_URL = '/exe/baraa-kids-setup.exe';

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsPWAInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isPWAInstalled) return null;

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function handleInstallPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  }

  // ── Button label + action based on device ──────────────────────────────
  let btnLabel, btnIcon, btnAction, btnStyle;

  if (isAndroid) {
    btnLabel  = 'تحميل التطبيق APK';
    btnIcon   = <Download size={16} />;
    btnAction = () => triggerDownload(APK_URL, 'baraa-kids.apk');
    btnStyle  = { background: 'linear-gradient(135deg,#3DDC84 0%,#00C853 100%)', boxShadow: '0 8px 32px rgba(61,220,132,0.4)' };
  } else if (isIOS) {
    btnLabel  = 'تثبيت التطبيق';
    btnIcon   = <Smartphone size={16} />;
    btnAction = () => setShowInstructions(true);
    btnStyle  = { background: 'linear-gradient(135deg,#007AFF 0%,#5856D6 100%)', boxShadow: '0 8px 32px rgba(0,122,255,0.4)' };
  } else {
    // Desktop / PC → EXE
    btnLabel  = 'تحميل للكمبيوتر EXE';
    btnIcon   = <MonitorSmartphone size={16} />;
    btnAction = () => triggerDownload(EXE_URL, 'baraa-kids-setup.exe');
    btnStyle  = { background: 'linear-gradient(135deg,#FF8B7A 0%,#FFB4A2 100%)', boxShadow: '0 8px 32px rgba(255,139,122,0.4)' };
  }

  return (
    <>
      {/* Floating Download Button */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-24 left-4 z-40"
      >
        <motion.button
          id={isAndroid ? 'btn-download-apk' : isIOS ? 'btn-install-ios' : 'btn-download-exe'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          onClick={btnAction}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl text-white font-semibold text-sm"
          style={btnStyle}
        >
          {btnIcon}
          <span>{btnLabel}</span>
        </motion.button>
      </motion.div>

      {/* iOS instructions Modal */}
      <AnimatePresence>
        {showInstructions && (
          <>
            <motion.div
              key="dl-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowInstructions(false)}
              className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-md"
            />
            <motion.div
              key="dl-modal"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-4 bottom-6 z-50 glass-strong border-hairline rounded-3xl p-6"
            >
              <button
                onClick={() => setShowInstructions(false)}
                className="absolute top-4 left-4 grid place-items-center w-8 h-8 rounded-full glass text-ink/70"
                aria-label="إغلاق"
              >
                <X size={14} />
              </button>
              <div className="text-center">
                <div
                  className="grid place-items-center w-16 h-16 mx-auto rounded-3xl mb-4"
                  style={{ background: 'linear-gradient(135deg,#007AFF 0%,#5856D6 100%)' }}
                >
                  <Smartphone size={24} className="text-white" />
                </div>
                <h3 className="font-arabic text-xl font-extrabold text-ink mb-4">تثبيت تطبيق براءة</h3>
                <div className="text-right grid gap-3">
                  {[['١','اضغط على زر المشاركة ↑ في أسفل Safari'],['٢','اختر «إضافة إلى الشاشة الرئيسية»'],['٣','اضغط «إضافة» — سيظهر التطبيق على شاشتك!']]
                    .map(([n, txt]) => (
                      <div key={n} className="glass-card !rounded-2xl p-3 flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-coral-peach text-white text-xs font-bold grid place-items-center shrink-0">{n}</span>
                        <p className="text-sm text-ink/80" dangerouslySetInnerHTML={{ __html: txt }} />
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
//  Page composition
// ---------------------------------------------------------------------------
export default function ClientStorefront() {
  const [active, setActive] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [navTab, setNavTab] = useState('home');     // home | grid | fav | cart | me
  const [openSheet, setOpenSheet] = useState(null); // 'cart' | 'fav' | 'me' | null
  const [openProduct, setOpenProduct] = useState(null);
  // Splash plays on every page load (including refresh). It's wired to the
  // component mount, so SPA route changes inside the storefront don't replay
  // it — only a real page load / refresh does.
  const [showSplash, setShowSplash] = useState(true);

  function handleSplashDone() {
    setShowSplash(false);
  }
  const categoryRef = useRef(null);

  // Nav button handler — routes to the right action per icon.
  function handleNavSelect(id) {
    setNavTab(id);
    switch (id) {
      case 'home':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setOpenSheet(null);
        break;
      case 'grid':
        categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setOpenSheet(null);
        break;
      case 'fav':  setOpenSheet('fav');  break;
      case 'cart': setOpenSheet('cart'); break;
      case 'me':   setOpenSheet('me');   break;
      default: setOpenSheet(null);
    }
  }

  // Close the sheet → restore the home tab as active.
  useEffect(() => {
    if (!openSheet && navTab !== 'home' && navTab !== 'grid') {
      setNavTab('home');
    }
  }, [openSheet]); // eslint-disable-line

  // Live products subscription — anything added from /admin/new shows up
  // instantly. We deliberately DO NOT pass an `orderBy('createdAt')` clause:
  // Firestore would silently drop any document that's missing the field
  // (e.g. older products from before timestamps were added). We sort
  // client-side instead.
  useEffect(() => {
    setLoading(true);
    setError(null);
    let unsub;
    try {
      unsub = onSnapshot(
        collection(db, 'products'),
        (snap) => {
          const list = snap.docs.map((d) => {
            const data = d.data();
            // Backwards-compat: support both `imageUrl` (single) and `images[]`.
            const images = Array.isArray(data.images) && data.images.length
              ? data.images
              : data.imageUrl
                ? [{ url: data.imageUrl, is3DSource: true }]
                : [];
            return { id: d.id, ...data, images };
          });
          list.sort((a, b) => {
            const ta = a.createdAt?.seconds ?? 0;
            const tb = b.createdAt?.seconds ?? 0;
            return tb - ta;
          });
          if (import.meta.env.DEV) {
            console.log(`[walida] products snapshot → ${list.length} item(s)`);
          }
          setProducts(list);
          setLoading(false);
        },
        (err) => {
          console.warn('[walida] products subscription error', err);
          setError(
            err.code === 'permission-denied'
              ? 'القواعد ترفض القراءة. تأكّدي أن firestore.rules منشورة في Firebase Console.'
              : (err.message || 'تعذّر الاتصال بـ Firestore.')
          );
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn('[walida] products subscription init failed', e);
      setError(e.message || 'تعذّر بدء الاتصال بـ Firestore.');
      setLoading(false);
    }
    return () => unsub?.();
  }, [refreshTick]);

  const filtered = useMemo(
    () => (active === 'all' ? products : products.filter((p) => p.category === active)),
    [active, products]
  );

  return (
    <div className="min-h-screen pb-32 bg-pearl-sheen">
      <Header />
      <Hero />
      <div ref={categoryRef}>
        <CategoryStrip active={active} onChange={setActive} />
      </div>
      <ProductGrid
        products={filtered}
        loading={loading}
        error={error}
        onRetry={() => setRefreshTick((n) => n + 1)}
        onOpen={setOpenProduct}
      />

      <BottomNav active={navTab} onSelect={handleNavSelect} />

      <CartSheet      open={openSheet === 'cart'} onClose={() => setOpenSheet(null)} />
      <FavoritesSheet open={openSheet === 'fav'}  onClose={() => setOpenSheet(null)} products={products} />
      <ProfileSheet   open={openSheet === 'me'}   onClose={() => setOpenSheet(null)} />

      {/* Product detail — opens on card tap */}
      <ProductDetail
        product={openProduct}
        open={!!openProduct}
        onClose={() => setOpenProduct(null)}
      />

      {/* Gemini-powered storefront concierge (hides itself if the API
          key isn't configured — safe for fresh installs / forks). */}
      <AIChatWidget />

      {/* Smart app download button — APK for Android, PWA for iOS/Desktop */}
      <AppDownloadBanner />

      {/* ~2-second intro video — desktop variant on ≥768px viewports,
          portrait variant on phones. Plays on every page load / refresh. */}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashDone} />}
      </AnimatePresence>
    </div>
  );
}
