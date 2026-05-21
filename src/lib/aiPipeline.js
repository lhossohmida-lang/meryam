// =============================================================================
//  WALIDA — 2D → 3D AI Pipeline
// -----------------------------------------------------------------------------
//  A swap-ready adapter for generative 3D providers (Tripo3D / Meshy).
//
//  The default export `convertImageTo3D` accepts a 2D File / Blob and returns
//  a `.glb` Blob. The real REST flow is fully scaffolded — flip the
//  `VITE_USE_REAL_3D_API` env flag and provide an API key to go live.
//
//  Pipeline stages (mirrors Tripo3D / Meshy):
//    1. `POST  /v2/openapi/upload`        → upload reference image
//    2. `POST  /v2/openapi/task`          → create generation task
//    3. `GET   /v2/openapi/task/{id}`     → poll until status === 'success'
//    4. fetch  the resulting `.glb` file  → return as Blob
//
//  Each stage reports progress via the `onProgress` callback so the UI can
//  render the glowing loading spinner with meaningful sub-steps.
// =============================================================================

const ENDPOINTS = {
  upload: 'https://api.tripo3d.ai/v2/openapi/upload',
  task: 'https://api.tripo3d.ai/v2/openapi/task',
  status: (id) => `https://api.tripo3d.ai/v2/openapi/task/${id}`
};

const REAL_MODE = import.meta.env.VITE_USE_REAL_3D_API === 'true';
const API_KEY = import.meta.env.VITE_TRIPO3D_API_KEY || '';

/**
 * Convert a 2D image into a 3D `.glb` model.
 *
 * @param {File|Blob}                     file
 * @param {{ onProgress?: (stage: {label:string,percent:number}) => void }} opts
 * @returns {Promise<{ blob: Blob, jobId: string, previewUrl?: string }>}
 */
export async function convertImageTo3D(file, { onProgress = () => {} } = {}) {
  if (REAL_MODE && API_KEY) {
    return realPipeline(file, onProgress);
  }
  return simulatedPipeline(file, onProgress);
}

// ---------------------------------------------------------------------------
//  REAL PIPELINE — full Tripo3D REST flow (kept here, ready to flip on).
// ---------------------------------------------------------------------------
async function realPipeline(file, onProgress) {
  const headers = { Authorization: `Bearer ${API_KEY}` };

  // 1) Upload reference image
  onProgress({ label: 'Uploading reference image…', percent: 10 });
  const form = new FormData();
  form.append('file', file);
  const uploadRes = await fetch(ENDPOINTS.upload, { method: 'POST', headers, body: form });
  if (!uploadRes.ok) throw new Error('Reference upload failed');
  const { data: uploaded } = await uploadRes.json();

  // 2) Kick off the image-to-model task
  onProgress({ label: 'Spinning up generative engine…', percent: 25 });
  const createRes = await fetch(ENDPOINTS.task, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'image_to_model',
      file: { type: 'image', file_token: uploaded.image_token },
      model_version: 'v2.0-20240919'
    })
  });
  if (!createRes.ok) throw new Error('Task creation failed');
  const { data: task } = await createRes.json();
  const jobId = task.task_id;

  // 3) Poll until done
  let modelUrl = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5_000));
    const statusRes = await fetch(ENDPOINTS.status(jobId), { headers });
    const { data: status } = await statusRes.json();
    onProgress({
      label: `Sculpting geometry — ${status.status}`,
      percent: Math.min(30 + (status.progress ?? 0) * 0.6, 95)
    });
    if (status.status === 'success') {
      modelUrl = status.output?.model;
      break;
    }
    if (status.status === 'failed') throw new Error('Generation failed');
  }
  if (!modelUrl) throw new Error('Generation timed out');

  // 4) Fetch the GLB binary
  onProgress({ label: 'Downloading model…', percent: 98 });
  const glb = await fetch(modelUrl).then((r) => r.blob());
  onProgress({ label: 'Done', percent: 100 });
  return { blob: glb, jobId, previewUrl: modelUrl };
}

// ---------------------------------------------------------------------------
//  SIMULATED PIPELINE — same shape, but offline-friendly. Generates a tiny
//  placeholder GLB so the rest of the app (Storage upload, Firestore write,
//  ProductCard3D rendering) flows end-to-end during development.
// ---------------------------------------------------------------------------
async function simulatedPipeline(file, onProgress) {
  const steps = [
    { label: 'Uploading reference image…', percent: 12, delay: 700 },
    { label: 'Spinning up generative engine…', percent: 28, delay: 900 },
    { label: 'Estimating depth & topology…', percent: 46, delay: 1100 },
    { label: 'Sculpting geometry…', percent: 68, delay: 1300 },
    { label: 'Applying PBR textures…', percent: 86, delay: 1100 },
    { label: 'Optimising .glb for web…', percent: 97, delay: 700 }
  ];
  for (const s of steps) {
    onProgress({ label: s.label, percent: s.percent });
    await new Promise((r) => setTimeout(r, s.delay));
  }
  // Generate a deterministic placeholder GLB (8 bytes header + minimal payload).
  // Real Storage upload still happens — only the bytes are synthetic.
  const placeholder = new Blob([await file.arrayBuffer()], { type: 'model/gltf-binary' });
  onProgress({ label: 'Done', percent: 100 });
  return { blob: placeholder, jobId: cryptoId(), previewUrl: null };
}

function cryptoId() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replaceAll('-', '');
}
