# Auritech Website — Setup Guide

## Step 1: EmailJS (Free — 5 minutes)

1. Go to https://emailjs.com → Sign up free (no credit card)
2. Add Email Service → Connect Gmail → select AuritechPcs@gmail.com → name it `service_auritech`
3. Create 3 Email Templates:

### Template 1 — Custom Build
- Template ID: `template_custom_build`
- Subject: `🔧 [CUSTOM BUILD] {{name}} — {{budget}} | {{use_case}}`
- Body (paste this HTML):
```html
<div style="background:#111;padding:32px;border-radius:12px;font-family:Inter,sans-serif;max-width:600px;">
  <h2 style="color:#C9A84C;font-family:serif;">🔧 Custom Build Request</h2>
  <span style="background:#7c3aed;color:#fff;padding:4px 12px;border-radius:100px;font-size:12px;">CUSTOM</span>
  <hr style="border-color:#222;margin:24px 0;" />
  <p style="color:#777;font-size:11px;letter-spacing:2px;">CUSTOMER NAME</p>
  <p style="color:#fff;font-size:16px;margin-top:4px;">{{name}}</p>
  <p style="color:#777;font-size:11px;letter-spacing:2px;margin-top:16px;">EMAIL</p>
  <p style="color:#C9A84C;font-size:16px;margin-top:4px;">{{email}}</p>
  <p style="color:#777;font-size:11px;letter-spacing:2px;margin-top:16px;">PHONE</p>
  <p style="color:#fff;font-size:16px;margin-top:4px;">{{phone}}</p>
  <hr style="border-color:#222;margin:24px 0;" />
  <div style="background:#1a1a2e;border-left:3px solid #7c3aed;padding:16px;border-radius:0 8px 8px 0;">
    <p style="color:#7c3aed;font-size:11px;letter-spacing:2px;">CUSTOM BUILD SUMMARY</p>
  </div>
  <p style="color:#777;font-size:11px;letter-spacing:2px;margin-top:16px;">USE CASE</p>
  <p style="color:#fff;margin-top:4px;">{{use_case}}</p>
  <p style="color:#777;font-size:11px;letter-spacing:2px;margin-top:16px;">BUDGET</p>
  <p style="color:#C9A84C;font-size:18px;font-weight:700;margin-top:4px;">{{budget}}</p>
  <p style="color:#777;font-size:11px;letter-spacing:2px;margin-top:16px;">PRIORITIES</p>
  <p style="color:#fff;margin-top:4px;">{{priorities}}</p>
  <div style="background:#1a1a1a;border-left:3px solid #8b7530;padding:16px;border-radius:0 8px 8px 0;margin-top:16px;">
    <p style="color:#777;font-size:11px;letter-spacing:2px;">ADDITIONAL NOTES</p>
    <p style="color:#ccc;margin-top:8px;">{{notes}}</p>
  </div>
  <p style="color:#333;font-size:12px;margin-top:32px;">Auritech Website Inquiry</p>
</div>
```

### Template 2 — Preconfigured Build
- Template ID: `template_preconfigured`
- Subject: `💎 [PRECONFIGURED] {{name}} → {{build_name}} ({{price}})`
- Body: Same style but with fields: name, email, phone, build_name, price, message

### Template 3 — Product Inquiry
- Template ID: `template_product_inquiry`
- Subject: `📦 [PRODUCT INQUIRY] {{name}} → {{product_name}}`
- Body: Same style but with fields: name, email, phone, product_name, price, message

4. Go to Account → Copy your **Public Key**
5. In each page file, replace `YOUR_EMAILJS_PUBLIC_KEY` with your actual key

## Step 2: GitHub Repo (5 minutes)

1. Go to github.com → New repository → name it `auritech-website`
2. In this folder run:
```bash
git init
git add .
git commit -m "feat: initial Auritech website"
git remote add origin https://github.com/YOURUSERNAME/auritech-website.git
git push -u origin main
```

## Step 3: Netlify Deploy (5 minutes)

1. Go to netlify.com → Sign up with GitHub
2. New site from Git → select `auritech-website` repo
3. Build command: `npm run build` | Publish directory: `dist`
4. Deploy!

## Step 4: Custom Domain (auritechpcs.com)

1. Buy `auritechpcs.com` on Namecheap (~$12/year)
2. In Netlify → Domain Settings → Add custom domain → `auritechpcs.com`
3. Update Namecheap DNS to point to Netlify nameservers
4. HTTPS auto-activates within ~24 hours

## Step 5: Inventory App — Go Live Feature

The website already reads from your Firebase DB.
To add Go Live + photo upload to the inventory app, open a new Claude Code session with the inventory app at:
`C:/Users/motas/.openclaw/workspace/auritech/index.html`

And say: "Add photo upload and Go Live button to builds with validation requiring CPU, GPU, RAM, storage + 1 photo minimum"
