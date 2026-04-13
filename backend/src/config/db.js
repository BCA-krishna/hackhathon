const admin = require('firebase-admin');
const fs = require('fs');
const env = require('./env');

let firestore = null;

function normalizePrivateKey(key) {
  return key ? key.replace(/\\n/g, '\n') : '';
}

function connectDB() {
  if (env.nodeEnv === 'test') {
    return null;
  }

  if (firestore) {
    return firestore;
  }

  if (!admin.apps.length) {
    if (env.firebaseServiceAccountPath) {
      const raw = fs.readFileSync(env.firebaseServiceAccountPath, 'utf-8');
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || env.firebaseProjectId || undefined
      });
    } else if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.firebaseProjectId,
          clientEmail: env.firebaseClientEmail,
          privateKey: normalizePrivateKey(env.firebasePrivateKey)
        })
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: env.firebaseProjectId || undefined
      });
    }
  }

  firestore = admin.firestore();
  return firestore;
}

function getFirestore() {
  return firestore || connectDB();
}

function getAdminAuth() {
  connectDB();
  return admin.auth();
}

module.exports = { connectDB, getFirestore, getAdminAuth };
