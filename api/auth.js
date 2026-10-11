// Serverless backend function: /api/auth
// Validates admin credentials, Google accounts, and Master Admin Passkeys.

const SUPER_ADMIN = 'chulitharv123@gmail.com';
const MASTER_KEY = 'c4s2026';

let fbadminModule;
try { fbadminModule = require('../fbadmin'); } catch (e) {
  try { fbadminModule = require('./fbadmin'); } catch (e2) { fbadminModule = { db: null }; }
}
const { db } = fbadminModule;

async function getAuthorizedAdminEmails() {
  const list = [SUPER_ADMIN.toLowerCase()];
  if (db) {
    try {
      const snap = await db.ref('site/admins').once('value');
      if (snap.exists()) {
        snap.forEach((c) => {
          const v = c.val();
          if (v && v.email) {
            const em = String(v.email).toLowerCase().trim();
            if (em && !list.includes(em)) list.push(em);
          }
        });
      }
    } catch (e) {
      console.warn('Could not read site/admins:', e.message);
    }
  }
  return list;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Check authorization info
  if (req.method === 'GET') {
    const list = await getAuthorizedAdminEmails();
    return res.status(200).json({
      ok: true,
      superAdmin: SUPER_ADMIN,
      adminCount: list.length
    });
  }

  // POST: Verify login / passkey
  if (req.method === 'POST') {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const email = String(b.email || '').toLowerCase().trim();
    const passkey = String(b.passkey || b.key || b.password || '').trim();

    // Check passkey
    if (passkey && (passkey === MASTER_KEY || passkey === 'chulitha123' || passkey === 'c4sstudio')) {
      return res.status(200).json({
        ok: true,
        authorized: true,
        email: SUPER_ADMIN,
        role: 'owner',
        name: 'Super Admin',
        token: 'auth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      });
    }

    // Check Google email
    if (email) {
      const authorizedList = await getAuthorizedAdminEmails();
      const isAuth = authorizedList.includes(email);
      const isOwner = email === SUPER_ADMIN.toLowerCase();

      if (isAuth) {
        return res.status(200).json({
          ok: true,
          authorized: true,
          email: email,
          role: isOwner ? 'owner' : 'admin',
          name: isOwner ? 'Primary Owner' : 'Administrator',
          token: 'auth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
        });
      }

      return res.status(403).json({
        ok: false,
        authorized: false,
        error: `Account ${email} is not authorized for administrator access.`
      });
    }

    return res.status(400).json({ error: 'Please provide an email or admin passkey.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
