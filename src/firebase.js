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
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  limit,
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
    // Wait for the first onAuthStateChanged emission, which reflects the
    // fully-restored session from IndexedDB persistence. Only then decide
    // whether anonymous sign-in is needed. Calling signInAnonymously()
    // synchronously (when auth.currentUser is transiently null during
    // SDK initialisation) would overwrite a valid admin session and sign
    // the admin out on every page reload.
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub(); // unsubscribe after the first (definitive) emission
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then((cred) => resolve(cred.user))
          .catch((err) => {
            if (
              err?.code === 'auth/admin-restricted-operation' ||
              err?.code === 'auth/operation-not-allowed'
            ) {
              reject(new Error(
                'فعّل تسجيل الدخول المجهول من Firebase Console → Authentication → Sign-in method → Anonymous.'
              ));
            } else {
              reject(err);
            }
          });
      }
    });
  });
  return _authReady;
}

ensureAuth().catch((e) => console.warn('[walida] auth init failed:', e.message));

//  ---------------------------------------------------------------------------
//  Email / password helpers — used by the admin login screen.
//  Any signed-in NON-anonymous user counts as admin for now (single shop).
//  ---------------------------------------------------------------------------

const AUTH_ERRORS = {
  'auth/invalid-email':            'البريد الإلكتروني غير صحيح.',
  'auth/user-not-found':           'لا يوجد حساب بهذا البريد. أنشئ حساباً جديداً.',
  'auth/wrong-password':           'كلمة المرور غير صحيحة.',
  'auth/invalid-credential':       'البريد أو كلمة المرور غير صحيحة.',
  'auth/email-already-in-use':     'هذا البريد مُستخدم بالفعل. سجّل دخولاً بدل الإنشاء.',
  'auth/weak-password':            'كلمة المرور قصيرة — استخدم 6 أحرف على الأقل.',
  'auth/network-request-failed':   'تعذّر الاتصال بـ Firebase — تحقّق من الإنترنت.',
  'auth/too-many-requests':        'محاولات كثيرة. حاول بعد قليل.',
  'auth/operation-not-allowed':    'فعّل Email/Password من Firebase Console → Authentication → Sign-in method.'
};

function authError(err) {
  const msg = AUTH_ERRORS[err?.code] || err?.message || 'فشل غير متوقع.';
  const out = new Error(msg);
  out.code = err?.code;
  return out;
}

export async function adminSignIn(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    throw authError(err);
  }
}

export async function adminSignUp(email, password, displayName) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName }).catch(() => {});
    }
    return cred.user;
  } catch (err) {
    throw authError(err);
  }
}

export async function adminResetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw authError(err);
  }
}

export async function adminSignOut() {
  await signOut(auth);
  // Re-sign-in anonymously immediately so the storefront keeps working.
  await signInAnonymously(auth).catch(() => {});
}

/**
 * Subscribe to the auth state. Calls back with the current user (or null)
 * whenever it changes. Returns the unsubscribe fn.
 */
export function onUser(callback) {
  return onAuthStateChanged(auth, callback);
}

/** True iff a real (non-anonymous) user is signed in. */
export function isAdminUser(user) {
  return !!user && !user.isAnonymous;
}

//  ---------------------------------------------------------------------------
//  Firestore helpers — all metadata (including Cloudinary URLs) lives here.
//  ---------------------------------------------------------------------------

/**
 * Map low-level Firestore / network errors to actionable Arabic messages.
 */
