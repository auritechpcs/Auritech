// Cloudflare Pages Function: POST https://auritech.ca/api/muse-deal
//
// Muse (Meta's agent) runs scheduled Facebook Marketplace checks and posts each
// new listing here. This endpoint:
//   1. checks the shared API key (Authorization: Bearer <MUSE_API_KEY>)
//   2. validates the deal (Facebook links only)
//   3. scores it against Auritech's own buy prices
//   4. adds it to the inventory app's Deals tab (Firebase RTDB), once per listing
//   5. buzzes the phones ONLY for a real steal (quality "hot")
//
// Secrets (Cloudflare Pages > Settings > Variables and secrets, Production):
//   MUSE_API_KEY  random shared key that Muse sends
//   FIREBASE_SA   the Firebase service-account JSON (whole file contents)
//
// Send {"test": true, ...} for a harmless check: validates and scores the deal,
// stores nothing, sends nothing.

const PROJECT_ID = 'open-claw-b7e92';
const DB_URL = 'https://open-claw-b7e92-default-rtdb.firebaseio.com';
const ROOT = 'auritech_inventory_v2';
const APP_ICON = 'https://open-claw-b7e92.web.app/logo.jpg';
const MAX_DEALS = 200;

// "Buzz at or under" price per GPU (CAD, card alone). Set at ~85% of what
// Auritech has typically paid for that card (median cost across sold builds and
// inventory, Sept 2026). Edit freely; models not listed fall back to the
// percentage rule below.
export const GPU_STEAL_CAP = {
  '2060 SUPER': 150,
  '2070 SUPER': 130,
  '2080 TI': 255,
  '3060': 170,
  '3060 TI': 190,
  '3070': 255,
  '3070 TI': 270,
  '3080': 320,
  '4060': 255,
  '4070': 425,
  '5060': 240,
  '6800 XT': 255,
};
// Same idea for RAM kits (total capacity + generation), ~85% of median paid. History is
// thin and RAM prices have moved, so the percentage rule below (live comps) matters most.
export const RAM_STEAL_CAP = {
  '16GB DDR4': 35,
  '32GB DDR4': 55,
  '16GB DDR5': 85,
  '32GB DDR5': 130,
};
// Anything (GPU, RAM, full PC, part) buzzes if it's this far under Muse's estimated
// resale. Auritech's median build margin is 33%, so 35% under is a true steal.
export const STEAL_SAVINGS = 0.35;
// Full PCs are the top priority (a ready build that just needs cleaning), so they buzz
// a bit earlier.
export const PC_STEAL_SAVINGS = 0.30;
// Shown in the app as "good" (no buzz) at this much under resale.
export const GOOD_SAVINGS = 0.15;

// Where a deal may buzz: Windsor out to Chatham, Ontario side only. A circle big
// enough to reach Chatham also covers Detroit, so the area is a town list, not a
// radius. Unrecognized towns are still stored (no buzz); add hamlets here as needed.
export const AREA_TOWNS = [
  'windsor', 'lasalle', 'tecumseh', 'st. clair beach', 'st clair beach', 'oldcastle',
  'lakeshore', 'belle river', 'emeryville', 'maidstone', 'puce', 'stoney point', 'pointe-aux-roches',
  'comber', 'woodslee', 'lighthouse cove', 'tilbury',
  'amherstburg', 'essex', 'harrow', 'mcgregor', 'colchester', 'cottam',
  'kingsville', 'ruthven', 'leamington', 'wheatley',
  'merlin', 'charing cross', 'chatham',
];
// Michigan / US listings are dropped entirely (not stored, never buzz).
const US_MARKERS = /\b(michigan|detroit|dearborn|wyandotte|taylor|livonia|southfield|warren|sterling heights|troy|ann arbor|monroe|toledo|ohio|usa|united states|mi|oh)\b/i;

