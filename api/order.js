// Vercel serverless function: /api/order
// Receives website booking orders, creates invoices, notifies admins, and stores in Firebase + orders-db.json.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let fbadminModule, invoiceModule;
try { fbadminModule = require('../fbadmin'); } catch (e) {
  try { fbadminModule = require('./fbadmin'); } catch (e2) { fbadminModule = { db: null, ServerValue: null }; }
}
const { db, ServerValue } = fbadminModule;

try { invoiceModule = require('../invoice'); } catch (e) {
  try { invoiceModule = require('./invoice'); } catch (e2) { invoiceModule = {}; }
}
const { toCents, money, invoiceHTML, esc } = invoiceModule;

const DB_FILE = path.join(__dirname, '..', 'orders-db.json');

function saveToLocalDb(order, inv) {
  try {
    let local = { orders: [], invoices: [] };
    if (fs.existsSync(DB_FILE)) {
      local = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
      if (!Array.isArray(local.orders)) local.orders = [];
      if (!Array.isArray(local.invoices)) local.invoices = [];
    }
    local.orders.unshift(order);
    if (inv) local.invoices.unshift(inv);
    fs.writeFileSync(DB_FILE, JSON.stringify(local, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not backup order to orders-db.json:', e.message);
  }
}

const DEFAULT_EST = {
  currency: '$', unit: 'Hours', unitOne: 'Hour', perUnit: '5', min: '1', max: '15',
  services: [{ title: 'Photo Session', price: '25' }, { title: 'Video Shoot & Edit', price: '40' }, { title: 'Event Coverage', price: '50' }, { title: 'Wedding Package', price: '75' }, { title: 'Commercial Shoot', price: '100' }],
  addons: [{ title: '4K Video Delivery', price: '20' }, { title: 'Advanced Retouching', price: '15' }, { title: '24H Rush Delivery', price: '25' }, { title: 'Drone Aerial Coverage', price: '15' }]
};
const list = (x) => (Array.isArray(x) ? x : Object.values(x || {})).filter(Boolean);
const norm = (s) => String(s || '').trim().toLowerCase();
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 8;
}

function transporter() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, t: require('nodemailer').createTransport({ service: 'gmail', auth: { user, pass } }) };
}

async function notifyAdmin(order, out, extra, req, inv) {
  try {
    const tr = transporter();
    if (!tr) return;
    const { user, t } = tr;

    const adminList = [clean(process.env.NOTIFY_EMAIL || 'chulitharv123@gmail.com', 150)];
    if (db) {
      try {
        const snap = await db.ref('site/admins').once('value');
        if (snap.exists()) {
          snap.forEach((c) => {
            const v = c.val();
            if (v && v.email) {
              const em = clean(v.email.toLowerCase().trim(), 150);
              if (em && !adminList.includes(em)) adminList.push(em);
            }
          });
        }
      } catch (e) {}
    }

    const to = adminList.join(', ');
    const site = process.env.SITE_URL || (req.headers.host ? 'https://' + req.headers.host : '');
    const row = (k, v) => v ? '<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">' + esc(k) + '</td><td style="padding:4px 0">' + esc(v) + '</td></tr>' : '';
    const invoiceLine = out.invoiceNumber
      ? 'Invoice ' + out.invoiceNumber + (extra.total ? ' (' + extra.total + ')' : '') + (out.emailed ? ' was emailed to the customer.' : ' was created.')
      : (extra.note || 'No invoice was created.');
    const invoiceSection = inv && typeof invoiceHTML === 'function' ? '<div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px"><h3 style="margin:0 0 12px;color:#111827">Order Invoice:</h3>' + invoiceHTML(inv) + '</div>' : '';

    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827">' +
      '<h2 style="margin:0 0 10px">New order from ' + esc(order.name) + '</h2>' +
      '<table style="border-collapse:collapse;margin-bottom:12px">' + row('Email', order.email) + row('Phone', order.phone) + row('Service', order.service) + row('Budget', order.budget) + row('Event date', order.eventDate) + row('Source', order.source) + '</table>' +
      '<p style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:6px">' + esc(order.message) + '</p>' +
      '<p><strong>' + esc(invoiceLine) + '</strong></p>' +
      (site ? '<p><a href="' + esc(site) + '/admin-orders.html" style="display:inline-block;padding:8px 16px;background:#8b5cf6;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Open the Orders panel</a></p>' : '') +
      invoiceSection +
      '</div>';

    await t.sendMail({
      from: '"C4S Studio" <' + user + '>',
      to,
      replyTo: order.email,
      subject: 'New order: ' + order.name + (order.service ? ' - ' + order.service : ''),
      html,
      text: 'New order from ' + order.name + ' (' + order.email + ')\n\n' + order.message + '\n\n' + invoiceLine
    });
  } catch (e) {
    console.warn('Admin notification error:', e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (clean(b.website, 20)) return res.status(200).json({ ok: true }); // honeypot

  const order = { name: clean(b.name, 100), email: clean(b.email, 150), message: clean(b.message, 3000) };
  if (!order.name || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(order.email) || !order.message) {
    return res.status(400).json({ error: 'Please enter a valid name, email address and message.' });
  }
  [['phone', 40], ['service', 100], ['budget', 60], ['eventDate', 30], ['source', 30]].forEach(([k, n]) => {
    const v = clean(b[k], n); if (v) order[k] = v;
  });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a few minutes.' });

  const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const now = new Date();
  const invoiceNumber = 'INV-' + now.getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));

  const orderData = Object.assign({}, order, {
    id: orderId,
    status: 'new',
    createdAt: Date.now()
  });

  // Calculate pricing for invoice
  let lineCents = 5000;
  if (order.budget) {
    const m = /\$?([\d,]+)/.exec(order.budget);
    if (m) lineCents = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) || 5000;
  }

  const inv = {
    id: 'inv-' + orderId,
    number: invoiceNumber,
    orderId: orderId,
    customerName: order.name,
    customerEmail: order.email,
    customerPhone: order.phone || '',
    service: order.service || 'Photography & Videography',
    eventDate: order.eventDate || '',
    items: [{ description: (order.service || 'Studio Session') + ' Booking', qty: 1, unitCents: lineCents, lineCents: lineCents }],
    subtotalCents: lineCents,
    discountCents: 0,
    taxBp: 0,
    taxCents: 0,
    totalCents: lineCents,
    currency: '$',
    issueDate: ymd(now),
    dueDate: ymd(new Date(now.getTime() + 7 * 86400000)),
    status: 'issued',
    createdAt: Date.now(),
    business: {
      name: 'C4S Studio',
      address: 'Colombo, Sri Lanka',
      phone: '+94 7X XXX XXXX',
      email: 'chulitharv123@gmail.com'
    }
  };

  // 1. Save to Firebase RTDB if available
  if (db) {
    try {
      await db.ref('orders/' + orderId).set(Object.assign({}, orderData, {
        createdAt: ServerValue ? ServerValue.TIMESTAMP : Date.now()
      }));
      await db.ref('invoices/' + inv.id).set(inv);
    } catch (e) {
      console.warn('Firebase order push warning:', e.message);
    }
  }

  // 2. Always backup to local orders database
  saveToLocalDb(orderData, inv);

  // 3. Notify Admins
  const out = { ok: true, orderId, invoiceNumber, emailed: false };
  const extra = { note: '', total: '$ ' + (lineCents / 100).toFixed(2) };
  await notifyAdmin(order, out, extra, req, inv);

  return res.status(200).json(out);
};
