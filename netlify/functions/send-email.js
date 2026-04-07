const nodemailer = require('nodemailer');

// ── Rate limiting (in-memory, per function instance) ──────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 5;        // max requests
const RATE_WINDOW = 60000;   // per 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

// ── Input sanitization ────────────────────────────────────────────────────────
function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const templates = {
  custom_build: (p) => ({
    subject: `🔧 [CUSTOM BUILD] ${p.name} — ${p.budget} | ${p.use_case}`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">🔧 Custom Build Request</h2>
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
    subject: `💎 [PRECONFIGURED] ${p.name} → ${p.build_name} (${p.price})`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">💎 Preconfigured Build Inquiry</h2>
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
    subject: `📦 [PRODUCT INQUIRY] ${p.name} → ${p.product_name}`,
    html: `
      <div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
        <h2 style="color:#C9A84C;font-family:serif;margin-bottom:8px;">📦 Product Inquiry</h2>
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
};

exports.handler = async (event) => {
  // ── Method check ────────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // ── Origin check — only allow requests from the Auritech domain ─────────────
  const origin = event.headers.origin || event.headers.referer || '';
  const allowed = ['https://auritechpcs.com', 'https://www.auritechpcs.com', 'https://auritech.netlify.app'];
  if (!allowed.some(o => origin.startsWith(o))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = event.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests. Try again in a minute.' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { type, honeypot, ...params } = body;

    // ── Honeypot — bots fill hidden fields, humans don't ────────────────────────
    if (honeypot) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) }; // silently ignore
    }

    // ── Validate type ────────────────────────────────────────────────────────────
    if (!templates[type]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid type' }) };
    }

    // ── Validate required fields ─────────────────────────────────────────────────
    if (!params.name || !params.email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Name and email required' }) };
    }
    if (!isValidEmail(params.email)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email address' }) };
    }

    // ── Sanitize all string fields ───────────────────────────────────────────────
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      clean[k] = sanitize(String(v ?? ''));
    }

    const { subject, html } = templates[type](clean);

    await transporter.sendMail({
      from: `"Auritech Website" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: clean.email,
      subject,
      html,
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Email error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
