// Firebase Admin (server side). Needs the FIREBASE_SERVICE_ACCOUNT environment variable on Vercel.
let db = null, ServerValue = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        databaseURL: 'https://c4s-studio-default-rtdb.asia-southeast1.firebasedatabase.app'
      });
    }
    db = admin.database();
    ServerValue = admin.database.ServerValue;
  }
} catch (e) { console.error('Firebase admin init failed:', e.message); }
module.exports = { db, ServerValue };
