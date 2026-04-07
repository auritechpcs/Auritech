const nodemailer = require('nodemailer');

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
        <div style="background:#1a1a2e;border-left:3px solid #7c3aed;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
          <p style="color:#a78bfa;font-size:11px;letter-spacing:2px;margin:0 0 4px;">CUSTOM BUILD SUMMARY</p>
        </div>
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
        <span style="background:#C9A84C;color:#000;padding:4px 14px;border-radius:100px;font-size:11px;letter-spacing:2px;font-weight:700;">PARTNER</span>
        <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">CUSTOMER NAME</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px;">${p.name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">EMAIL</p>
        <p style="color:#C9A84C;font-size:16px;margin:0 0 16px;">${p.email}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PHONE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.phone || 'Not provided'}</p>
        <div style="background:#1a1a0a;border-left:3px solid #C9A84C;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
          <p style="color:#C9A84C;font-size:11px;letter-spacing:2px;margin:0 0 4px;">PRECONFIGURED BUILD</p>
        </div>
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
        <span style="background:#3b82f6;color:#fff;padding:4px 14px;border-radius:100px;font-size:11px;letter-spacing:2px;">PRODUCT</span>
        <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">CUSTOMER NAME</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px;">${p.name}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">EMAIL</p>
        <p style="color:#C9A84C;font-size:16px;margin:0 0 16px;">${p.email}</p>
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin-bottom:4px;">PHONE</p>
        <p style="color:#fff;font-size:16px;margin:0 0 24px;">${p.phone || 'Not provided'}</p>
        <div style="background:#0a1a2a;border-left:3px solid #3b82f6;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
          <p style="color:#60a5fa;font-size:11px;letter-spacing:2px;margin:0 0 4px;">PRODUCT INQUIRY</p>
        </div>
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { type, ...params } = body;

    if (!templates[type]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email type' }) };
    }

    const { subject, html } = templates[type](params);

    await transporter.sendMail({
      from: `"Auritech Website" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: params.email,
      subject,
      html,
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Email error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
