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

async function sendCustomerInvoice(order, inv, tr) {
  try {
    if (!tr || !order.email) return false;
    const { user, t } = tr;
    const biz = inv.business || {};
    const studioName = biz.name || biz.businessName || 'C4S Studio';
    const cur = inv.currency || '$';
    const totalFormatted = (typeof money === 'function' ? money(inv.totalCents, cur) : (cur + ' ' + (inv.totalCents / 100).toFixed(2)));

    const html = '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;max-width:700px;margin:0 auto;padding:16px;">' +
      '<div style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e2e8f0;margin-bottom:18px;">' +
      '<h2 style="margin:0 0 8px;color:#7c3aed;font-size:22px;">🎉 Booking Confirmed!</h2>' +
      '<p style="margin:0 0 8px;color:#374151;line-height:1.6;">Dear <strong>' + esc(order.name) + '</strong>,</p>' +
      '<p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">Thank you for choosing <strong>' + esc(studioName) + '</strong>. Your session booking has been successfully confirmed. Below is your official order invoice <strong>' + esc(inv.number) + '</strong> for total <strong>' + esc(totalFormatted) + '</strong>.</p>' +
      '<p style="margin:0;color:#6b7280;font-size:13px;">If you have any questions or require custom adjustments, feel free to reply directly to this email.</p>' +
      '</div>' +
      (typeof invoiceHTML === 'function' ? invoiceHTML(inv) : '') +
      '</div>';

    await t.sendMail({
      from: '"' + studioName + '" <' + user + '>',
      to: order.email,
      replyTo: biz.email || user,
      subject: 'Official Order Invoice ' + inv.number + ' - ' + studioName,
      html,
      text: 'Dear ' + order.name + ',\n\nThank you for choosing ' + studioName + '! Your booking invoice ' + inv.number + ' has been issued.\n\nTotal Due: ' + totalFormatted + '\n\nPlease find your official invoice attached.\n\nBest regards,\n' + studioName
    });
    return true;
  } catch (e) {
    console.warn('Customer invoice email error:', e.message);
    return false;
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
  if (!order.name || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(order.email)) {
    return res.status(400).json({ error: 'Please enter a valid name and email address.' });
  }
  if (!order.message) {
    order.message = (b.service ? (b.service + ' Booking Request') : 'Direct Studio Session Booking');
  }
  [['phone', 40], ['service', 100], ['budget', 60], ['eventDate', 30], ['source', 30]].forEach(([k, n]) => {
    const v = clean(b[k], n); if (v) order[k] = v;
  });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a few minutes.' });

  // Load Owner's Invoice Settings from Firebase if available
  let biz = {
    name: 'C4S Studio',
    address: 'Colombo, Sri Lanka',
    phone: '+94 7X XXX XXXX',
    email: 'chulitharv123@gmail.com',
    currency: 'LKR',
    payment: 'Direct bank transfer, cash, or online payment upon session delivery.',
    footer: 'Thank you for choosing C4S Studio. Visual stories told with passion.',
    dueDays: 7,
    prefix: 'INV'
  };

  if (db) {
    try {
      const bizSnap = await db.ref('settings/invoice').once('value');
      if (bizSnap.exists()) {
        const val = bizSnap.val() || {};
        biz = Object.assign({}, biz, val);
        if (val.businessName) biz.name = val.businessName;
      }
    } catch (e) {}
  }

  const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const now = new Date();
  const prefix = String(biz.prefix || 'INV').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase() || 'INV';
  const invoiceNumber = prefix + '-' + now.getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));

  const orderData = Object.assign({}, order, {
    id: orderId,
    status: 'new',
    createdAt: Date.now()
  });

  // Calculate pricing for invoice
  let lineCents = 5000;
  if (b.price != null && !isNaN(parseFloat(b.price))) {
    lineCents = Math.round(parseFloat(b.price) * 100);
  } else if (b.packagePrice != null && !isNaN(parseFloat(b.packagePrice))) {
    lineCents = Math.round(parseFloat(b.packagePrice) * 100);
  } else if (order.budget) {
    const m = /\$?([\d,]+)/.exec(order.budget);
    if (m) lineCents = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) || 5000;
  }

  const invoiceItems = (Array.isArray(b.items) && b.items.length)
    ? b.items.map(it => ({
        description: clean(it.description || (order.service || 'Studio Session'), 200),
        qty: parseInt(it.qty, 10) || 1,
        unitCents: parseInt(it.unitCents, 10) || lineCents,
        lineCents: (parseInt(it.qty, 10) || 1) * (parseInt(it.unitCents, 10) || lineCents)
      }))
    : [{ description: (order.service || 'Studio Session') + ' Booking', qty: 1, unitCents: lineCents, lineCents: lineCents }];

  const subtotalCents = invoiceItems.reduce((sum, it) => sum + (it.lineCents || 0), 0) || lineCents;
  const currencyUsed = String(b.currency || biz.currency || 'LKR').trim();
  const dueDaysNum = parseInt(biz.dueDays, 10) || 7;

  const inv = {
    id: 'inv-' + orderId,
    number: invoiceNumber,
    orderId: orderId,
    customerName: order.name,
    customerEmail: order.email,
    customerPhone: order.phone || '',
    service: order.service || 'Photography & Videography',
    eventDate: order.eventDate || '',
    items: invoiceItems,
    subtotalCents: subtotalCents,
    discountCents: 0,
    taxBp: 0,
    taxCents: 0,
    totalCents: subtotalCents,
    currency: currencyUsed,
    issueDate: ymd(now),
    dueDate: ymd(new Date(now.getTime() + dueDaysNum * 86400000)),
    status: 'issued',
    emailStatus: 'not_sent',
    createdAt: Date.now(),
    notes: 'Order confirmed. Thank you for choosing ' + biz.name + '! We look forward to capturing your moments.',
    business: biz
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

  // 3. Dispatch Emails (Admin + Customer)
  const out = { ok: true, orderId, invoiceNumber, emailed: false };
  const extra = { note: '', total: currencyUsed + ' ' + (subtotalCents / 100).toFixed(2) };

  const tr = transporter();
  if (tr) {
    // Send to Customer
    const sentCustomer = await sendCustomerInvoice(order, inv, tr);
    if (sentCustomer) {
      out.emailed = true;
      inv.emailStatus = 'sent';
      if (db) {
        try { await db.ref('invoices/' + inv.id + '/emailStatus').set('sent'); } catch (e) {}
      }
    }

    // Send to Admin
    await notifyAdmin(order, out, extra, req, inv);
  }

  return res.status(200).json(out);
};
