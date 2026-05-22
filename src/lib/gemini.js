// =============================================================================
//  WALIDA — Gemini AI client (browser-side)
// -----------------------------------------------------------------------------
//  Two surfaces:
//    • chatWithAssistant(history, userMessage) — the storefront concierge.
//      Maintains the full conversation in `history` so each reply has context.
//      `history` shape (the Gemini SDK format):
//        [{ role: 'user' | 'model', parts: [{ text: '...' }] }, ...]
//      The FIRST entry must always be role:'user' — the SDK rejects histories
//      that open with a model turn, so do not seed the welcome greeting here.
//
//    • generateProductContent(keywords) — admin helper that turns a few
//      keywords into { nameAr, nameEn, description } JSON for one-tap fill.
//
//  Configuration:
//    The API key is read from import.meta.env.VITE_GEMINI_API_KEY at runtime.
//    NEVER hard-code it. On Vercel set it under Project → Environment Variables.
//    Note: VITE_ vars ship to the client bundle, so the key is publicly visible
//    once the site is deployed. Restrict the key on Google AI Studio to your
//    Vercel domain (HTTP referrer allowlist) before going live with billing.
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

// Model selection — `gemini-2.5-flash` works on the free tier and gives
// solid Arabic quality. Other tested free-tier-friendly fallbacks (verified
// 2026-05): `gemini-2.5-flash-lite`, `gemini-flash-lite-latest`.
//
// AVOID:
//   • `gemini-2.0-flash` / `gemini-2.0-flash-exp` — limit=0 on free tier
//     (paid-only as of 2026), throws 429 immediately.
//   • `gemini-1.5-flash` — removed from v1beta API in 2026 (returns 404).
//
// Listing models for a key:
//   https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
const MODEL_ID = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `أنتِ مساعدة متجر براءة كيدز للملابس الفاخرة للأطفال في الجزائر. أجيبي بأسلوب دافئ وراقٍ.
ساعدي في: المقاسات حسب عمر الطفل، الألوان المتاحة، اقتراح المنتجات، الأسعار (بالدينار الجزائري دج).
الفئات: فساتين، أطقم، تريكو، أحذية.
تحدثي بالعربية الجزائرية إذا تحدث المستخدم بها.`;

// Resolves the API key or throws a friendly Arabic error the UI can show as-is.
function getKey() {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'VITE_GEMINI_API_KEY غير محدد. أضيفي المفتاح في إعدادات Vercel ثم أعيدي النشر.'
    );
  }
  return key;
}

// Retry transient Google errors (503 overloaded, 429 rate-limited) with
// exponential backoff. Permanent errors (400 bad request, 404 model gone,
// 401 bad key) bubble up immediately so the caller can show the real cause.
// Total worst-case wait at attempt=3 is 1s + 2s = 3s before final failure.
async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '');
      const transient = msg.includes('503') || msg.includes('overloaded')
                     || msg.includes('429') || msg.includes('high demand');
      if (!transient || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  // Rewrite the most common transient errors into something the UI can show.
  const msg = String(lastErr?.message || '');
  if (msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand')) {
    throw new Error('النموذج مزدحم الآن، حاولي بعد لحظات قليلة.');
  }
  if (msg.includes('429')) {
    throw new Error('تجاوزت الحصة المسموحة. حاولي خلال دقيقة أو فعّلي الـ billing.');
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
//  Storefront chat — multi-turn with persisted history.
// ---------------------------------------------------------------------------
export async function chatWithAssistant(history, userMessage) {
  return withRetry(async () => {
    const genAI = new GoogleGenerativeAI(getKey());
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: SYSTEM_PROMPT
    });
    const chat = model.startChat({ history: Array.isArray(history) ? history : [] });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  });
}

// ---------------------------------------------------------------------------
//  Admin helper — one-shot keyword → product copy.
//  Returns { nameAr, nameEn, description }. Throws on malformed JSON so the
//  caller can show a clear error and let the admin try different keywords.
// ---------------------------------------------------------------------------
export async function generateProductContent(keywords) {
  const text = await withRetry(async () => {
    const genAI = new GoogleGenerativeAI(getKey());
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const prompt = `أنت خبير في ملابس الأطفال الفاخرة.
من الكلمات التالية: "${keywords}"
أنشئ:
1. اسم منتج بالعربية (nameAr)
2. اسم منتج بالإنجليزية (nameEn)
3. وصف قصير بالعربية (description) - جملتان فقط
أجب بـ JSON فقط بدون أي نص آخر:
{"nameAr":"...","nameEn":"...","description":"..."}`;

    const result = await model.generateContent(prompt);
    // Strip markdown code fences the model sometimes wraps JSON in.
    return result.response.text().replace(/```json|```/g, '').trim();
  });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('تعذّر قراءة الرد من Gemini. حاولي بكلمات مفتاحية أخرى.');
  }
}

