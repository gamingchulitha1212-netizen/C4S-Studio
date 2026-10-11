// Serverless backend function: /api/orders
// Serves orders to the admin Order Panel and supports status updates and deletion.
// Reads from both Firebase Admin (if configured) and orders-db.json (fallback).

const fs = require('fs');
const path = require('path');

let fbadminModule;
try { fbadminModule = require('../fbadmin'); } catch (e) {
  try { fbadminModule = require('./fbadmin'); } catch (e2) { fbadminModule = { db: null }; }
}
const { db } = fbadminModule;

let invoiceModule;
try { invoiceModule = require('../invoice'); } catch (e) {
  try { invoiceModule = require('./invoice'); } catch (e2) { invoiceModule = {}; }
}
const { toCents, money, invoiceHTML, esc } = invoiceModule;

function transporter() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  try {
    return { user, t: require('nodemailer').createTransport({ service: 'gmail', auth: { user, pass } }) };
  } catch (e) { return null; }
}

async function sendInvoiceToCustomer(inv, targetEmail) {
  const tr = transporter();
  if (!tr) return { ok: false, error: 'Email service credentials not configured' };
  const { user, t } = tr;
  const to = targetEmail || inv.customerEmail;
  if (!to) return { ok: false, error: 'No customer email specified' };

  const studioName = (inv.business && (inv.business.name || inv.business.businessName)) || 'C4S Studio';
  const cur = inv.currency || '$';
  const totalFormatted = (typeof money === 'function' ? money(inv.totalCents, cur) : (cur + ' ' + (inv.totalCents / 100).toFixed(2)));

  const html = '<div style="font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;max-width:700px;margin:0 auto;padding:16px;">' +
    '<div style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e2e8f0;margin-bottom:18px;">' +
    '<h2 style="margin:0 0 8px;color:#7c3aed;font-size:22px;">🎉 Official Invoice ' + (inv.number || '') + '</h2>' +
    '<p style="margin:0 0 8px;color:#374151;line-height:1.6;">Dear <strong>' + (esc(inv.customerName) || 'Valued Client') + '</strong>,</p>' +
    '<p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">Your booking invoice from <strong>' + esc(studioName) + '</strong> has been prepared. Total due is <strong>' + esc(totalFormatted) + '</strong>.</p>' +
    '<p style="margin:0;color:#6b7280;font-size:13px;">Please find your full official itemized breakdown below.</p>' +
    '</div>' +
    (typeof invoiceHTML === 'function' ? invoiceHTML(inv) : '') +
    '</div>';

  await t.sendMail({
    from: '"' + studioName + '" <' + user + '>',
    to,
    replyTo: (inv.business && inv.business.email) || user,
    subject: 'Official Invoice ' + (inv.number || '') + ' - ' + studioName,
    html,
    text: 'Dear ' + (inv.customerName || 'Client') + ',\n\nYour invoice ' + (inv.number || '') + ' from ' + studioName + ' is attached.\nTotal: ' + totalFormatted
  });
  return { ok: true };
}

const DB_FILE = path.join(__dirname, '..', 'orders-db.json');

function readLocalDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read orders-db.json:', e.message);
  }
  return { orders: [], invoices: [] };
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.warn('Could not write orders-db.json:', e.message);
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. GET: Fetch all orders and invoices for the Order Panel
  if (req.method === 'GET') {
    const local = readLocalDb();
    let ordersList = Array.isArray(local.orders) ? [...local.orders] : [];
    let invoicesList = Array.isArray(local.invoices) ? [...local.invoices] : [];

    // Also fetch from Firebase RTDB if available
    if (db) {
      try {
        const orderSnap = await db.ref('orders').once('value');
        if (orderSnap.exists()) {
          const map = new Map();
          ordersList.forEach((o) => map.set(o.id, o));
          orderSnap.forEach((c) => {
            map.set(c.key, { id: c.key, ...c.val() });
          });
          ordersList = Array.from(map.values());
        }

        const invSnap = await db.ref('invoices').once('value');
        if (invSnap.exists()) {
          const invMap = new Map();
          invoicesList.forEach((i) => invMap.set(i.id || i.number, i));
          invSnap.forEach((c) => {
            invMap.set(c.key, { id: c.key, ...c.val() });
          });
          invoicesList = Array.from(invMap.values());
        }
      } catch (err) {
        console.warn('Firebase read error in /api/orders:', err.message);
      }
    }

    ordersList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.status(200).json({
      ok: true,
      count: ordersList.length,
      orders: ordersList,
      invoices: invoicesList
    });
  }

  // 2. POST: Update or Delete order
  if (req.method === 'POST') {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const action = b.action || 'update';
    const orderId = String(b.orderId || b.id || '').trim();

    if (!orderId && action !== 'create' && action !== 'update_invoice' && action !== 'send_invoice_email' && action !== 'save_invoice_settings') {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const local = readLocalDb();
    if (!Array.isArray(local.orders)) local.orders = [];
    if (!Array.isArray(local.invoices)) local.invoices = [];

    // ACTION: UPDATE / EDIT INVOICE
    if (action === 'update_invoice') {
      const inv = b.invoice || b;
      const invId = inv.id || inv.number;
      if (!invId) return res.status(400).json({ error: 'Invoice ID or number required' });

      const idx = local.invoices.findIndex((i) => i.id === inv.id || i.number === inv.number);
      const updatedInv = Object.assign({}, (idx !== -1 ? local.invoices[idx] : {}), inv, {
        updatedAt: Date.now()
      });

      if (idx !== -1) {
        local.invoices[idx] = updatedInv;
      } else {
        local.invoices.unshift(updatedInv);
      }
      writeLocalDb(local);

      if (db) {
        try {
          const refKey = inv.id ? ('invoices/' + inv.id) : ('invoices/' + inv.number);
          await db.ref(refKey).set(updatedInv);
        } catch (e) {
          console.warn('Firebase invoice update error:', e.message);
        }
      }

      let emailed = false;
      if (b.sendEmail && updatedInv.customerEmail) {
        const sendRes = await sendInvoiceToCustomer(updatedInv, updatedInv.customerEmail);
        emailed = sendRes.ok;
      }

      return res.status(200).json({ ok: true, message: 'Invoice updated successfully', emailed, invoice: updatedInv });
    }

    // ACTION: SEND INVOICE EMAIL TO CUSTOMER
    if (action === 'send_invoice_email') {
      let inv = b.invoice;
      if (!inv && (b.invoiceId || b.number)) {
        inv = local.invoices.find((i) => i.id === b.invoiceId || i.number === b.number);
      }
      if (!inv) return res.status(404).json({ error: 'Invoice not found' });

      const targetEmail = b.email || inv.customerEmail;
      const sendRes = await sendInvoiceToCustomer(inv, targetEmail);
      if (!sendRes.ok) return res.status(500).json({ error: sendRes.error });

      return res.status(200).json({ ok: true, message: 'Invoice emailed to ' + targetEmail });
    }

    // ACTION: SAVE INVOICE SETTINGS
    if (action === 'save_invoice_settings') {
      const settings = b.settings || {};
      if (db) {
        try {
          await db.ref('settings/invoice').set(settings);
        } catch (e) {
          console.warn('Firebase invoice settings save error:', e.message);
        }
      }
      return res.status(200).json({ ok: true, message: 'Invoice settings saved' });
    }

    // ACTION: UPDATE STATUS OR NOTE
    if (action === 'update') {
      const idx = local.orders.findIndex((o) => o.id === orderId);
      const updates = { updatedAt: Date.now() };
      if (b.status) updates.status = b.status;
      if (b.note !== undefined) updates.note = b.note;

      if (idx !== -1) {
        local.orders[idx] = Object.assign({}, local.orders[idx], updates);
      } else {
        local.orders.unshift(Object.assign({ id: orderId }, updates));
      }
      writeLocalDb(local);

      if (db) {
        try {
          await db.ref('orders/' + orderId).update(updates);
        } catch (e) {
          console.warn('Firebase order update error:', e.message);
        }
      }

      return res.status(200).json({ ok: true, message: 'Order updated successfully' });
    }

    // ACTION: DELETE ORDER
    if (action === 'delete') {
      local.orders = local.orders.filter((o) => o.id !== orderId);
      writeLocalDb(local);

      if (db) {
        try {
          await db.ref('orders/' + orderId).remove();
        } catch (e) {
          console.warn('Firebase order delete error:', e.message);
        }
      }

      return res.status(200).json({ ok: true, message: 'Order deleted successfully' });
    }

    // ACTION: CREATE ORDER (direct API call)
    if (action === 'create') {
      const newOrder = {
        id: orderId || ('ord-' + Date.now()),
        name: b.name || 'Client',
        email: b.email || '',
        phone: b.phone || '',
        service: b.service || 'General Inquiry',
        budget: b.budget || '',
        eventDate: b.eventDate || '',
        message: b.message || '',
        source: b.source || 'api',
        status: b.status || 'new',
        createdAt: Date.now()
      };
      local.orders.unshift(newOrder);
      writeLocalDb(local);

      if (db) {
        try {
          await db.ref('orders/' + newOrder.id).set(newOrder);
        } catch (e) {}
      }

      return res.status(200).json({ ok: true, orderId: newOrder.id });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
