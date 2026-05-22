// =============================================================================
//  WALIDA — Admin Dashboard (empty / live edition)
// -----------------------------------------------------------------------------
//  Pristine studio. Every number is driven by Firestore — nothing is mocked.
//  When the project is fresh and there are no orders / products yet, the
//  dashboard shows beautiful "—" placeholders and gently guides the admin
//  to the AI Product Creator, which is the ONLY place to upload images.
//
//  Surfaces (all live, all zero by default):
//    • KPI strip            → products · orders · revenue · 3D models
//    • Order queue          → empty state with a CTA
//    • AI Studio quick-action → primary entry into /admin/new
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, Users, Boxes, Sparkles, ArrowUpRight,
  Filter, Search, Bell, Plus, Inbox, LogOut, User as UserIcon,
  Trash2, Box, Image as ImageIcon, AlertCircle, Loader2, Pencil, Save, X
} from 'lucide-react';

import { db, adminSignOut, deleteProduct, updateProduct } from '../firebase.js';
import { useAdminUser } from './ProtectedRoute.jsx';
import {
  collection, onSnapshot, query, orderBy, limit
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
//  Sidebar — navigation only. No counts shown until they're real.
// ---------------------------------------------------------------------------
function Sidebar() {
  const items = [
    { id: 'home',    label: 'Overview',  icon: TrendingUp, active: true },
    { id: 'orders',  label: 'Orders',    icon: ShoppingBag },
    { id: 'catalog', label: 'Catalog',   icon: Boxes },
    { id: 'ai',      label: 'AI Studio', icon: Sparkles }
  ];
  return (
    <aside className="hidden lg:flex flex-col w-60 p-6 gap-2 glass-dark rounded-3xl">
      <div className="mb-6">
        <div className="font-arabic text-2xl font-extrabold text-white">براءة</div>
        <div className="text-shimmer text-[10px] tracking-[0.45em] font-semibold">BARAA KIDS</div>
      </div>
      {items.map(({ id, label, icon: Icon, active }) => (
        <button
          key={id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
            active
              ? 'bg-white/10 text-white border border-white/10'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
      <Link
        to="/admin/new"
        className="mt-auto btn-coral text-sm justify-center"
      >
        <Plus size={14} />
        أضف منتجاً
      </Link>
    </aside>
  );
}

function Topbar() {
  const user = useAdminUser();
  const navigate = useNavigate();

  async function handleSignOut() {
    await adminSignOut();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="glass-dark flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1">
        <Search size={14} className="text-white/50" />
        <input
          className="bg-transparent outline-none text-sm text-white placeholder:text-white/40 flex-1"
          placeholder="بحث…"
        />
      </div>

      {/* Signed-in user chip */}
      <div className="hidden sm:flex glass-dark items-center gap-2.5 pl-3 pr-4 py-2 rounded-2xl text-white/80">
        <div className="grid place-items-center w-7 h-7 rounded-xl bg-gradient-to-br from-coral to-peach text-white text-[10px] font-bold">
          {(user?.displayName || user?.email || '?').slice(0, 1).toUpperCase()}
        </div>
        <span className="text-xs leading-tight max-w-[160px] truncate">
          {user?.displayName || user?.email}
        </span>
      </div>

      <button
        onClick={handleSignOut}
        className="glass-dark w-11 h-11 grid place-items-center rounded-2xl text-white/70 hover:text-rose-300"
        title="تسجيل الخروج"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  KPI card — accepts a real count. Renders an em-dash when there's no data.
// ---------------------------------------------------------------------------
function KpiCard({ kpi, value, i }) {
  const Icon = kpi.icon;
  const isEmpty = value === 0 || value == null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass-dark rounded-3xl p-5 relative overflow-hidden border-hairline"
    >
      <div
        aria-hidden
        className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${kpi.accent} opacity-25 blur-3xl`}
      />
      <div className="flex items-center justify-between">
        <div className="grid place-items-center w-10 h-10 rounded-2xl bg-white/5 border border-white/10 text-white/80">
          <Icon size={16} />
        </div>
        {!isEmpty && (
          <span className="chip bg-white/5 border-white/10 text-emerald-300">
            <ArrowUpRight size={12} /> live
          </span>
        )}
      </div>
      <div className="mt-6 text-xs uppercase tracking-[0.2em] text-white/50">{kpi.label}</div>
      <div className="mt-1 text-3xl font-bold text-white">
        {isEmpty ? '—' : (kpi.format ? kpi.format(value) : value)}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
//  Orders panel — shows real orders when present, an empty state otherwise.
// ---------------------------------------------------------------------------
function OrdersPanel({ orders }) {
  return (
    <div className="glass-dark rounded-3xl p-5 border-hairline">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">آخر الطلبات</h3>
          <p className="text-xs text-white/50">Recent orders queue</p>
        </div>
        {orders.length > 0 && (
          <button className="chip bg-white/5 text-white/70 border-white/10">عرض الكل</button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="py-12 grid place-items-center text-center">
          <div className="grid place-items-center w-14 h-14 rounded-3xl bg-white/5 border border-white/10 mb-4">
            <Inbox size={20} className="text-white/60" />
          </div>
          <p className="text-white/70 font-medium">لا توجد طلبات بعد</p>
          <p className="text-white/40 text-xs mt-1 max-w-xs">
            بمجرد أن يطلب الزبون منتجاً، سيظهر هنا في الوقت الحقيقي.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {orders.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-coral to-peach text-white text-xs font-bold">
                  {(o.customer ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('')}
                </div>
                <div className="text-sm">
                  <div className="text-white font-medium">{o.customer ?? 'Guest'}</div>
                  <div className="text-white/40 text-xs">{o.id}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">{o.total ?? 0} دج</div>
                <div className="text-white/40 text-xs">{o.items ?? 0} عناصر</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Edit-product modal — change name, price, category. Image management
//  stays in AIProductCreator (re-upload + re-publish for visual changes).
// ---------------------------------------------------------------------------
function EditProductModal({ product, onClose, onSave }) {
  const [meta, setMeta] = useState({
    nameAr:   product?.nameAr   ?? '',
    nameEn:   product?.nameEn   ?? '',
    price:    product?.price    ?? '',
    category: product?.category ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Did anything actually change? Disable the Save button when not.
  const dirty =
    meta.nameAr !== (product?.nameAr ?? '') ||
    meta.nameEn !== (product?.nameEn ?? '') ||
    Number(meta.price) !== Number(product?.price ?? 0) ||
    meta.category !== (product?.category ?? '');

  async function handleSave(e) {
    e?.preventDefault?.();
    if (!meta.nameAr || meta.price === '' || Number(meta.price) < 0) {
      return setError('الاسم العربي والسعر مطلوبان (سعر ≥ 0).');
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(product.id, {
        nameAr: meta.nameAr,
        nameEn: meta.nameEn || meta.nameAr,
        price: Number(meta.price),
        category: meta.category || 'general'
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'فشل التحديث.');
    } finally {
      setSaving(false);
    }
  }

  const photo = product?.imageUrl || product?.images?.[0]?.url;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xl p-4"
      onClick={() => !saving && onClose()}
    >
      <motion.form
        onSubmit={handleSave}
        initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-dark border-hairline rounded-[28px] p-6 w-[min(540px,94vw)]"
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/30">
                <ImageIcon size={18} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold">تعديل المنتج</h3>
            <p className="text-xs text-white/50 truncate">{product?.nameAr}</p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="grid place-items-center w-9 h-9 rounded-full bg-white/5 text-white/65 hover:text-white"
            aria-label="إغلاق"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="الاسم بالعربية" value={meta.nameAr}
                     onChange={(v) => setMeta({ ...meta, nameAr: v })}
                     placeholder="فستان زهري" />
          <FormField label="Name (EN)" value={meta.nameEn}
                     onChange={(v) => setMeta({ ...meta, nameEn: v })}
                     placeholder="Summer Floral Dress" />
          <FormField label="السعر (دج)" type="number" value={meta.price}
                     onChange={(v) => setMeta({ ...meta, price: v })}
                     placeholder="2900" />
          <FormField label="الفئة" value={meta.category}
                     onChange={(v) => setMeta({ ...meta, category: v })}
                     placeholder="dresses · sets · knits" />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 flex items-start gap-2 p-3 rounded-2xl bg-rose-400/10 border border-rose-400/30 text-rose-200 text-sm"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="btn-pill !bg-white/10 !text-white/80 !border-white/10 disabled:opacity-60"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="btn-coral text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ التغييرات
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function FormField({ label, value, onChange, ...input }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/55">{label}</span>
      <input
        {...input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3
                   text-white placeholder:text-white/30 outline-none
                   focus:border-coral focus:bg-white/[0.09] transition"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
//  Products panel — live list of every product, with edit + delete buttons.
// ---------------------------------------------------------------------------
function ProductsPanel({ products, onDelete, onUpdate }) {
  const [confirming, setConfirming] = useState(null); // product object or null
  const [editing, setEditing]       = useState(null); // product object or null
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  async function handleConfirmDelete() {
    if (!confirming) return;
    setError(null);
    setDeletingId(confirming.id);
    try {
      await onDelete(confirming.id);
      setConfirming(null);
    } catch (e) {
      setError(e?.message || 'فشل الحذف.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="glass-dark rounded-3xl p-5 border-hairline">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">المنتجات</h3>
          <p className="text-xs text-white/50">
            {products.length} {products.length === 1 ? 'منتج' : 'منتجات'}
          </p>
        </div>
        <Link to="/admin/new" className="btn-pill !bg-white/10 !text-white/90 !border-white/15">
          <Plus size={12} /> أضف
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="py-12 grid place-items-center text-center">
          <div className="grid place-items-center w-14 h-14 rounded-3xl bg-white/5 border border-white/10 mb-4">
            <Boxes size={20} className="text-white/60" />
          </div>
          <p className="text-white/70 font-medium">لا توجد منتجات بعد</p>
          <p className="text-white/40 text-xs mt-1 max-w-xs">
            ابدئي بإضافة أول منتج من AI Studio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.map((p, i) => {
            const hasModel = !!p.modelUrl && !p.modelUrl.includes('/image/upload/');
            const photo = p.imageUrl || p.images?.[0]?.url;
            const busy = deletingId === p.id;
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]"
              >
                <div className="aspect-square relative bg-white/5">
                  {photo ? (
                    <img src={photo} alt={p.nameAr} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-white/30">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/0" />

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {hasModel && (
                      <span className="chip bg-coral/85 border-coral/50 text-white !py-0.5">
                        <Box size={10} /> 3D
                      </span>
                    )}
                    {p.images?.length > 1 && (
                      <span className="chip bg-white/85 border-white/90 text-ink !py-0.5">
                        {p.images.length} صور
                      </span>
                    )}
                  </div>

                  {/* Action buttons (edit + delete) */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing(p)}
                      className="grid place-items-center w-8 h-8 rounded-full bg-white/95 text-ink shadow hover:bg-white transition disabled:opacity-50"
                      aria-label="تعديل المنتج"
                      title="تعديل المنتج"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(p)}
                      className="grid place-items-center w-8 h-8 rounded-full bg-rose-500/90 text-white shadow hover:bg-rose-500 transition disabled:opacity-50"
                      aria-label="حذف المنتج"
                      title="حذف المنتج"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 text-right">
                  <div className="text-sm text-white font-semibold truncate">{p.nameAr || '—'}</div>
                  <div className="text-[11px] text-white/50 truncate">{p.nameEn}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-coral font-bold text-sm">
                      {p.price} <span className="text-white/55 text-[11px]">دج</span>
                    </span>
                    {p.category && (
                      <span className="text-[10px] uppercase tracking-wider text-white/45">
                        {p.category}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit product modal */}
      <AnimatePresence>
        {editing && (
          <EditProductModal
            product={editing}
            onClose={() => setEditing(null)}
            onSave={onUpdate}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-xl p-4"
            onClick={() => !deletingId && setConfirming(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-dark border-hairline rounded-[28px] p-7 w-[min(420px,92vw)] text-center"
            >
              <div className="grid place-items-center w-14 h-14 mx-auto rounded-3xl bg-rose-500/15 border border-rose-500/30">
                <AlertCircle size={22} className="text-rose-300" />
              </div>
              <h3 className="text-white font-semibold mt-4 text-lg">حذف هذا المنتج؟</h3>
              <p className="text-sm text-white/65 mt-1.5">
                سيُحذف <span className="text-peach">{confirming.nameAr}</span> نهائياً من المتجر.
                هذا الإجراء لا يمكن التراجع عنه.
              </p>

              {error && (
                <div className="mt-3 text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-3 py-2 text-right">
                  {error}
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={!!deletingId}
                  onClick={() => setConfirming(null)}
                  className="btn-pill !bg-white/10 !text-white/80 !border-white/10 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!!deletingId}
                  onClick={handleConfirmDelete}
                  className="btn-coral text-sm !bg-gradient-to-br !from-rose-500 !to-rose-600 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' }}
                >
                  {deletingId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  حذف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Page
// ---------------------------------------------------------------------------
const KPI_DEFS = [
  { id: 'revenue',  label: 'Revenue (30d)', icon: TrendingUp, accent: 'from-coral to-peach',
    format: (v) => `${v.toLocaleString()} دج` },
  { id: 'orders',   label: 'Orders',         icon: ShoppingBag, accent: 'from-sky-400 to-indigo-400' },
  { id: 'visitors', label: 'Products',       icon: Boxes,       accent: 'from-fuchsia-400 to-violet-400' },
  { id: 'models',   label: '3D Models',      icon: Boxes,       accent: 'from-emerald-400 to-teal-400' }
];

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [modelsCount, setModelsCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [revenue, setRevenue] = useState(0);

  // Live products → full list + the count of ones with a usable .glb model.
  useEffect(() => {
    let unsub;
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setProducts(list);
          setModelsCount(
            list.filter((p) => p.modelUrl && !p.modelUrl.includes('/image/upload/')).length
          );
        },
        (err) => console.warn('products subscription error', err)
      );
    } catch (e) { console.warn('products subscription unavailable', e); }
    return () => unsub?.();
  }, []);

  // Live orders → recent list + count + revenue.
  useEffect(() => {
    let unsub;
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(8));
      unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOrders(list);
          setOrderCount(snap.size);
          setRevenue(list.reduce((sum, o) => sum + (Number(o.total) || 0), 0));
        },
        (err) => console.warn('orders subscription error', err)
      );
    } catch (e) { console.warn('orders subscription unavailable', e); }
    return () => unsub?.();
  }, []);

  const kpiValues = {
    revenue,
    orders: orderCount,
    visitors: products.length,   // re-purposed as "products" count for now
    models: modelsCount
  };

  async function handleDeleteProduct(id) {
    await deleteProduct(id);
    // The onSnapshot subscription updates the UI automatically.
  }

  async function handleUpdateProduct(id, updates) {
    await updateProduct(id, updates);
    // The onSnapshot subscription updates the UI automatically.
  }

  return (
    <div className="min-h-screen bg-graphite bg-admin-aurora text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex gap-6" dir="ltr">
        <Sidebar />

        <main className="flex-1 min-w-0">
          <Topbar />

          {/* KPI strip — all values from Firestore */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_DEFS.map((k, i) => (
              <KpiCard key={k.id} kpi={k} value={kpiValues[k.id]} i={i} />
            ))}
          </section>

          {/* Studio quick-action — sole entry into product creation. */}
          <section className="mt-4">
            <motion.div
              whileHover={{ y: -3 }}
              className="glass-dark rounded-3xl p-6 border-hairline relative overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-gradient-to-br from-coral to-violet-400 opacity-30 blur-3xl" />
              <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 opacity-20 blur-3xl" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="grid place-items-center w-14 h-14 rounded-3xl bg-white/10 border border-white/10">
                    <Sparkles size={20} className="text-peach" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">AI Studio</h3>
                    <p className="text-sm text-white/60 mt-1 max-w-md">
                      المكان الوحيد لرفع الصور وإضافة المنتجات. ارفع عدة صور، اختر واحدة لتحويلها إلى نموذج ثلاثي الأبعاد، وانشر فوراً.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="chip bg-white/5 border-white/10 text-white/70">
                        <Boxes size={11} className="text-peach" /> صور متعددة
                      </span>
                      <span className="chip bg-white/5 border-white/10 text-white/70">
                        <Sparkles size={11} className="text-peach" /> 2D → 3D
                      </span>
                      <span className="chip bg-white/5 border-white/10 text-white/70">
                        نشر فوري
                      </span>
                    </div>
                  </div>
                </div>
                <Link to="/admin/new" className="btn-coral text-sm shrink-0">
                  <Plus size={14} />
                  أضف منتجاً
                </Link>
              </div>
            </motion.div>
          </section>

          {/* Products — live list with edit + delete */}
          <section className="mt-4">
            <ProductsPanel
              products={products}
              onDelete={handleDeleteProduct}
              onUpdate={handleUpdateProduct}
            />
          </section>

          {/* Orders — live, with a beautiful empty state */}
          <section className="mt-4">
            <OrdersPanel orders={orders} />
          </section>
        </main>
      </div>
    </div>
  );
}
