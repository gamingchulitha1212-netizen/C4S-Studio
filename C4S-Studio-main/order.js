// Vercel serverless function: receives the "Send a Message" form.
// 1) saves the order (visible in the admin Orders panel), 2) builds an invoice from TRUSTED prices
// (never from the browser), 3) gives it a unique number + lock, 4) emails it to the address in the form.
const crypto = require('crypto');
let fbadminModule, invoiceModule;
try { fbadminModule = require('./fbadmin'); } catch (e) {
  try { fbadminModule = require('../fbadmin'); } catch (e2) {
    try { fbadminModule = require('../lib/fbadmin'); } catch (e3) { fbadminModule = { db: null, ServerValue: null }; }
  }
}
const { db, ServerValue } = fbadminModule;

try { invoiceModule = require('./invoice'); } catch (e) {
  try { invoiceModule = require('../invoice'); } catch (e2) {
    try { invoiceModule = require('../lib/invoice'); } catch (e3) { invoiceModule = {}; }
  }
}
const { toCents, money, invoiceHTML, esc } = invoiceModule;

const DEFAULT_EST = {
  currency: '$', unit: 'Hours', unitOne: 'Hour', perUnit: '5', min: '1', max: '15',
  services: [{ title: 'Photo Session', price: '25' }, { title: 'Video Shoot & Edit', price: '40' }, { title: 'Event Coverage', price: '50' }, { title: 'Wedding Package', price: '75' }, { title: 'Commercial Shoot', price: '100' }],
  addons: [{ title: '4K Video Delivery', price: '20' }, { title: 'Advanced Retouching', price: '15' }, { title: '24H Rush Delivery', price: '25' }, { title: 'Drone Aerial Coverage', price: '15' }]
};
const list = (x) => (Array.isArray(x) ? x : Object.values(x || {})).filter(Boolean);
const norm = (s) => String(s || '').trim().toLowerCase();
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const hits = new Map(); // best-effort per-IP limit (resets when the function restarts)
function tooMany(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 8;
}

async function loadEstimator() {
  const v = (await db.ref('site/estimator').once('value')).val() || {};
  const s = list(v.services), a = list(v.addons);
  return Object.assign({}, DEFAULT_EST, v, { services: s.length ? s : DEFAULT_EST.services, addons: a.length ? a : (v.addons === undefined ? DEFAULT_EST.addons : []) });
}

// Returns { items, currency } or null when the request cannot be priced with certainty.
async function resolveItems(b, order, biz) {
  const est = b.estimate && typeof b.estimate === 'object' ? b.estimate : null;
  if (est) {
    const cfg = await loadEstimator();
    const svc = cfg.services.find((s) => norm(s.title) === norm(est.service));
    if (!svc) return null;
    const min = Math.max(1, parseInt(cfg.min, 10) || 1), max = Math.max(min + 1, parseInt(cfg.max, 10) || 15);
    const units = parseInt(est.units, 10);
    if (!(units >= min && units <= max)) return null;
    const base = toCents(svc.price);
    if (!base) return null;
    const items = [{ description: clean(svc.title, 200), qty: 1, unitCents: base }];
    const per = toCents(cfg.perUnit) || 0;
    if (units > 1 && per > 0) items.push({ description: 'Additional ' + String(cfg.unit || 'units').toLowerCase() + ' of coverage', qty: units - 1, unitCents: per });
    const seen = new Set();
    for (const name of list(est.addons).slice(0, 20)) {
      if (seen.has(norm(name))) continue;
      seen.add(norm(name));
      const ad = cfg.addons.find((x) => norm(x.title) === norm(name));
      const p = ad && toCents(ad.price);
      if (!p) return null;
      items.push({ description: clean(ad.title, 200), qty: 1, unitCents: p });
    }
    return { items, currency: String(cfg.currency || '$').slice(0, 6) };
  }
  const form = (await db.ref('site/form').once('value')).val() || {};
  const opt = list(form.serviceOptions).find((o) => norm(o.title) === norm(order.service));
  const p = opt && opt.price ? toCents(opt.price) : null;
  if (!p) return null;
  return { items: [{ description: clean(opt.title, 200), qty: 1, unitCents: p }], currency: String(biz.currency || '$').slice(0, 6) };
}

