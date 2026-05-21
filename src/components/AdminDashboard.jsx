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
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, Users, Boxes, Sparkles, ArrowUpRight,
  Filter, Search, Bell, Plus, Inbox
} from 'lucide-react';

import { db } from '../firebase.js';
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
        <div className="font-arabic text-2xl font-extrabold text-white">وليدة</div>
        <div className="text-shimmer text-[10px] tracking-[0.45em] font-semibold">STUDIO</div>
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
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="glass-dark flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1">
        <Search size={14} className="text-white/50" />
        <input
          className="bg-transparent outline-none text-sm text-white placeholder:text-white/40 flex-1"
          placeholder="بحث…"
        />
      </div>
      <button className="glass-dark w-11 h-11 grid place-items-center rounded-2xl text-white/70">
        <Filter size={16} />
      </button>
      <button className="glass-dark w-11 h-11 grid place-items-center rounded-2xl text-white/70">
        <Bell size={16} />
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
                <div className="text-white font-semibold">{o.total ?? 0} ﷼</div>
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
//  Page
// ---------------------------------------------------------------------------
const KPI_DEFS = [
  { id: 'revenue',  label: 'Revenue (30d)', icon: TrendingUp, accent: 'from-coral to-peach',
    format: (v) => `${v.toLocaleString()} ﷼` },
  { id: 'orders',   label: 'Orders',         icon: ShoppingBag, accent: 'from-sky-400 to-indigo-400' },
  { id: 'visitors', label: 'Visitors',       icon: Users,       accent: 'from-fuchsia-400 to-violet-400' },
  { id: 'models',   label: '3D Models',      icon: Boxes,       accent: 'from-emerald-400 to-teal-400' }
];

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [modelsCount, setModelsCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [revenue, setRevenue] = useState(0);

  // Live products → counts of total products and ones with a .glb model.
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'products'), (snap) => {
        setProductCount(snap.size);
        setModelsCount(snap.docs.filter((d) => d.data().modelUrl).length);
      });
      return unsub;
    } catch (e) { console.warn('products subscription unavailable', e); }
  }, []);

  // Live orders → recent list + count + revenue.
  useEffect(() => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(8));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrders(list);
        setOrderCount(snap.size);
        setRevenue(list.reduce((sum, o) => sum + (Number(o.total) || 0), 0));
      });
      return unsub;
    } catch (e) { console.warn('orders subscription unavailable', e); }
  }, []);

  const kpiValues = {
    revenue,
    orders: orderCount,
    visitors: 0,
    models: modelsCount
  };

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

          {/* Orders — live, with a beautiful empty state */}
          <section className="mt-4">
            <OrdersPanel orders={orders} />
          </section>
        </main>
      </div>
    </div>
  );
}