export function areaCheck(location) {
  const s = String(location || '').toLowerCase().trim();
  if (!s) return 'unknown';
  if (US_MARKERS.test(s)) return 'outside';
  return AREA_TOWNS.some((t) => s.includes(t)) ? 'inside' : 'unknown';
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ------------------------------------------------------------------ scoring
export function gpuModel(text) {
  const s = String(text || '').toUpperCase().replace(/[-_]/g, ' ');
  // AMD first, so "RX 6800 XT" keeps its XT instead of matching as plain "6800"
  const m =
    s.match(/\bRX\s?(\d{4})\s?(XTX|XT)?\b/) ||
    s.match(/\b(\d{4})\s?(XTX|XT)\b/) ||
    s.match(/\b(?:RTX|GTX)?\s?(\d{4})\s?(TI|SUPER)?\b/);
  if (!m) return null;
  return [m[1], m[2]].filter(Boolean).join(' ');
}

// "2x16GB DDR5 6000" -> "32GB DDR5". Capacity is the kit total.
export function ramKey(text) {
  const s = String(text || '').toLowerCase();
  const gen = s.match(/ddr\s?([45])/);
  const kit = s.match(/(\d)\s?x\s?(\d{1,2})\s?gb/);
  const one = s.match(/(\d{1,3})\s?gb/);
  const cap = kit ? Number(kit[1]) * Number(kit[2]) : one ? Number(one[1]) : null;
  if (!cap || !gen || cap > 256) return null;
  return `${cap}GB DDR${gen[1]}`;
}

export function scoreDeal(d) {
  const model =
    d.category === 'gpu' ? gpuModel(d.gpu_model || d.title) : d.category === 'ram' ? ramKey(d.ram_spec || d.title) : null;
  const cap = model ? (d.category === 'ram' ? RAM_STEAL_CAP : GPU_STEAL_CAP)[model] : undefined;
  const savings = d.estimated_resale > 0 ? (d.estimated_resale - d.price) / d.estimated_resale : null;
  const underCap = cap !== undefined && d.price <= cap;
  const bigSavings = savings !== null && savings >= (d.category === 'pc' ? PC_STEAL_SAVINGS : STEAL_SAVINGS);
  const area = areaCheck(d.location);
  const steal = !d.suspicious && d.price > 0 && (underCap || bigSavings);
  const hot = steal && area === 'inside';
  let quality = 'mid';
  if (hot) quality = 'hot';
  else if (!d.suspicious && (steal || (savings !== null && savings >= GOOD_SAVINGS) || (cap !== undefined && d.price <= cap / 0.85))) quality = 'good';
  const reason = hot
    ? underCap
      ? `$${d.price} is at or under your $${cap} buy cap for a ${model}`
      : `${Math.round(savings * 100)}% under est. resale $${d.estimated_resale}`
    : d.suspicious
      ? 'flagged suspicious'
      : steal
        ? `steal price, but "${d.location || 'no location'}" isn't on the area list`
        : 'not a steal';
  return { model, cap: cap ?? null, savings, area, hot, quality, reason };
}

// ------------------------------------------------------------------ validation
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validateDeal(b) {
  const errors = [];
  const listingId = String(b.listing_id ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(listingId)) errors.push('listing_id is required (letters, digits, - or _; max 64)');
  const title = str(b.title, 200);
  if (!title) errors.push('title is required');
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0 || price > 50000) errors.push('price must be a number in CAD');
  let url = '';
  try {
    const u = new URL(String(b.url || ''));
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || !(host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com'))) {
      errors.push('url must be an https facebook.com link');
    } else url = u.toString();
  } catch {
    errors.push('url must be an https facebook.com link');
  }
  const category = ['gpu', 'ram', 'pc', 'part'].includes(b.category) ? b.category : 'part';
  const est = b.estimated_resale === undefined || b.estimated_resale === null ? null : Number(b.estimated_resale);
  if (est !== null && (!Number.isFinite(est) || est < 0 || est > 50000)) errors.push('estimated_resale must be a number in CAD');
  if (errors.length) return { errors };
  return {
    deal: {
      listing_id: listingId,
      title,
      price: Math.round(price * 100) / 100,
      url,
      location: str(b.location, 100),
      category,
      gpu_model: str(b.gpu_model, 40),
      ram_spec: str(b.ram_spec, 40),
      estimated_resale: est,
      notes: str(b.notes, 500),
      listed_at: str(b.listed_at, 40),
      suspicious: b.suspicious === true,
    },
  };
}

// ------------------------------------------------------------------ google auth
let tokenCache = null; // reused while this isolate stays warm

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(new TextEncoder().encode(s));