// Independent double-check of every number.
function verify(inv) {
  let sum = 0;
  inv.items.forEach((it, i) => {
    if (!(it.qty >= 1) || !(it.unitCents > 0) || it.lineCents !== it.qty * it.unitCents) throw new Error('Item ' + (i + 1) + ' is invalid');
    sum += it.lineCents;
  });
  if (!inv.items.length) throw new Error('No items');
  if (sum !== inv.subtotalCents) throw new Error('Subtotal mismatch');
  if (Math.round((inv.subtotalCents - inv.discountCents) * inv.taxBp / 10000) !== inv.taxCents) throw new Error('Tax mismatch');
  if (inv.subtotalCents - inv.discountCents + inv.taxCents !== inv.totalCents || !(inv.totalCents > 0)) throw new Error('Total mismatch');
}

function transporter() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD).');
  return { user, t: require('nodemailer').createTransport({ service: 'gmail', auth: { user, pass } }) };
}

async function sendMail(inv, biz) {
  const { user, t } = transporter();
  const name = clean(biz.businessName || 'C4S Studio', 80).replace(/["<>\r\n]/g, '');
  await t.sendMail({
    from: '"' + name + '" <' + user + '>', to: inv.customerEmail, replyTo: clean(biz.email || user, 150), subject: 'Invoice ' + inv.number + ' from ' + name,
    text: 'Hello ' + inv.customerName + ',\n\nThank you for contacting ' + name + '. Your invoice ' + inv.number + ' (total ' + money(inv.totalCents, inv.currency) + ') is in this email.\n',
    html: invoiceHTML(inv)
  });
}

// Tells the studio owner about every new order (also when no invoice could be made).
async function notifyAdmin(order, out, extra, req) {
  try {
    const { user, t } = transporter();
    const to = clean(process.env.NOTIFY_EMAIL || 'chulitharv123@gmail.com', 150);
    const site = process.env.SITE_URL || (req.headers.host ? 'https://' + req.headers.host : '');
    const row = (k, v) => v ? '<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">' + esc(k) + '</td><td style="padding:4px 0">' + esc(v) + '</td></tr>' : '';
    const invoiceLine = out.invoiceNumber
      ? 'Invoice ' + out.invoiceNumber + (extra.total ? ' (' + extra.total + ')' : '') + (out.emailed ? ' was emailed to the customer.' : ' was created but the email to the customer failed. Open the Orders panel to resend it.')
      : (extra.note || 'No invoice was created.');
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827">' +
      '<h2 style="margin:0 0 10px">New order from ' + esc(order.name) + '</h2>' +
      '<table style="border-collapse:collapse">' + row('Email', order.email) + row('Phone', order.phone) + row('Service', order.service) + row('Budget', order.budget) + row('Event date', order.eventDate) + row('Source', order.source) + '</table>' +
      '<p style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:6px">' + esc(order.message) + '</p>' +
      '<p><strong>' + esc(invoiceLine) + '</strong></p>' +
      (site ? '<p><a href="' + esc(site) + '/admin-orders.html">Open the Orders panel</a></p>' : '') + '</div>';
    await t.sendMail({ from: '"C4S Studio website" <' + user + '>', to, replyTo: order.email, subject: 'New order: ' + order.name + (order.service ? ' - ' + order.service : ''), html, text: 'New order from ' + order.name + ' (' + order.email + ')\n\n' + order.message + '\n\n' + invoiceLine });
  } catch (e) { console.error('Admin notification failed:', e.message); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!db) return res.status(503).json({ error: 'not_configured' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (clean(b.website, 20)) return res.status(200).json({ ok: true }); // honeypot

  const order = { name: clean(b.name, 100), email: clean(b.email, 150), message: clean(b.message, 3000) };
  if (!order.name || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(order.email) || !order.message) {
    return res.status(400).json({ error: 'Please enter a valid name, email address and message.' });
  }
  [['phone', 40], ['service', 100], ['budget', 60], ['eventDate', 30], ['source', 30]].forEach(([k, n]) => { const v = clean(b[k], n); if (v) order[k] = v; });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a few minutes.' });

  const clientKey = /^[A-Za-z0-9-]{8,64}$/.test(String(b.clientKey || '')) ? b.clientKey : crypto.randomUUID();
  const orderRef = db.ref('orders').push();
  const orderId = orderRef.key;

  // Same form submitted twice (double click / retry) -> same order, no second invoice
  const dup = await db.ref('submissions/' + clientKey).transaction((cur) => (cur === null ? orderId : undefined));
  if (!dup.committed) return res.status(200).json({ ok: true, duplicate: true, orderId: dup.snapshot.val() });

  await orderRef.set(Object.assign({}, order, { status: 'new', createdAt: ServerValue.TIMESTAMP }));
  const out = { ok: true, orderId, invoiceNumber: null, emailed: false };
  const extra = { note: '', total: '' };
  const finish = async () => { await notifyAdmin(order, out, extra, req); return res.status(200).json(out); };

  try {
    const biz = (await db.ref('settings/invoice').once('value')).val() || {};
    const priced = await resolveItems(b, order, biz);
    if (!priced) {
      extra.note = 'No invoice was created automatically because the price could not be matched. Create it from the Orders panel.';
      await orderRef.update({ invoiceNote: extra.note });
      return finish();
    }
    // Max 3 invoice emails per address per hour (stops anyone using the form to spam a third party)
    const rk = crypto.createHash('sha256').update(order.email.toLowerCase()).digest('hex').slice(0, 24);
    const rate = await db.ref('rate/' + rk).transaction((cur) => {
      const now = Date.now();
      return cur && now - cur.t < 3600000 ? { c: cur.c + 1, t: cur.t } : { c: 1, t: now };
    });
    if (rate.snapshot.val().c > 3) {
      extra.note = 'Invoice not sent automatically (too many requests for this email address).';
      await orderRef.update({ invoiceNote: extra.note });
      return finish();
    }

    const items = priced.items.map((it) => ({ description: it.description, qty: it.qty, unitCents: it.unitCents, lineCents: it.qty * it.unitCents }));
    const subtotal = items.reduce((a, it) => a + it.lineCents, 0);
    const taxPct = String(biz.taxPercent || '0').trim();
    const taxBp = /^\d{1,3}(\.\d{1,2})?$/.test(taxPct) && parseFloat(taxPct) <= 100 ? Math.round(parseFloat(taxPct) * 100) : 0;
    const taxCents = Math.round(subtotal * taxBp / 10000);
    const dueDays = /^\d{1,3}$/.test(String(biz.dueDays || '7')) ? parseInt(biz.dueDays || '7', 10) : 7;

    const ctr = await db.ref('invoiceCounter').transaction((c) => (Number(c) || 0) + 1);
    const prefix = String(biz.prefix || 'INV').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase() || 'INV';
    const number = prefix + '-' + new Date().getFullYear() + '-' + String(ctr.snapshot.val()).padStart(4, '0');
    const invRef = db.ref('invoices').push();
    const now = new Date();
    const inv = {
      number, orderId, customerName: order.name, customerEmail: order.email, items, subtotalCents: subtotal, discountCents: 0, taxBp, taxCents,
      totalCents: subtotal + taxCents, currency: priced.currency, issueDate: ymd(now), dueDate: ymd(new Date(now.getTime() + dueDays * 86400000)),
      status: 'issued', emailStatus: 'not_sent', auto: true, createdAt: ServerValue.TIMESTAMP,
      business: { name: clean(biz.businessName || 'C4S Studio', 600), address: clean(biz.address, 600), phone: clean(biz.phone, 600), email: clean(biz.email, 600), payment: clean(biz.payment, 600), footer: clean(biz.footer, 600) }
    };
    if (order.phone) inv.customerPhone = order.phone;
    verify(inv);

    // Locks: one invoice per order, and a number can never be reused
    const lock = await db.ref('orderInvoice/' + orderId).transaction((c) => (c === null ? invRef.key : undefined));
    const idx = await db.ref('invoiceNumbers/' + number).transaction((c) => (c === null ? invRef.key : undefined));
    if (!lock.committed || !idx.committed) throw new Error('Duplicate invoice blocked');
    await invRef.set(inv);
    out.invoiceNumber = number;
    extra.total = money(inv.totalCents, inv.currency);

    try {
      await sendMail(Object.assign({}, inv, { createdAt: Date.now() }), biz);
      await invRef.update({ emailStatus: 'sent', emailSentAt: ServerValue.TIMESTAMP });
      out.emailed = true;
    } catch (e) {
      console.error('Invoice email failed:', e.message);
      await invRef.update({ emailStatus: 'failed', emailError: String(e.message).slice(0, 280) });
    }
  } catch (e) {
    console.error('Auto invoice failed:', e.message);
    extra.note = 'Automatic invoice failed: ' + String(e.message).slice(0, 200);
    try { await orderRef.update({ invoiceNote: extra.note }); } catch (x) {}
  }
  return finish();
};
