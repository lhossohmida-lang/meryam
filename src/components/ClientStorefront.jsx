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
//   4. 3D product grid  → uses <ProductCard3D/> with framer-motion stagger
//   5. Bottom nav       → glassmorphism dock (home, grid, heart, cart, user)
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Search, Home, Grid, Heart, ShoppingBag, User, Sparkles, ChevronLeft
} from 'lucide-react';

import ProductCard3D from './ProductCard3D.jsx';
import { useCart } from '../App.jsx';
import { db } from '../firebase.js';

// ---------------------------------------------------------------------------
//  Categories — the visual filter chips. Products' `category` field maps here.
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { id: 'all',     ar: 'الكل',       en: 'All' },
  { id: 'dresses', ar: 'فساتين',     en: 'Dresses' },
  { id: 'sets',    ar: 'أطقم',       en: 'Sets' },
  { id: 'knits',   ar: 'تريكو',      en: 'Knits' },
  { id: 'shoes',   ar: 'أحذية',      en: 'Shoes' }
];

// Hero loop — luxury b-roll from a stock provider. Swap with your own MP4.
const HERO_VIDEO =
  'https://cdn.coverr.co/videos/coverr-a-girl-running-in-a-field-of-flowers-2284/1080p.mp4';
const HERO_FALLBACK =
  'https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?auto=format&fit=crop&w=1600&q=80';

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
        <div className="font-arabic text-2xl font-extrabold text-ink">وليدة</div>
        <div className="text-shimmer text-[11px] tracking-[0.45em] font-semibold uppercase">
          Walida
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
      <div className="relative aspect-[16/12] sm:aspect-[16/9] bg-gradient-to-br from-cream via-rose to-baby">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={HERO_VIDEO}
          poster={HERO_FALLBACK}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        {/* Soft brand overlay */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,246,240,0) 40%, rgba(255,246,240,0.55) 88%, rgba(255,246,240,1) 100%)'
          }}
        />
        {/* Floating editorial caption */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="absolute bottom-6 right-6 left-6 sm:left-auto sm:max-w-sm text-right text-white drop-shadow"
        >
          <span className="chip bg-white/40 text-white border-white/30">
            <Sparkles size={12} /> مجموعة الربيع
          </span>
          <h1 className="font-arabic mt-3 text-3xl sm:text-4xl font-extrabold leading-tight">
            أناقة طفولية تُروى كحكاية
          </h1>
          <p className="mt-2 text-sm font-medium text-white/90 max-w-xs sm:max-w-none ml-auto">
            تصاميم محدودة، أقمشة ناعمة، وألوان كأنها من حلم.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
//  Category strip
// ---------------------------------------------------------------------------
function CategoryStrip({ active, onChange }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-6 px-5 flex gap-2.5 overflow-x-auto no-scrollbar"
    >
      {CATEGORIES.map((c, i) => {
        const isActive = c.id === active;
        return (
          <motion.button
            key={c.id}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 + i * 0.05 }}
            onClick={() => onChange(c.id)}
            className={
              isActive
                ? 'px-5 py-2.5 rounded-2xl text-sm font-semibold text-white btn-coral !py-2 !px-5'
                : 'px-5 py-2.5 rounded-2xl text-sm font-semibold glass text-ink/80'
            }
          >
            {c.ar}
          </motion.button>
        );
      })}
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
//  Product grid — stagger reveal of 3D cards
// ---------------------------------------------------------------------------
function ProductGrid({ products }) {
  if (!products.length) return <EmptyState />;
  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show:   { transition: { staggerChildren: 0.08, delayChildren: 0.2 } }
      }}
      className="mt-6 px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-32"
    >
      <AnimatePresence mode="popLayout">
        {products.map((p, i) => (
          <motion.div
            key={p.id}
            layout
            variants={{
              hidden: { opacity: 0, y: 40 },
              show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
            }}
          >
            <ProductCard3D product={p} index={i} compact />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
//  Bottom navigation — glass dock
// ---------------------------------------------------------------------------
function BottomNav() {
  const { count, favorites } = useCart() ?? {};
  const items = [
    { id: 'home', icon: Home, active: true },
    { id: 'grid', icon: Grid },
    { id: 'fav',  icon: Heart, badge: favorites?.length },
    { id: 'cart', icon: ShoppingBag, badge: count },
    { id: 'me',   icon: User }
  ];
  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-50"
    >
      <div className="glass-strong border-hairline rounded-3xl flex items-center justify-between px-3 py-2">
        {items.map(({ id, icon: Icon, active, badge }) => (
          <button
            key={id}
            className={`relative w-12 h-12 grid place-items-center rounded-2xl transition-colors ${
              active ? 'bg-rose text-coral' : 'text-ink/70 hover:text-ink'
            }`}
          >
            <Icon size={18} />
            {badge ? (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-coral text-white text-[10px] font-bold">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </motion.nav>
  );
}

// ---------------------------------------------------------------------------
//  Page composition
// ---------------------------------------------------------------------------
export default function ClientStorefront() {
  const [active, setActive] = useState('all');
  const [products, setProducts] = useState([]);

  // Live products subscription — anything added from /admin/new shows up here
  // instantly thanks to Firestore's onSnapshot.
  useEffect(() => {
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setProducts(
          snap.docs.map((d) => {
            const data = d.data();
            // Backwards-compat: support both `imageUrl` (single) and `images[]`.
            const images = Array.isArray(data.images) && data.images.length
              ? data.images
              : data.imageUrl
                ? [{ url: data.imageUrl, is3DSource: true }]
                : [];
            return { id: d.id, ...data, images };
          })
        );
      });
      return unsub;
    } catch (e) {
      console.warn('Products subscription unavailable', e);
    }
  }, []);

  const filtered = useMemo(
    () => (active === 'all' ? products : products.filter((p) => p.category === active)),
    [active, products]
  );

  // Pre-warm GLB loader cache for any models we already have.
  useEffect(() => {
    products.forEach((p) => ProductCard3D.preload?.(p.modelUrl));
  }, [products]);

  return (
    <div className="min-h-screen pb-32 bg-pearl-sheen">
      <Header />
      <Hero />
      <CategoryStrip active={active} onChange={setActive} />
      <ProductGrid products={filtered} />
      <BottomNav />
    </div>
  );
}