export async function getAccessToken(env, now = Date.now()) {
  if (tokenCache && tokenCache.exp - 60_000 > now) return tokenCache.token;
  const sa = JSON.parse(env.FIREBASE_SA);
  const iat = Math.floor(now / 1000);
  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlText(
    JSON.stringify({
      iss: sa.client_email,
      scope: [
        'https://www.googleapis.com/auth/firebase.database',
        'https://www.googleapis.com/auth/firebase.messaging',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const t = await res.json();
  tokenCache = { token: t.access_token, exp: now + (t.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

const rtdb = (path, token, init = {}) =>
  fetch(`${DB_URL}/${ROOT}/${path}.json?access_token=${encodeURIComponent(token)}`, init);

// ------------------------------------------------------------------ store
// Read-modify-write the deals array with an ETag so a concurrent app save or a
// second Muse call can't clobber it. Returns {duplicate} or {stored}.
async function storeDeal(appDeal, token) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await rtdb('deals', token, { headers: { 'X-Firebase-ETag': 'true' } });
    if (!res.ok) throw new Error(`read deals failed: ${res.status}`);
    const etag = res.headers.get('ETag');
    const raw = await res.json();
    const deals = Array.isArray(raw) ? raw.filter(Boolean) : raw ? Object.values(raw) : [];
    if (deals.some((d) => d && d.id === appDeal.id)) return { duplicate: true };
    let next = [...deals, appDeal];
    if (next.length > MAX_DEALS) {
      // drop the oldest non-hot deals first
      next = next.sort((a, b) => (a.quality === 'hot') - (b.quality === 'hot') || (a.timestamp || 0) - (b.timestamp || 0)).slice(next.length - MAX_DEALS);
    }
    const put = await rtdb('deals', token, { method: 'PUT', headers: { 'if-match': etag, 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    if (put.status === 412) continue; // someone else wrote first: re-read and retry
    if (!put.ok) throw new Error(`write deals failed: ${put.status}`);
    return { stored: true };
  }
  throw new Error('deals write kept conflicting');
}

// ------------------------------------------------------------------ notify
async function notifyPhones(appDeal, score, token) {
  const res = await rtdb('push_tokens', token);
  if (!res.ok) throw new Error(`read push tokens failed: ${res.status}`);
  const devices = (await res.json()) || {};
  const title = `🔥 $${appDeal.price} · ${appDeal.title}`.slice(0, 80);
  const body = `${score.reason}${appDeal.location ? ` · ${appDeal.location}` : ''}. Tap to open on Facebook.`.slice(0, 180);
  let sent = 0;
  const removed = [];
  await Promise.all(
    Object.entries(devices).map(async ([key, dev]) => {
      if (!dev || !dev.token) return;
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: dev.token,
            notification: { title, body },
            data: { url: appDeal.url, dealId: appDeal.id },
            webpush: {
              headers: { Urgency: 'high', TTL: '900' },
              notification: { icon: APP_ICON, badge: APP_ICON, tag: appDeal.id, requireInteraction: true },
              fcm_options: { link: appDeal.url },
            },
          },
        }),
      });
      if (r.ok) sent++;
      else if (r.status === 404) {
        // token expired or notifications revoked: forget that device. (Never on
        // 400: that can mean OUR payload is wrong, and must not wipe devices.)
        const detail = await r.text();
        if (/UNREGISTERED|NOT_FOUND/.test(detail)) {
          await rtdb(`push_tokens/${encodeURIComponent(key)}`, token, { method: 'DELETE' });
          removed.push(dev.label || key);
        }
      }
    }),
  );
  return { sent, removed, devices: Object.keys(devices).length };
}

// ------------------------------------------------------------------ handler
function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.MUSE_API_KEY || !env.FIREBASE_SA) return json({ error: 'endpoint not configured' }, 503);
  const auth = request.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!sameKey(key, env.MUSE_API_KEY)) return json({ error: 'unauthorized' }, 401);

  if (parseInt(request.headers.get('content-length') || '0', 10) > 20_000) return json({ error: 'request too large' }, 413);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }
  const { deal, errors } = validateDeal(body || {});
  if (errors) return json({ error: 'invalid deal', details: errors }, 400);

  const score = scoreDeal(deal);
  if (body.test === true) {
    return json({ ok: true, test: true, stored: false, notified: 0, area: score.area, quality: score.quality, would_buzz: score.hot, reason: score.reason });
  }
  if (score.area === 'outside') {
    return json({ ok: true, skipped: 'outside area (Michigan/US)', stored: false, notified: 0 });
  }

  const savingsPercent = score.savings !== null ? Math.round(score.savings * 100) : 0;
  const appDeal = {
    id: `fb-${deal.listing_id}`,
    listingId: deal.listing_id,
    title: deal.title,
    price: deal.price,
    estimatedValue: deal.estimated_resale ?? null,
    savingsPercent,
    location: deal.location,
    url: deal.url,
    source: 'facebook',
    via: 'muse',
    type: deal.category === 'pc' ? 'full-pc' : 'part',
    quality: score.quality,
    tier: score.hot ? 'insane' : score.quality === 'good' ? 'good' : 'normal',
    matchedKeyword: deal.gpu_model || score.model || deal.ram_spec || (deal.category === 'pc' ? 'Full PC' : deal.category),
    description: deal.notes,
    listedAt: deal.listed_at,
    suspicious: deal.suspicious,
    timestamp: Date.now(),
  };

  try {
    const token = await getAccessToken(env);
    const stored = await storeDeal(appDeal, token);
    if (stored.duplicate) return json({ ok: true, duplicate: true, id: appDeal.id, notified: 0 });
    let push = { sent: 0, removed: [], devices: 0 };
    if (score.hot) push = await notifyPhones(appDeal, score, token);
    return json({ ok: true, id: appDeal.id, quality: score.quality, buzzed: score.hot, notified: push.sent, reason: score.reason }, 201);
  } catch (err) {
    return json({ error: 'upstream failure', detail: String(err.message || err).slice(0, 200) }, 502);
  }
}

export function onRequest() {
  return json({ error: 'method not allowed' }, 405);
}
