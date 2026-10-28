// Regression tests for the 2026-10-27 security audit fixes.
// Run: npm test   (no network: every fetch is stubbed)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeal, onRequestPost as musePost } from '../functions/api/muse-deal.js';
import { onRequestPost as emailPost, onRequestOptions as emailOptions } from '../functions/send-email.js';

const realFetch = globalThis.fetch;
let calls;
beforeEach(() => { calls = []; });
afterEach(() => { globalThis.fetch = realFetch; });

const baseDeal = { listing_id: '123', title: 'RTX 3070', price: 240, category: 'gpu', gpu_model: 'RTX 3070', estimated_resale: 380, location: 'Windsor, ON' };

// ---------------------------------------------------------------- muse-deal: url allowlist
test('validateDeal accepts normal Facebook Marketplace links', () => {
  for (const url of ['https://www.facebook.com/marketplace/item/123/', 'https://m.facebook.com/marketplace/item/123', 'https://facebook.com/marketplace/item/123/']) {
    assert.equal(validateDeal({ ...baseDeal, url }).errors, undefined, url);
  }
});

test('validateDeal rejects link shims, credentials, ports and http', () => {
  for (const url of [
    'https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.example',
    'https://lm.facebook.com/l.php?u=x',
    'https://user:pw@www.facebook.com/marketplace/item/1/',
    'https://www.facebook.com:8443/marketplace/item/1/',
    'http://www.facebook.com/marketplace/item/1/',
    'https://evilfacebook.com/marketplace/item/1/',
    'https://fb.com.evil.example/x',
  ]) {
    assert.ok(validateDeal({ ...baseDeal, url }).errors, url);
  }
});

// ---------------------------------------------------------------- muse-deal: handler
async function rsaPem() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  return `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
}

function museRequest(body) {
  return new Request('https://auritech.ca/api/muse-deal', {
    method: 'POST', headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('muse-deal dedupes on the item number in the link, not listing_id', async () => {
  const env = { MUSE_API_KEY: 'test-key', FIREBASE_SA: JSON.stringify({ client_email: 'sa@test.iam', private_key: await rsaPem() }) };
  let stored;
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
    if (String(url).includes('/deals.json') && init.method === 'PUT') { stored = JSON.parse(init.body); return new Response('{}'); }
    if (String(url).includes('/deals.json')) return new Response('[]', { headers: { ETag: 'e1' } });
    return new Response('{}');
  };
  const res = await musePost({ request: museRequest({ ...baseDeal, listing_id: 'fresh-id-999', url: 'https://www.facebook.com/marketplace/item/555/', price: 500 }), env });
  assert.equal(res.status, 201);
  assert.equal(stored.at(-1).id, 'fb-555');
});

test('muse-deal 502 does not echo internal error details', async () => {
  const env = { MUSE_API_KEY: 'test-key', FIREBASE_SA: '{not json with a secret-looking excerpt' };
  globalThis.fetch = async () => { throw new Error('should not be reached'); };
  const origError = console.error; console.error = () => {};
  try {
    const res = await musePost({ request: museRequest({ ...baseDeal, url: 'https://www.facebook.com/marketplace/item/123/' }), env });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: 'upstream failure' });
  } finally { console.error = origError; }
});

// ---------------------------------------------------------------- send-email
function emailRequest(body, origin = 'https://auritech.ca', ip = '203.0.113.' + Math.floor(Math.random() * 250)) {
  return new Request('https://auritech.ca/send-email', {
    method: 'POST', headers: { Origin: origin, 'cf-connecting-ip': ip, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const env = { RESEND_API_KEY: 'dummy' };

test("send-email rejects inherited template keys like 'constructor'", async () => {
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response('{}'); };
  for (const type of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    const res = await emailPost({ request: emailRequest({ type, name: 'T', email: 't@example.test', subject: 'S', html: 'H' }), env });
    assert.equal(res.status, 400, type);
  }
  assert.equal(calls.length, 0);
});

test('send-email still sends the real form types with the category subject', async () => {
  let sent;
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return new Response('{}'); };
  const res = await emailPost({ request: emailRequest({ type: 'contact', name: 'Test User', phone: '5550000000', message: 'hi' }), env });
  assert.equal(res.status, 200);
  assert.match(sent.subject, /contact/i);
});

test('send-email only trusts this project\'s pages.dev hostnames', async () => {
  globalThis.fetch = async () => new Response('{}');
  const ok = ['https://auritech.pages.dev', 'https://b1ab9ea9.auritech.pages.dev'];
  const bad = ['https://evil.pages.dev', 'https://auritech.pages.dev.evil.example', 'http://abc.auritech.pages.dev', 'https://notauritech.pages.dev'];
  for (const origin of ok) assert.equal((await emailOptions({ request: new Request('https://x/', { method: 'OPTIONS', headers: { Origin: origin } }) })).status, 204, origin);
  for (const origin of bad) assert.equal((await emailOptions({ request: new Request('https://x/', { method: 'OPTIONS', headers: { Origin: origin } }) })).status, 403, origin);
  const res = await emailPost({ request: emailRequest({ type: 'contact', name: 'T', phone: '5550000000' }, 'https://evil.pages.dev'), env });
  assert.equal(res.status, 403);
});
