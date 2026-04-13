const { getFirestore } = require('../config/db');
const env = require('../config/env');

const COLLECTIONS = {
  users: 'users',
  sales: 'sales',
  inventory: 'inventory',
  alerts: 'alerts'
};

const memoryStore = {
  users: [],
  sales: [],
  inventory: [],
  alerts: []
};

let memoryCounter = 1;

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix) {
  memoryCounter += 1;
  return `${prefix}_${memoryCounter}`;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function fromFirestoreDoc(doc) {
  const data = doc.data();
  const result = { id: doc.id, ...data };

  if (result.date?.toDate) {
    result.date = result.date.toDate();
  }
  if (result.createdAt?.toDate) {
    result.createdAt = result.createdAt.toDate();
  }
  if (result.updatedAt?.toDate) {
    result.updatedAt = result.updatedAt.toDate();
  }

  return result;
}

function usingMemory() {
  return env.nodeEnv === 'test';
}

async function createUser({ name, email, password }) {
  const normalizedEmail = String(email).toLowerCase().trim();

  if (usingMemory()) {
    const user = {
      id: nextId('user'),
      name,
      email: normalizedEmail,
      password,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    memoryStore.users.push(user);
    return user;
  }

  const db = getFirestore();
  const user = {
    name,
    email: normalizedEmail,
    password,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const ref = await db.collection(COLLECTIONS.users).add(user);
  return { id: ref.id, ...user };
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).toLowerCase().trim();

  if (usingMemory()) {
    return memoryStore.users.find((item) => item.email === normalizedEmail) || null;
  }

  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.users)
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return fromFirestoreDoc(snapshot.docs[0]);
}

async function findUserById(userId) {
  if (usingMemory()) {
    return memoryStore.users.find((item) => item.id === String(userId)) || null;
  }

  const db = getFirestore();
  const doc = await db.collection(COLLECTIONS.users).doc(String(userId)).get();
  if (!doc.exists) {
    return null;
  }
  return fromFirestoreDoc(doc);
}

async function createSalesBulk(userId, records) {
  if (usingMemory()) {
    records.forEach((record) => {
      memoryStore.sales.push({
        id: nextId('sale'),
        userId: String(userId),
        productName: record.productName,
        sales: record.sales,
        date: toDate(record.date),
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    });
    return;
  }

  const db = getFirestore();
  const batch = db.batch();

  records.forEach((record) => {
    const ref = db.collection(COLLECTIONS.sales).doc();
    batch.set(ref, {
      userId: String(userId),
      productName: record.productName,
      sales: record.sales,
      date: toDate(record.date),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  await batch.commit();
}

async function listSalesByUser(userId) {
  if (usingMemory()) {
    return memoryStore.sales
      .filter((item) => item.userId === String(userId))
      .map((item) => ({ ...item }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.sales).where('userId', '==', String(userId)).get();

  return snapshot.docs
    .map(fromFirestoreDoc)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function upsertInventoryBulk(userId, records) {
  if (usingMemory()) {
    records.forEach((record) => {
      const key = `${String(userId)}_${normalizeKey(record.productName)}`;
      const existing = memoryStore.inventory.find((item) => item.id === key);
      if (existing) {
        existing.stock = record.stock;
        existing.date = toDate(record.date);
        existing.updatedAt = nowIso();
      } else {
        memoryStore.inventory.push({
          id: key,
          userId: String(userId),
          productName: record.productName,
          stock: record.stock,
          date: toDate(record.date),
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
      }
    });
    return;
  }

  const db = getFirestore();
  const batch = db.batch();

  records.forEach((record) => {
    const docId = `${String(userId)}_${normalizeKey(record.productName)}`;
    const ref = db.collection(COLLECTIONS.inventory).doc(docId);
    batch.set(
      ref,
      {
        userId: String(userId),
        productName: record.productName,
        stock: record.stock,
        date: toDate(record.date),
        updatedAt: new Date()
      },
      { merge: true }
    );
  });

  await batch.commit();
}

async function listInventoryByUser(userId) {
  if (usingMemory()) {
    return memoryStore.inventory
      .filter((item) => item.userId === String(userId))
      .map((item) => ({ ...item }));
  }

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.inventory).where('userId', '==', String(userId)).get();
  return snapshot.docs.map(fromFirestoreDoc);
}

async function replaceAlertsForUser(userId, alerts) {
  if (usingMemory()) {
    memoryStore.alerts = memoryStore.alerts.filter((item) => item.userId !== String(userId));
    alerts.forEach((alert) => {
      memoryStore.alerts.push({
        id: nextId('alert'),
        userId: String(userId),
        ...alert,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    });
    return;
  }

  const db = getFirestore();
  const existingSnapshot = await db.collection(COLLECTIONS.alerts).where('userId', '==', String(userId)).get();
  const deleteBatch = db.batch();
  existingSnapshot.docs.forEach((doc) => {
    deleteBatch.delete(doc.ref);
  });
  if (!existingSnapshot.empty) {
    await deleteBatch.commit();
  }

  if (!alerts.length) {
    return;
  }

  const insertBatch = db.batch();
  alerts.forEach((alert) => {
    const ref = db.collection(COLLECTIONS.alerts).doc();
    insertBatch.set(ref, {
      userId: String(userId),
      ...alert,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  await insertBatch.commit();
}

async function listAlertsByUser(userId, limit = 100) {
  if (usingMemory()) {
    return memoryStore.alerts
      .filter((item) => item.userId === String(userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((item) => ({ ...item }));
  }

  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.alerts).where('userId', '==', String(userId)).get();
  return snapshot.docs
    .map(fromFirestoreDoc)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function clearStoreForTests() {
  if (!usingMemory()) {
    return;
  }

  memoryStore.users = [];
  memoryStore.sales = [];
  memoryStore.inventory = [];
  memoryStore.alerts = [];
  memoryCounter = 1;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createSalesBulk,
  listSalesByUser,
  upsertInventoryBulk,
  listInventoryByUser,
  replaceAlertsForUser,
  listAlertsByUser,
  clearStoreForTests
};
