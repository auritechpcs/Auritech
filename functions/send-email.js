// Cloudflare Pages Function — replaces Netlify Function
// Uses Resend API (free: 3000 emails/month)

const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;
const rateMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

function sanitize(str, max = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, max);
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const templates = {
  custom_build: (p) => ({
    subject: `[CUSTOM BUILD] ${p.name} — ${p.budget} | ${p.use_case}`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">Custom Build Request</h2>
        <span style="background:#7c3aed;color:#fff;padding:4px 14px;border-radius:100px;font-size:11px;letter-spacing:2px;">CUSTOM</span>
        <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">CUSTOMER NAME</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px;">${p.name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">EMAIL</p>
        <p style="color:#C9A84C;font-size:16px;margin:0 0 16px;">${p.email}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PHONE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.phone || 'Not provided'}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">USE CASE</p>
        <p style="color:#fff;margin:0 0 16px;">${p.use_case}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">BUDGET</p>
        <p style="color:#C9A84C;font-size:20px;font-weight:700;margin:0 0 16px;">${p.budget}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PRIORITIES</p>
        <p style="color:#fff;margin:0 0 16px;">${p.priorities}</p>
        <div style="background:#1a1a1a;border-left:3px solid #8b7530;padding:16px;border-radius:0 8px 8px 0;">
          <p style="color:#666;font-size:11px;letter-spacing:2px;margin:0 0 8px;">ADDITIONAL NOTES</p>
          <p style="color:#ccc;margin:0;">${p.notes}</p>
        </div>
        <p style="color:#333;font-size:11px;margin-top:32px;">Auritech Website · auritechpcs.com</p>
      </div>`,
  }),

  preconfigured: (p) => ({
    subject: `[PRECONFIGURED] ${p.name} → ${p.build_name} (${p.price})`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">Preconfigured Build Inquiry</h2>
        <span style="background:#C9A84C;color:#000;padding:4px 14px;border-radius:100px;font-size:11px;letter-spacing:2px;font-weight:700;">PRECONFIGURED</span>
        <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">CUSTOMER NAME</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px;">${p.name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">EMAIL</p>
        <p style="color:#C9A84C;font-size:16px;margin:0 0 16px;">${p.email}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PHONE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.phone || 'Not provided'}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">BUILD</p>
        <p style="color:#C9A84C;font-size:18px;font-weight:700;margin:0 0 16px;">${p.build_name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PRICE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.price}</p>
        <div style="background:#1a1a1a;border-left:3px solid #8b7530;padding:16px;border-radius:0 8px 8px 0;">
          <p style="color:#666;font-size:11px;letter-spacing:2px;margin:0 0 8px;">MESSAGE</p>
          <p style="color:#ccc;margin:0;">${p.message || 'No message provided'}</p>
        </div>
        <p style="color:#333;font-size:11px;margin-top:32px;">Auritech Website · auritechpcs.com</p>
      </div>`,
  }),

  product_inquiry: (p) => ({
    subject: `[PRODUCT INQUIRY] ${p.name} → ${p.product_name}`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">Product Inquiry</h2>
        <span style="background:#3b82f6;color:#fff;padding:4px 14px;border-radius:100px;font-size:11px;letter-spacing:2px;">INQUIRY</span>
        <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">CUSTOMER NAME</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px;">${p.name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">EMAIL</p>
        <p style="color:#C9A84C;font-size:16px;margin:0 0 16px;">${p.email}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PHONE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.phone || 'Not provided'}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">INTERESTED IN</p>
        <p style="color:#C9A84C;font-size:18px;font-weight:700;margin:0 0 24px;">${p.product_name}</p>
        <div style="background:#1a1a1a;border-left:3px solid #8b7530;padding:16px;border-radius:0 8px 8px 0;">
          <p style="color:#666;font-size:11px;letter-spacing:2px;margin:0 0 8px;">MESSAGE</p>
          <p style="color:#ccc;margin:0;">${p.message || 'No message provided'}</p>
        </div>
        <p style="color:#333;font-size:11px;margin-top:32px;">Auritech Website · auritechpcs.com</p>
      </div>`,
  }),

  contact: (p) => ({
    subject: `[CONTACT] ${p.name} — ${p.subject_line || 'General Inquiry'}`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">Contact Form</h2>
        <span style="background:#10b981;color:#fff;padding:4px 14px;border-radius:100px;font-size:11px;letter-spacing:2px;">CONTACT</span>
        <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">FROM</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px;">${p.name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">EMAIL</p>
        <p style="color:#C9A84C;font-size:16px;margin:0 0 16px;">${p.email}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PHONE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.phone || 'Not provided'}</p>
        <div style="background:#1a1a1a;border-left:3px solid #8b7530;padding:16px;border-radius:0 8px 8px 0;">
          <p style="color:#666;font-size:11px;letter-spacing:2px;margin:0 0 8px;">MESSAGE</p>
          <p style="color:#ccc;margin:0;">${p.message}</p>
        </div>
        <p style="color:#333;font-size:11px;margin-top:32px;">Auritech Website · auritechpcs.com</p>
      </div>`,
  }),
};

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const allowed = ['https://auritechpcs.com', 'https://www.auritechpcs.com'];
  // Allow Cloudflare Pages preview URLs too
  if (!allowed.some(o => origin.startsWith(o)) && !origin.includes('.pages.dev')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again in a minute.' }), { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { type, honeypot, ...params } = body;

  if (honeypot) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (!templates[type]) {
    return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 });
  }

  if (!params.name || !params.email) {
    return new Response(JSON.stringify({ error: 'Name and email required' }), { status: 400 });
  }
  if (!isValidEmail(params.email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400 });
  }

  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    clean[k] = sanitize(String(v ?? ''));
  }

  const { subject, html } = templates[type](clean);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Auritech Website <onboarding@resend.dev>',
        to: ['AuritechPcs@gmail.com'],
        reply_to: clean.email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Email error:', err);
    return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
  }
}