// Lightweight readiness probe — components can use this to decide whether
// to show the AI surface at all (avoids a runtime error in fresh installs).
export function isGeminiConfigured() {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

// ---------------------------------------------------------------------------
//  Admin assistant — context-aware concierge for the dashboard.
//  Receives a `context` snapshot (products, orders, revenue) so it can
//  answer questions about the actual store state ("كم منتج عندي؟",
//  "ما الفئة الأكثر مبيعاً؟"), suggest copy, draft order replies, etc.
//
//  Token discipline: we cap each list at 20 entries and strip noisy fields
//  before sending — enough context for useful answers without blowing up
//  the prompt or leaking image URLs / internal IDs the admin doesn't need.
// ---------------------------------------------------------------------------
function buildAdminSystemPrompt(context = {}) {
  const {
    products = [],
    orders = [],
    customerMessages = [],
    productCount,
    orderCount,
    revenue
  } = context;

  // Compact a product/order to a one-line summary so the prompt stays small.
  const productLines = products.slice(0, 20).map((p, i) =>
    `${i + 1}. ${p.nameAr || p.nameEn || '—'} (${p.category || 'general'}) — ${p.price ?? 0} دج`
  ).join('\n');

  const orderLines = orders.slice(0, 20).map((o, i) =>
    `${i + 1}. ${o.customer || 'زبون'} — ${o.total ?? 0} دج — ${o.items ?? 0} عناصر — ${o.status || 'جديد'}`
  ).join('\n');

  // Customer chat — most recent 30 turns, grouped per visitor session so
  // the model can see Q→A flow. Trim each message to 300 chars to bound prompt size.
  const recentChat = customerMessages.slice(-30);
  const chatLines = recentChat.length
    ? recentChat.map((m) => {
        const who = m.role === 'user' ? 'زبون' : 'المساعدة';
        const sid = (m.sessionId || 'anon').slice(0, 6);
        const text = String(m.text || '').slice(0, 300).replace(/\s+/g, ' ').trim();
        return `[${sid}] ${who}: ${text}`;
      }).join('\n')
    : '(لا توجد رسائل من الزبائن بعد)';

  return `أنتِ مساعدة الإدارة في متجر براءة كيدز للملابس الفاخرة للأطفال في الجزائر.
دورك: مساعدة المالكة في إدارة المتجر بالكامل — تنظيم الطلبات، إدخال المنتجات، اقتراح الأسماء والأوصاف، تحليل المبيعات، قراءة وفهم ما يسأله الزبائن في الشات.
أجيبي بالعربية الجزائرية إن خاطبتك المالكة بها، وبأسلوب عملي مختصر.

== حالة المتجر الآن ==
• عدد المنتجات: ${productCount ?? products.length}
• عدد الطلبات: ${orderCount ?? orders.length}
• إيرادات آخر 30 يوماً: ${revenue ?? 0} دج
• الفئات المتاحة: فساتين، أطقم، تريكو، أحذية
• رسائل شات الزبائن المحفوظة: ${customerMessages.length}

== المنتجات (أحدث ${Math.min(products.length, 20)}) ==
${productLines || '(لا توجد منتجات بعد)'}

== الطلبات (أحدث ${Math.min(orders.length, 20)}) ==
${orderLines || '(لا توجد طلبات بعد)'}

== شات الزبائن (آخر ${recentChat.length} رسالة، [xxxxxx] = آخر 6 أحرف من معرف الجلسة) ==
${chatLines}

== كيف تساعدين ==
- لو سألتك "إيش يسأل الزبائن؟" أو "لخّصي شكاوى الزبائن" — حلّلي قسم "شات الزبائن" أعلاه واذكري الأنماط المتكرّرة.
- لو سألتك "كم منتج عندي؟" أو "إيش الفئة الأكثر؟" — جاوبي مباشرة من البيانات أعلاه.
- لو طلبت اسم/وصف لمنتج جديد — اقترحي 2-3 خيارات بأسماء عربية وإنجليزية.
- لو سألت عن تنظيم الطلبات — اقترحي خطوات عملية (تأكيد، تجهيز، شحن، تسليم).
- لو سألت عن تسعير — اقترحي نطاق أسعار مناسب لملابس الأطفال الفاخرة بالدج.
- لا تخترعي بيانات غير موجودة أعلاه. إن لم تعرفي، قولي ذلك بصراحة.`;
}

export async function chatWithAdminAssistant(history, userMessage, context = {}) {
  return withRetry(async () => {
    const genAI = new GoogleGenerativeAI(getKey());
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: buildAdminSystemPrompt(context)
    });
    const chat = model.startChat({ history: Array.isArray(history) ? history : [] });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  });
}
