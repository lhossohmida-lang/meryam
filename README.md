# Walida — وليدة

Luxury children's clothing PWA — magical storefront + studio admin dashboard.

## Stack
- **React 18 + Vite** with `vite-plugin-pwa` (installable, offline-ready)
- **Tailwind CSS** with custom glassmorphism utilities and an iridescent pastel palette
- **Framer Motion** for liquid page transitions and staggered grid reveals
- **@react-three/fiber + drei** for the 3D product grid (studio lighting + contact shadows + auto-rotate)
- **Firebase** (Auth / Firestore / Storage) for the live backend
- **2D → 3D AI pipeline** (placeholder Tripo3D / Meshy adapter) that converts uploaded images to `.glb`

## Run
```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # production PWA bundle
npm run preview  # serve the bundle locally
```

## Routes
| Path | Purpose |
| --- | --- |
| `/` | Client storefront — video hero + 3D product grid |
| `/admin` | Studio dashboard — orders, analytics |
| `/admin/new` | AI Product Creator — drag & drop 2D → 3D pipeline |

## Architecture (modular deliverables)
| File | Role |
| --- | --- |
| `src/firebase.js` | Backend init (Auth, Firestore, Storage, Analytics) |
| `src/App.jsx` | Routing + Framer Motion context + PWA manifest injection |
| `src/components/ClientStorefront.jsx` | Hero video + 3D product grid + bottom nav |
| `src/components/ProductCard3D.jsx` | WebGL-powered responsive card wrapper |
| `src/components/AdminDashboard.jsx` | Dark glass dashboard with order queues |
| `src/components/AIProductCreator.jsx` | 2D → 3D upload pipeline (Tripo3D / Meshy adapter) |
| `src/global.css` | Tailwind base + glassmorphism utilities + custom variables |

## 2D → 3D pipeline
`AIProductCreator.jsx` ships a complete, swap-ready pipeline:

1. Drag-and-drop one or more 2D images. Pick one as the **3D source**.
2. The 3D source is sent to `convertImageTo3D()` in [aiPipeline.js](src/lib/aiPipeline.js) — a fully scaffolded simulation of the Tripo3D / Meshy REST flow. Flip one env var to go live.
3. All gallery images upload to Cloudinary under `walida/products/{jobId}/`. The `.glb` uploads to `walida/models/{jobId}.glb` (raw resource).
4. The product document is persisted to Firestore (`products/{productId}`) with the Cloudinary URLs.

## Brand language
Iridescent pearl + soft lavender + pastel rose + baby blue. Pure-white cards with diffused floating shadows. Coral → peach gradient CTAs. Outfit (Latin) + Tajawal (Arabic) typography. RTL-first.

## Cloudinary setup (one-time, 2 minutes)

Walida stores all images and `.glb` models on **Cloudinary** (free 25 GB tier). Firebase Storage is intentionally NOT used.

1. Sign up at [cloudinary.com](https://cloudinary.com/users/register_free) — no card required.
2. Dashboard → copy your **Cloud name**.
3. [Settings → Upload](https://console.cloudinary.com/settings/upload) → **Add upload preset** → set **Signing mode: Unsigned** → Save the preset name.
4. Copy `.env.example` → `.env` and fill in:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=<your-cloud-name>
   VITE_CLOUDINARY_UPLOAD_PRESET=<your-preset-name>
   ```
5. Restart `npm run dev`.

The admin UI shows a beautiful inline banner with these exact steps if the config is missing or wrong.

## Firebase setup (auth + database)

Only Auth + Firestore are used:

1. **Authentication → Sign-in method → Anonymous → Enable.** The app signs users in anonymously on first load so Firestore writes work.

2. **Firestore → Rules**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /products/{id}        { allow read: if true; allow write: if request.auth != null; }
       match /orders/{id}          { allow read, write: if request.auth != null; }
       match /generationJobs/{id}  { allow read, write: if request.auth != null; }
     }
   }
   ```
