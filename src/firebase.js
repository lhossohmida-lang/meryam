// =============================================================================
//  WALIDA — Firebase Initialization
// -----------------------------------------------------------------------------
//  We use Firebase only for:
//    • Auth       → anonymous sessions (so Firestore writes are allowed)
//    • Firestore  → products, orders, generation jobs
//    • Analytics  → opt-in
//
//  Asset storage lives in Cloudinary — see `src/lib/cloudinary.js`.
//  Firebase Storage is intentionally NOT initialized.
// =============================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBMjywF9ZTGonzUDcgxQ0ZTV-nhWxtd-W0',
  authDomain: 'mreim-3027a.firebaseapp.com',
  projectId: 'mreim-3027a',
  storageBucket: 'mreim-3027a.firebasestorage.app',
  messagingSenderId: '261824200065',
  appId: '1:261824200065:web:f39f263af8e3d3d1f4fc80',
  measurementId: 'G-9CDF312KP2'
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const analyticsReady = analyticsSupported()
  .then((ok) => (ok ? getAnalytics(app) : null))
  .catch(() => null);

//  ---------------------------------------------------------------------------
//  Anonymous auth — needed so Firestore's default rule
//  `allow read, write: if request.auth != null` lets the admin save products.
//  ---------------------------------------------------------------------------
let _authReady;
export function ensureAuth() {
  if (_authReady) return _authReady;
  _authReady = new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user); }
    });
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        unsub();
        if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
          reject(new Error(
            'فعّل تسجيل الدخول المجهول من Firebase Console → Authentication → Sign-in method → Anonymous.'
          ));
        } else {
          reject(err);
        }
      });
    }
  });
  return _authReady;
}

ensureAuth().catch((e) => console.warn('[walida] auth init failed:', e.message));

//  ---------------------------------------------------------------------------
//  Firestore helpers — all metadata (including Cloudinary URLs) lives here.
//  ---------------------------------------------------------------------------

/**
 * Persist a product record in Firestore.
 * `product.images[i].url` and `product.modelUrl` should be Cloudinary URLs.
 * @returns {Promise<string>} new document id
 */
export async function saveProduct(product) {
  await ensureAuth();
  const ref = await addDoc(collection(db, 'products'), {
    ...product,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: product.status ?? 'published'
  });
  return ref.id;
}

/** Track a 2D→3D generation job (useful for retry / analytics). */
export async function recordGenerationJob(jobId, payload) {
  await ensureAuth();
  await setDoc(doc(db, 'generationJobs', jobId), {
    ...payload,
    createdAt: serverTimestamp()
  }, { merge: true });
}
