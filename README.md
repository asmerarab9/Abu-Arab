# Texan Food Trailers Solution — Full Project

Everything in one place: the website/app (Vite + React) and the 24/7 server
(Firebase Cloud Functions). This README ties it all together.

```
texan-food-trailers/
├── index.html              ← app shell (loads 3D engine + icons)
├── package.json
├── vite.config.js
├── src/
│   ├── App.jsx             ← THE WHOLE APP (public site, tenant portal, admin)
│   └── main.jsx
├── public/                 ← served as-is by Vercel (icons + PWA manifest)
│   ├── favicon.png
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json
└── firebase-functions/     ← the 24/7 server (reminders, backup, Stripe)
    ├── README_SETUP.md     ← step-by-step server + Stripe guide
    └── functions/index.js
```

---

## PART A — Website / App (GitHub → Vercel)

### Push to GitHub
Put the contents of this folder in your repo (keep the structure above).
**Important:** the four PNG icons and `manifest.json` must stay inside `public/`
— Vite only serves static files from there.

### Vercel
Vercel auto-deploys on each GitHub commit. No build settings to change
(framework: Vite, build: `vite build`, output: `dist`).

### What already works after deploy (no extra setup)
- Public website: fleet gallery, 3D viewer, services, contact.
- Tenant Login → tenant portal. Admin PIN: **9003**.
- Rental **applications** → admin **approve** → welcome notice + auto-filled
  **lease** → tenant **e-signs** (ESIGN/UETA audit trail).
- **Accounting** tab (income/expenses, A/R & A/P, per-trailer profit, CSV).
- **Reminders** run when you (admin) open the app. For true 24/7 sending,
  deploy the server (Part B).

### Config values live at the top of `src/App.jsx`
- `firebaseConfig` — your Firebase project keys (already set).
- `EMAILJS_*` — email sending (already set; private key only needed server-side).
- `OWNER_PHONE / OWNER_EMAIL / OWNER_ZELLE` — your contact + Zelle number.
- `STRIPE_CHECKOUT_URL` — paste your Cloud Function URL after Part B (Stripe).
- Admin PIN is in `LoginScreen` (`ADMIN_PIN="9003"`).

---

## PART B — 24/7 Server (Firebase Cloud Functions)

Open `firebase-functions/README_SETUP.md` and follow it. In short:
1. Upgrade Firebase to the **Blaze** plan (free at your size; card required).
2. `npm install -g firebase-tools` → `firebase login`.
3. In `firebase-functions/functions`: `npm install`, then copy `.env.example`
   to `.env` and fill your **EmailJS private key** (+ Stripe keys when ready).
4. `firebase deploy --only functions`.

You get:
- **dailyReminders** — sends rent reminders / late+fee notices / demands by
  email automatically, even when nobody has the app open.
- **nightlyBackup** — nightly snapshot of all data (keeps last 30).
- **createCheckout / stripeWebhook** — card payments that auto-record as paid.

---

## PART C — Stripe (card payments) — optional
Full steps are in `firebase-functions/README_SETUP.md` (the "STRIPE" section).
After you deploy `createCheckout`, paste its URL into `STRIPE_CHECKOUT_URL` in
`src/App.jsx` and redeploy the site. The tenant's **Pay by Card** button then
works, with the fee passed on so you receive the full rent.

---

## Quick test checklist
1. Deploy site to Vercel → open it → splash logo → public page shows.
2. Click **Apply to Rent**, submit a test application.
3. Log in as admin (PIN 9003) → **Tenants → Rental Applications** → Approve.
4. Note the tenant PIN in the approval notice. Log out → **Tenant Login** with
   that phone/email + PIN → **Contract** tab → **Review & Sign**.
5. Back in admin → tenant → **View Signed Lease** (see the audit trail).
6. **Books** tab → add an expense, confirm a payment → see income/net update.
7. Reinstall the PWA on your phone to see the new icon.

## Notes
- The 3D viewer and card payments need the live site (not an offline preview).
- Have an attorney review the lease templates (especially the weekly variant)
  before relying on them.
