# Texan Food Trailers Solution — 24/7 Server Setup
### Cloud Functions (auto reminders + escalation) + Nightly Backup

This runs on Google's servers, so reminders and backups happen **even when no
one has the app open**. One-time setup, ~20–30 minutes.

---

## What you are installing
- **dailyReminders** — every day at 9:00 AM (Central) checks every active tenant
  and emails rent reminders → late notices → a formal Demand at 14 days overdue.
  Sends each stage once. Also drops an in-app notification for you and the tenant.
- **nightlyBackup** — every night at 2:00 AM copies the whole database into a
  `backups/` collection and keeps the most recent 30 snapshots.

---

## STEP 1 — Upgrade Firebase to the Blaze plan (required)
Cloud Functions need the **Blaze** (pay-as-you-go) plan. It has a large free
monthly allowance — at your size you will almost certainly pay **$0**, but a
card is required on file.

1. Go to https://console.firebase.google.com → your project **abu-arab-trailers**.
2. Bottom-left, click the plan name → **Modify plan** → choose **Blaze**.
3. Add a billing account. (Optional but smart: set a **budget alert** at $5 so
   Google emails you if anything ever exceeds it.)

## STEP 2 — Install the tools (on your computer, one time)
Install Node.js 20 from https://nodejs.org if you don't have it. Then in a
terminal:

```bash
npm install -g firebase-tools
firebase login
```

A browser opens — log in with the Google account that owns the project.

## STEP 3 — Put these files on your computer
Download this `firebase-functions` folder. Open a terminal **inside** it:

```bash
cd firebase-functions
cd functions
npm install
cd ..
```

## STEP 4 — Add your EmailJS private key
Server-side email needs the EmailJS **private key**.

1. Go to https://dashboard.emailjs.com → **Account** → **General / API Keys**.
2. Copy the **Private Key**.
3. In EmailJS → **Account** → **Security**, make sure **"Allow EmailJS API for
   non-browser applications"** is turned **ON** (otherwise the server is blocked).
4. In the `functions` folder, copy `.env.example` to `.env` and paste your key:

```bash
cd functions
cp .env.example .env
# open .env and set EMAILJS_PRIVATE_KEY=your_real_private_key
cd ..
```

> `.env` holds a secret — do **not** commit it to GitHub. (A `.gitignore` is
> included that already excludes it.)

## STEP 5 — Deploy
```bash
firebase deploy --only functions
```

When it finishes you'll see `dailyReminders` and `nightlyBackup` listed. Done —
they now run automatically forever.

---

## How to verify it works
- Firebase Console → **Functions** → you should see both functions.
- Click **dailyReminders** → **"Run now"** (or Logs) to test immediately without
  waiting for 9 AM. Check that a test tenant with an email + unpaid month gets
  an email and an in-app notification appears.
- Firebase Console → **Firestore** → a `backups/` collection appears after the
  first nightly run (or trigger it manually the same way).

## How to restore from a backup (if something goes wrong)
1. Firestore → `backups/` → open the snapshot you want (named by date/time).
2. Copy its `value` field.
3. Paste it into `kv/abus_db_v2` → `value`, and save.
The app reloads from there within a few seconds.

## Changing the schedule or wording later
Edit `functions/index.js`:
- Times: the `schedule:` lines (e.g. `"every day 09:00"`).
- Stages/days: the `REMINDER_STAGES` array.
- Email text: the `reminderMessage()` function.
Then run `firebase deploy --only functions` again.

---

## STRIPE — card payments (optional, do this when ready)
Lets tenants pay by debit/credit card. The fee is passed to the tenant (grossed
up) so you receive the **full rent**. When a card payment succeeds, Stripe calls
`stripeWebhook` and the payment is marked **paid automatically** — no tap needed.

### S1. Create a Stripe account
1. Go to https://stripe.com → Sign up. Add your business info and bank account
   (this is where payouts land). Verify your identity. ~15–20 min.
2. Dashboard → **Developers → API keys** → copy the **Secret key** (`sk_live_…`).
   (Use the **test** key `sk_test_…` first to try it safely.)

### S2. Put the keys in functions/.env
```
STRIPE_SECRET_KEY=sk_live_or_test_xxx
PUBLIC_SITE_URL=https://your-vercel-site.vercel.app
```
Deploy once so the checkout function goes live:
```bash
firebase deploy --only functions:createCheckout
```
After deploy, the console shows the function URL, e.g.
`https://us-central1-abu-arab-trailers.cloudfunctions.net/createCheckout`.

### S3. Tell the app where checkout lives
In the app's `src/App.jsx`, set:
```js
const STRIPE_CHECKOUT_URL = "https://us-central1-abu-arab-trailers.cloudfunctions.net/createCheckout";
```
Commit/redeploy the site. The tenant's **Pay by Card** button now works.

### S4. Set up the webhook (auto-confirm)
1. Deploy the webhook: `firebase deploy --only functions:stripeWebhook` and copy
   its URL.
2. Stripe Dashboard → **Developers → Webhooks → Add endpoint** → paste that URL →
   select event **`checkout.session.completed`** → Add.
3. Copy the endpoint's **Signing secret** (`whsec_…`) into `functions/.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
4. Redeploy: `firebase deploy --only functions:stripeWebhook`.

Now: tenant pays by card → Stripe charges the grossed-up total → webhook records
the payment as paid → it appears in Accounting and stops reminders. Fully automatic.

> Note on fees: card **surcharging on debit cards** is restricted by card-network
> rules. The app labels the added amount a **"processing fee"**, which is the
> common compliant framing. Credit-card surcharging is allowed in Texas. If you
> prefer, you can absorb the fee yourself by setting the app's `STRIPE_PCT`/fee
> display to 0 — your choice.

---

## Cost & safety notes
- Two tiny daily runs ≈ well within the free allowance → effectively $0.
- The function uses the **same database document** as the app, so the app and
  the server never fall out of sync.
- Reminders are **deduped** (a `reminderLog` on each tenant), so even if a run
  repeats, no tenant is emailed twice for the same stage.
- This automates the busywork. Big decisions (filing a case, eviction) still
  stay in your hands — by design.
