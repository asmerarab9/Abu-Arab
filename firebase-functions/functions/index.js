/**
 * Texan Food Trailers Solution — server-side automation (runs 24/7 on Google's
 * infrastructure, independently of whether anyone has the app open).
 *
 *  1) dailyReminders  — every day, checks each active tenant and sends rent
 *                       reminders / late notices / formal demands by email,
 *                       writing an in-app notification and a dedup log so each
 *                       stage is only ever sent once per cycle.
 *  2) nightlyBackup   — every night, copies the whole database document into a
 *                       `backups/` collection (keeps the most recent 30), so a
 *                       bad edit or data loss can always be rolled back.
 *
 * Data model: the app keeps the entire database as ONE JSON string in the
 * Firestore document  kv/abus_db_v2  (field `value`). These functions read,
 * update, and write that same document, so the server and the app stay in sync.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import Stripe from "stripe";

initializeApp();
const db = getFirestore();

// ── Stripe config (fill via functions/.env — see SETUP) ──────────────────────
const STRIPE_SECRET_KEY     = defineString("STRIPE_SECRET_KEY",     { default: "" }); // sk_live_... or sk_test_...
const STRIPE_WEBHOOK_SECRET = defineString("STRIPE_WEBHOOK_SECRET", { default: "" }); // whsec_...
const PUBLIC_SITE_URL       = defineString("PUBLIC_SITE_URL",       { default: "https://example.com" }); // your Vercel site URL

// ── EmailJS config (set with: firebase functions:config is NOT used in v2;
//    these are deploy-time params — see SETUP guide). The PRIVATE key is
//    required for server-side sends. ───────────────────────────────────────
const EMAILJS_SERVICE_ID  = defineString("EMAILJS_SERVICE_ID",  { default: "service_6f09dtj" });
const EMAILJS_TEMPLATE_ID = defineString("EMAILJS_TEMPLATE_ID", { default: "template_a00rod7" });
const EMAILJS_PUBLIC_KEY  = defineString("EMAILJS_PUBLIC_KEY",  { default: "q4ojSHPXyAjOJLkx4" });
const EMAILJS_PRIVATE_KEY = defineString("EMAILJS_PRIVATE_KEY",  { default: "" }); // REQUIRED — get it from EmailJS → Account → API Keys

const DB_KEY = "abus_db_v2";
const BRAND = "Texan Food Trailers Solution";
const OWNER_ZELLE = "737-888-9096";
const CURE_DAYS = 10;
const BACKUPS_TO_KEEP = 30;

const REMINDER_STAGES = [
  { id: "upcoming", threshold: -2, label: "Upcoming rent reminder" },
  { id: "due",      threshold: 0,  label: "Rent due today" },
  { id: "late",     threshold: 5,  label: "Late notice + late fee (5 days)" },
  { id: "demand",   threshold: 14, label: "Formal demand (14 days)" },
];

// ── helpers ────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const fmt$ = (n) => "$" + Number(n || 0).toLocaleString();

function parseYMD(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtDateObj(d) {
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";
}
function daysDiff(a, b) { return Math.round((a - b) / 86400000); }

function currentDueDate(tenant, ref) {
  const start = parseYMD(tenant.startDate);
  const dueDay = start ? start.getDate() : 1;
  return new Date(ref.getFullYear(), ref.getMonth(), Math.min(dueDay, 28));
}
function isPaidForMonth(database, tenantId, dueDate) {
  const ym = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
  return (database.payments || []).some(
    (p) => p.tenantId === tenantId && p.status === "paid" && (p.date || "").slice(0, 7) === ym
  );
}
function currentStage(diff) {
  if (diff < -2) return null;
  let chosen = null;
  for (const st of REMINDER_STAGES) if (diff >= st.threshold) chosen = st;
  if (!chosen && diff >= -2) chosen = REMINDER_STAGES[0];
  return chosen;
}
function reminderMessage(stage, { name, amount, trailerName, dueStr, overdue, lateFee }) {
  const amt = fmt$(amount);
  const fee = Number(lateFee) || 0;
  const totalDue = (Number(amount) || 0) + fee;
  switch (stage) {
    case "upcoming": return `Dear ${name},\n\nThis is a friendly reminder that your rent of ${amt} for ${trailerName} is due on ${dueStr}. Please make your payment on time via Zelle to ${OWNER_ZELLE}.\n\nThank you,\n${BRAND}`;
    case "due":      return `Dear ${name},\n\nYour rent of ${amt} for ${trailerName} is due today (${dueStr}). Please submit your payment via Zelle to ${OWNER_ZELLE} to keep your account current.\n\nThank you,\n${BRAND}`;
    case "late":     return `LATE RENT NOTICE\n\nDear ${name},\n\nOur records show your rent of ${amt} for ${trailerName}, due ${dueStr}, is now ${overdue} days past due.`
      + (fee > 0
        ? ` Under the terms of your lease, a late fee of ${fmt$(fee)} now applies, bringing the total amount due to ${fmt$(totalDue)}.`
        : ` Please bring your account current as soon as possible.`)
      + ` Please submit payment via Zelle to ${OWNER_ZELLE} without further delay to avoid additional action.\n\n${BRAND}`;
    case "demand":   return `NOTICE OF DEFAULT & DEMAND FOR PAYMENT\n\nDear ${name},\n\nYour rent of ${amt} for ${trailerName} is now ${overdue} days overdue (originally due ${dueStr})`
      + (fee > 0 ? `, plus a late fee of ${fmt$(fee)} (total ${fmt$(totalDue)})` : ``)
      + `. This is a formal demand that the full balance be paid within ${CURE_DAYS} days of this notice.\n\nIf payment is not received within that period, we may pursue all available remedies, including recovery of the trailer and filing a claim in the Justice Court for the amount owed plus costs.\n\n${BRAND}`;
    default: return "";
  }
}

async function sendEmail(toEmail, toName, subject, message) {
  const priv = EMAILJS_PRIVATE_KEY.value();
  if (!toEmail) return;
  if (!priv) { logger.warn("EMAILJS_PRIVATE_KEY not set — skipping email to " + toEmail); return; }
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID.value(),
        template_id: EMAILJS_TEMPLATE_ID.value(),
        user_id: EMAILJS_PUBLIC_KEY.value(),
        accessToken: priv, // private key — required for server-side sends
        template_params: { to_email: toEmail, to_name: toName || "", subject, message },
      }),
    });
    if (!res.ok) logger.error("EmailJS failed", res.status, await res.text());
  } catch (err) { logger.error("Email send error", err); }
}

async function loadDB() {
  const snap = await db.doc(`kv/${DB_KEY}`).get();
  if (!snap.exists) return null;
  const raw = snap.data()?.value;
  try { return JSON.parse(raw); } catch { return null; }
}
async function saveDB(database) {
  await db.doc(`kv/${DB_KEY}`).set({ value: JSON.stringify(database), updatedAt: Date.now() });
}

// ── 1) Daily reminders / escalation ─────────────────────────────────────────
export const dailyReminders = onSchedule(
  { schedule: "every day 09:00", timeZone: "America/Chicago", region: "us-central1" },
  async () => {
    const database = await loadDB();
    if (!database) { logger.warn("No database document found"); return; }

    const ref = new Date(); ref.setHours(0, 0, 0, 0);
    const trailerName = (id) => ((database.trailers || []).find((x) => x.id === id) || {}).name || "your trailer";
    const sent = [];

    for (const t of database.tenants || []) {
      if (!t.trailerId || !t.monthlyRate) continue;
      const due = currentDueDate(t, ref);
      if (isPaidForMonth(database, t.id, due)) continue;
      const diff = daysDiff(ref, due);
      const st = currentStage(diff);
      if (!st) continue;
      const ym = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
      const key = `${ym}:${st.id}`;
      if ((t.reminderLog || []).some((x) => x.key === key)) continue;

      const body = reminderMessage(st.id, {
        name: t.name, amount: t.monthlyRate, trailerName: trailerName(t.trailerId),
        dueStr: fmtDateObj(due), overdue: diff, lateFee: t.lateFee,
      });
      const subject = st.id === "demand" ? `Notice of Default — ${BRAND}`
        : st.id === "late" ? `Late Rent Notice — ${BRAND}`
        : `Rent Reminder — ${BRAND}`;

      if (t.email) await sendEmail(t.email, t.name, subject, body);

      t.reminderLog = [...(t.reminderLog || []), { key, date: todayStr() }];
      database.notifications = [
        ...(database.notifications || []),
        { id: "N" + uid(), forRole: "admin", title: "Reminder Sent (auto)", body: `${st.label} sent to ${t.name}.`, date: todayStr(), read: false },
        { id: "N" + uid(), forRole: "tenant", forTenantId: t.id, title: st.id === "demand" ? "Notice of Default" : st.id === "late" ? "Late Rent Notice" : "Rent Reminder", body, date: todayStr(), read: false },
      ];
      sent.push(`${t.name}:${st.id}`);
    }

    if (sent.length) { await saveDB(database); logger.info("Reminders sent:", sent); }
    else logger.info("No reminders due today.");
  }
);

// ── 2) Nightly backup ────────────────────────────────────────────────────────
export const nightlyBackup = onSchedule(
  { schedule: "every day 02:00", timeZone: "America/Chicago", region: "us-central1" },
  async () => {
    const snap = await db.doc(`kv/${DB_KEY}`).get();
    if (!snap.exists) { logger.warn("Nothing to back up"); return; }
    const value = snap.data()?.value || "{}";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await db.doc(`backups/${stamp}`).set({ value, createdAt: Date.now(), source: DB_KEY });

    // Retention: keep only the most recent BACKUPS_TO_KEEP
    const old = await db.collection("backups").orderBy("createdAt", "desc").offset(BACKUPS_TO_KEEP).get();
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    if (!old.empty) await batch.commit();
    logger.info(`Backup saved: ${stamp} (pruned ${old.size} old)`);
  }
);

// ── 3) Stripe: create a Checkout Session ─────────────────────────────────────
// The tenant app POSTs { amountCents, net, tenantId, tenantName, note, paymentId }.
// We return { url } and the app redirects the tenant to Stripe's secure page.
export const createCheckout = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    try {
      if (req.method !== "POST") { res.status(405).send("POST only"); return; }
      const key = STRIPE_SECRET_KEY.value();
      if (!key) { res.status(500).json({ error: "Stripe not configured" }); return; }
      const stripe = new Stripe(key);
      const { amountCents, net, tenantId, tenantName, note, paymentId } = req.body || {};
      if (!amountCents || amountCents < 50) { res.status(400).json({ error: "bad amount" }); return; }

      const site = PUBLIC_SITE_URL.value();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amountCents),
            product_data: { name: `${note || "Rent payment"} — ${BRAND}` },
          },
        }],
        // Stripe keeps its fee out of this; the grossed-up total means you net `net`.
        metadata: { tenantId: tenantId || "", tenantName: tenantName || "", note: note || "", paymentId: paymentId || "", net: String(net || "") },
        success_url: `${site}/?paid=1`,
        cancel_url: `${site}/?canceled=1`,
      });
      res.json({ url: session.url });
    } catch (err) {
      logger.error("createCheckout error", err);
      res.status(500).json({ error: "server error" });
    }
  }
);

// ── 4) Stripe webhook: mark the payment paid automatically ───────────────────
// Point your Stripe webhook (checkout.session.completed) at this function's URL.
export const stripeWebhook = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    const key = STRIPE_SECRET_KEY.value();
    const whsec = STRIPE_WEBHOOK_SECRET.value();
    if (!key || !whsec) { res.status(500).send("Stripe not configured"); return; }
    const stripe = new Stripe(key);
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], whsec);
    } catch (err) {
      logger.error("Webhook signature failed", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const sdata = event.data.object;
      const m = sdata.metadata || {};
      const net = Number(m.net) || (sdata.amount_total ? sdata.amount_total / 100 : 0);
      const database = await loadDB();
      if (database) {
        database.payments = database.payments || [];
        // If this corresponds to a pending payment row, mark it paid; else add one.
        let row = m.paymentId ? database.payments.find((p) => p.id === m.paymentId) : null;
        if (row) {
          row.status = "paid"; row.method = "Card (Stripe)"; row.date = todayStr();
        } else {
          database.payments.push({
            id: "P" + uid(), tenantId: m.tenantId || "", amount: net, date: todayStr(),
            method: "Card (Stripe)", status: "paid", note: m.note || "Card payment",
          });
        }
        database.notifications = [
          ...(database.notifications || []),
          { id: "N" + uid(), forRole: "admin", title: "Card Payment Received", body: `${m.tenantName || "A tenant"} paid ${fmt$(net)} by card (Stripe). Recorded automatically.`, date: todayStr(), read: false },
        ];
        await saveDB(database);
        logger.info("Stripe payment recorded", m.tenantName, net);
      }
    }
    res.json({ received: true });
  }
);
