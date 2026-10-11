// Serverless backend function: /api/admin
// Manages admin team members and admin dashboard state.

const SUPER_ADMIN = 'chulitharv123@gmail.com';

let fbadminModule;
try { fbadminModule = require('../fbadmin'); } catch (e) {
  try { fbadminModule = require('./fbadmin'); } catch (e2) { fbadminModule = { db: null }; }
}
const { db } = fbadminModule;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Fetch admins list
  if (req.method === 'GET') {
    const admins = [{ email: SUPER_ADMIN, role: 'owner', addedBy: 'System', isPermanent: true }];
    if (db) {
      try {
        const snap = await db.ref('site/admins').once('value');
        if (snap.exists()) {
          snap.forEach((c) => {
            const v = c.val();
            if (v && v.email && v.email.toLowerCase() !== SUPER_ADMIN.toLowerCase()) {
              admins.push({
                key: c.key,
                email: v.email,
                role: v.role || 'admin',
                addedAt: v.addedAt,
                addedBy: v.addedBy || 'Owner'
              });
            }
          });
        }
      } catch (e) {
        console.warn('Firebase admins read error:', e.message);
      }
    }
    return res.status(200).json({ ok: true, superAdmin: SUPER_ADMIN, admins });
  }

  // POST: Add new admin
  if (req.method === 'POST') {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const email = String(b.email || '').toLowerCase().trim();
    const requester = String(b.requester || '').toLowerCase().trim();

    if (requester && requester !== SUPER_ADMIN.toLowerCase()) {
      return res.status(403).json({ error: 'Only the primary owner (' + SUPER_ADMIN + ') can add administrators.' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (email === SUPER_ADMIN.toLowerCase()) {
      return res.status(400).json({ error: SUPER_ADMIN + ' is already the primary owner.' });
    }

    const key = email.replace(/[^a-zA-Z0-9]/g, '_');
    if (db) {
      try {
        await db.ref('site/admins/' + key).set({
          email: email,
          role: 'admin',
          addedAt: Date.now(),
          addedBy: requester || SUPER_ADMIN
        });
      } catch (e) {
        return res.status(500).json({ error: 'Database update failed: ' + e.message });
      }
    }

    return res.status(200).json({ ok: true, message: `Admin ${email} added successfully.` });
  }

  // DELETE: Remove admin
  if (req.method === 'DELETE' || (req.method === 'POST' && req.body && req.body.action === 'remove')) {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const email = String(b.email || req.query.email || '').toLowerCase().trim();

    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (email === SUPER_ADMIN.toLowerCase()) {
      return res.status(400).json({ error: 'The primary owner cannot be removed.' });
    }

    const key = email.replace(/[^a-zA-Z0-9]/g, '_');
    if (db) {
      try {
        await db.ref('site/admins/' + key).remove();
      } catch (e) {
        return res.status(500).json({ error: 'Database delete failed: ' + e.message });
      }
    }

    return res.status(200).json({ ok: true, message: `Admin ${email} removed successfully.` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