function decorateFirebaseError(err) {
  const code = err?.code || '';
  const msg = err?.message || '';

  // "Failed to fetch" is the browser's generic message for CORS / network /
  // unreachable endpoint — for Firestore that almost always means the DB
  // wasn't created in the console yet.
  if (/Failed to fetch/i.test(msg) || code === 'unavailable') {
    return new Error(
      'تعذّر الوصول إلى Firestore. تحقّقي أنك أنشأتِ قاعدة بيانات Firestore في Firebase Console.'
    );
  }

  const map = {
    'permission-denied':
      'القواعد ترفض الوصول. الصقي محتوى firestore.rules في Console → Firestore → Rules ثم اضغطي Publish.',
    'unauthenticated':   'انتهت الجلسة. أعيدي تحميل الصفحة.',
    'not-found':         'قاعدة البيانات غير موجودة. أنشئيها من Firebase Console → Firestore Database.',
    'resource-exhausted':'تم تجاوز حصة Firestore اليومية.'
  };
  return new Error(map[code] || msg || 'فشل حفظ المنتج.');
}

/**
 * Persist a product record in Firestore.
 * `product.images[i].url` and `product.modelUrl` should be Cloudinary URLs.
 * @returns {Promise<string>} new document id
 */
export async function saveProduct(product) {
  try {
    await ensureAuth();
    await refreshTokenForAdmin();
    const ref = await addDoc(collection(db, 'products'), {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: product.status ?? 'published'
    });
    return ref.id;
  } catch (err) {
    throw decorateFirebaseError(err);
  }
}

/**
 * Force the SDK to fetch a fresh ID token so security rules see the latest
 * `sign_in_provider`. Without this, an admin who just signed up/in within
 * the same tab may still hit `permission-denied` because the cached token
 * still reports the previous anonymous identity.
 */
async function refreshTokenForAdmin() {
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    try { await user.getIdToken(true); } catch {}
  }
}

/**
 * Permanently delete a product. (Cloudinary assets remain on the CDN —
 * deleting them requires a signed call, do it separately if needed.)
 */
export async function deleteProduct(productId) {
  try {
    await ensureAuth();
    await refreshTokenForAdmin();
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    throw decorateFirebaseError(err);
  }
}

/**
 * Update specific fields on a product. Validation mirrors `validProduct()`
 * in firestore.rules — pass only fields you've changed.
 */
export async function updateProduct(productId, updates) {
  try {
    await ensureAuth();
    await refreshTokenForAdmin();
    await updateDoc(doc(db, 'products', productId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    throw decorateFirebaseError(err);
  }
}

/** Track a 2D→3D generation job (useful for retry / analytics). */
export async function recordGenerationJob(jobId, payload) {
  try {
    await ensureAuth();
    await setDoc(doc(db, 'generationJobs', jobId), {
      ...payload,
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    // Non-fatal — the product was already saved. Log and move on.
    console.warn('[walida] recordGenerationJob skipped:', err.message);
  }
}

/**
 * Quick health check — verifies that Firestore is reachable AND the rules
 * actually allow the admin to write. Returns `{ ok, reason, error }`.
 *
 * Strategy (smart):
 *   1. ensureAuth → must succeed (anonymous or real).
 *   2. Read /products with a limit(1) → tests the `allow read` rule.
 *      Works whether the collection is empty or full.
 *   3. If the current user is non-anonymous (admin), attempt a tiny
 *      write/delete cycle to the diagnostics collection so we know the
 *      write rules accept them BEFORE they spend 30s uploading photos.
 */
export async function pingFirebase() {
  let user;
  try {
    user = await ensureAuth();
  } catch (e) {
    return { ok: false, reason: 'auth', error: e };
  }

  // 1) Read test — exercises `allow read` on /products (public).
  try {
    await getDocs(query(collection(db, 'products'), limit(1)));
  } catch (err) {
    return { ok: false, reason: 'firestore', error: decorateFirebaseError(err) };
  }

  // 2) Write test — only relevant for admins (non-anonymous). We try a
  //    real admin operation against the rules to surface "permission-denied"
  //    BEFORE the upload flow starts.
  if (user && !user.isAnonymous) {
    try {
      const ref = doc(db, 'generationJobs', `_ping_${user.uid}`);
      await setDoc(ref, { ping: true, at: serverTimestamp() }, { merge: true });
    } catch (err) {
      return { ok: false, reason: 'firestore', error: decorateFirebaseError(err) };
    }
  }

  return { ok: true };
}
