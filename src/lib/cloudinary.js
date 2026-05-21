// =============================================================================
//  WALIDA — Cloudinary Uploader
// -----------------------------------------------------------------------------
//  Browser-direct uploads via Cloudinary's *unsigned* upload endpoint.
//  No back-end, no Firebase Storage. Free tier: 25 GB / 25 k transformations.
//
//  Setup (one-time, 2 minutes):
//   1. Sign up at https://cloudinary.com (free, no card).
//   2. Dashboard → note your "Cloud name".
//   3. Settings → Upload → "Add upload preset" → set:
//        • Signing mode: Unsigned
//        • Folder:        walida   (optional)
//        • Save the preset name.
//   4. Add to `.env` at the project root:
//        VITE_CLOUDINARY_CLOUD_NAME=<your-cloud-name>
//        VITE_CLOUDINARY_UPLOAD_PRESET=<your-preset-name>
//   5. Restart `npm run dev`.
//
//  Endpoints used:
//   • images:  /v1_1/{cloud}/image/upload
//   • models:  /v1_1/{cloud}/raw/upload    (for .glb, .gltf, etc.)
// =============================================================================

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const DEFAULT_FOLDER = 'walida';

/** True when both env vars are present. The UI shows the setup banner when false. */
export function isCloudinaryConfigured() {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/** Expose config for diagnostics (banner shows partial cloud name etc.). */
export function cloudinaryConfig() {
  return { cloudName: CLOUD_NAME, preset: UPLOAD_PRESET };
}

/**
 * Upload a Blob / File to Cloudinary's unsigned endpoint.
 *
 * @param {Blob|File} file
 * @param {object}    opts
 * @param {'image'|'raw'|'video'|'auto'} opts.resourceType  defaults to 'auto'
 * @param {string}    opts.folder                            defaults to 'walida'
 * @param {string}    opts.publicId                          optional, lets us name the asset
 * @param {(p:number)=>void} opts.onProgress                 0..100 callback
 * @returns {Promise<{ url: string, publicId: string, bytes: number, format: string }>}
 */
export async function uploadToCloudinary(file, {
  resourceType = 'auto',
  folder = DEFAULT_FOLDER,
  publicId,
  onProgress
} = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary غير مُعدّ. أضف VITE_CLOUDINARY_CLOUD_NAME و VITE_CLOUDINARY_UPLOAD_PRESET في .env ثم أعد تشغيل npm run dev.'
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', folder);
  if (publicId) form.append('public_id', publicId);

  // XHR (not fetch) so we get real upload progress events.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.timeout = 90_000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            publicId: data.public_id,
            bytes: data.bytes,
            format: data.format
          });
        } catch (e) {
          reject(new Error('استجابة Cloudinary غير صالحة.'));
        }
      } else {
        reject(decorateError(xhr));
      }
    };
    xhr.onerror   = () => reject(new Error('انقطع الاتصال بـ Cloudinary.'));
    xhr.ontimeout = () => reject(new Error('انتهت المهلة قبل اكتمال الرفع.'));
    xhr.onabort   = () => reject(new Error('تم إلغاء الرفع.'));

    xhr.send(form);
  });
}

function decorateError(xhr) {
  let raw = {};
  try { raw = JSON.parse(xhr.responseText); } catch {}
  const msg = raw?.error?.message || `فشل الرفع (HTTP ${xhr.status}).`;
  // Common Cloudinary error shapes — translate to Arabic.
  if (/Upload preset not found/i.test(msg)) {
    return new Error('الـ upload preset غير موجود أو غير مفعّل كـ Unsigned. تحقق من الإعدادات.');
  }
  if (/Invalid cloud name/i.test(msg) || xhr.status === 404) {
    return new Error('اسم Cloud غير صحيح. راجع VITE_CLOUDINARY_CLOUD_NAME في .env.');
  }
  if (xhr.status === 401 || /must be whitelisted/i.test(msg)) {
    return new Error('الـ preset مُهيّأ كـ Signed بدلاً من Unsigned. غيّره من Cloudinary Console.');
  }
  return new Error(msg);
}

/** Quick health check used by the admin UI to verify config. */
export async function pingCloudinary() {
  if (!isCloudinaryConfigured()) {
    return { ok: false, reason: 'missing-env' };
  }
  try {
    // Send a tiny 1-byte raw upload to confirm cloud name + preset are valid.
    const ping = new Blob([new Uint8Array([1])], { type: 'application/octet-stream' });
    await uploadToCloudinary(ping, { resourceType: 'raw', folder: 'walida/_diagnostics' });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
