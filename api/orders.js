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

    if (!orderId && action !== 'create') {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const local = readLocalDb();
    if (!Array.isArray(local.orders)) local.orders = [];

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
