import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from './firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function normalizeDate(value) {
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

function ensureValidRecord(record, row = 0) {
  const normalized = {
    productName: String(record.productName || '').trim(),
    sales: Number(record.sales),
    stock: Number(record.stock),
    date: new Date(record.date)
  };

  if (!normalized.productName) {
    throw new Error(`Row ${row}: productName is required.`);
  }
  if (Number.isNaN(normalized.sales) || normalized.sales < 0) {
    throw new Error(`Row ${row}: sales must be a non-negative number.`);
  }
  if (Number.isNaN(normalized.stock) || normalized.stock < 0) {
    throw new Error(`Row ${row}: stock must be a non-negative number.`);
  }
  if (Number.isNaN(normalized.date.getTime())) {
    throw new Error(`Row ${row}: date must be a valid date.`);
  }

  return normalized;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV file is empty or missing data rows.');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line, idx) => {
    const values = line.split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((header, colIdx) => {
      row[header] = values[colIdx];
    });
    return ensureValidRecord(row, idx + 1);
  });
}

async function parseFile(file) {
  const ext = file.name.toLowerCase();
  const text = await file.text();

  if (ext.endsWith('.json')) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON format.');
    }

    const records = Array.isArray(payload) ? payload : payload.records;
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('JSON must contain an array of records.');
    }

    return records.map((record, index) => ensureValidRecord(record, index + 1));
  }

  if (ext.endsWith('.csv')) {
    return parseCsv(text);
  }

  throw new Error('Only CSV and JSON files are supported.');
}

function buildDailyTrends(salesRows) {
  const grouped = salesRows.reduce((acc, row) => {
    const day = normalizeDate(row.date).toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + Number(row.sales || 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sales]) => ({ date, sales }));
}

function buildTopProducts(salesRows) {
  const grouped = salesRows.reduce((acc, row) => {
    const productName = row.productName || 'Unknown';
    acc[productName] = (acc[productName] || 0) + Number(row.sales || 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([productName, sales]) => ({ productName, sales }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 8);
}

function buildForecastRows(trendRows) {
  const values = trendRows.map((row) => Number(row.sales || 0));
  const window = Math.min(7, values.length || 1);
  const movingAverage = values.length
    ? values.slice(-window).reduce((sum, val) => sum + val, 0) / window
    : 0;

  const startDate = trendRows.length ? new Date(trendRows[trendRows.length - 1].date) : new Date();

  return Array.from({ length: 7 }).map((_, idx) => {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + idx + 1);
    return {
      date: nextDate.toISOString().slice(0, 10),
      predictedSales: Math.round(movingAverage * 100) / 100,
      method: 'moving_average',
      window
    };
  });
}

function buildAlerts(salesRows, trendRows) {
  const latestByProduct = salesRows.reduce((acc, row) => {
    const key = row.productName || 'Unknown';
    const existing = acc[key];
    const rowTime = normalizeDate(row.date).getTime();
    const existingTime = existing ? normalizeDate(existing.date).getTime() : 0;

    if (!existing || rowTime > existingTime) {
      acc[key] = row;
    }
    return acc;
  }, {});

  const lowStockAlerts = Object.values(latestByProduct)
    .filter((row) => Number(row.stock || 0) < 10)
    .map((row) => ({
      type: 'LOW_STOCK',
      productName: row.productName,
      message: `Low stock for ${row.productName}. Current stock: ${Number(row.stock || 0)}`,
      severity: Number(row.stock || 0) < 5 ? 'high' : 'medium',
      sourceDate: normalizeDate(row.date).toISOString(),
      meta: {
        stock: Number(row.stock || 0),
        threshold: 10
      }
    }));

  const recent = trendRows.slice(-2);
  const salesDropAlerts =
    recent.length === 2 && recent[0].sales > 0 && recent[1].sales < recent[0].sales * 0.8
      ? [
          {
            type: 'SALES_DROP',
            productName: 'All Products',
            message: 'Sales dropped by more than 20% compared with previous day.',
            severity: 'high',
            sourceDate: new Date().toISOString(),
            meta: {
              previous: recent[0].sales,
              current: recent[1].sales
            }
          }
        ]
      : [];

  const rows = [...lowStockAlerts, ...salesDropAlerts];
  return rows.length
    ? rows
    : [
        {
          type: 'STABLE',
          productName: 'All Products',
          message: 'No critical anomalies detected.',
          severity: 'low',
          sourceDate: new Date().toISOString(),
          meta: {}
        }
      ];
}

function buildRecommendations(alertRows, topProductRows) {
  const recommendations = [];
  const lowStock = alertRows.find((item) => item.type === 'LOW_STOCK');
  if (lowStock) {
    recommendations.push({
      action: `Restock ${lowStock.productName}`,
      productName: lowStock.productName,
      reason: 'Low stock was detected on a monitored item.'
    });
  }

  if (topProductRows.length) {
    recommendations.push({
      action: `Promote ${topProductRows[0].productName}`,
      productName: topProductRows[0].productName,
      reason: 'Top-performing product can drive additional revenue with targeted campaigns.'
    });
  }

  const salesDrop = alertRows.find((item) => item.type === 'SALES_DROP');
  if (salesDrop) {
    recommendations.push({
      action: 'Launch retention offer',
      productName: 'All Products',
      reason: 'Recent anomaly indicates declining momentum.'
    });
  }

  return recommendations.length
    ? recommendations
    : [
        {
          action: 'Maintain current strategy',
          productName: 'All Products',
          reason: 'Current data indicates stable business performance.'
        }
      ];
}

async function replaceCollectionForUser(collectionName, userId, rows) {
  const existingQuery = query(collection(db, collectionName), where('userId', '==', userId));
  const existingSnapshot = await getDocs(existingQuery);

  for (const existingDoc of existingSnapshot.docs) {
    await deleteDoc(doc(db, collectionName, existingDoc.id));
  }

  for (const row of rows) {
    await addDoc(collection(db, collectionName), {
      ...row,
      userId,
      createdAt: serverTimestamp()
    });
  }
}

async function loadUserSalesRows(userId) {
  const salesQuery = query(collection(db, 'salesData'), where('userId', '==', userId));
  const salesSnapshot = await getDocs(salesQuery);

  return salesSnapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      date: normalizeDate(data.date)
    };
  });
}

export async function refreshDerivedCollections(userId) {
  const salesRows = await loadUserSalesRows(userId);
  const trendRows = buildDailyTrends(salesRows);
  const topProductRows = buildTopProducts(salesRows);
  const forecastRows = buildForecastRows(trendRows);
  const alertRows = buildAlerts(salesRows, trendRows);
  const recommendationRows = buildRecommendations(alertRows, topProductRows);

  await Promise.all([
    replaceCollectionForUser('forecasts', userId, forecastRows),
    replaceCollectionForUser('alerts', userId, alertRows),
    replaceCollectionForUser('recommendations', userId, recommendationRows)
  ]);

  return {
    forecasts: forecastRows,
    alerts: alertRows,
    recommendations: recommendationRows
  };
}

export function validateUploadFile(file) {
  if (!file) {
    return 'Please select a file.';
  }

  const ext = file.name.toLowerCase();
  const valid = ext.endsWith('.csv') || ext.endsWith('.json');
  if (!valid) {
    return 'Invalid file format. Only CSV and JSON are allowed.';
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'File is too large. Maximum allowed size is 5MB.';
  }

  return '';
}

export async function uploadFileAndIngest({ userId, file, onProgress }) {
  const validationError = validateUploadFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const safeName = file.name.replace(/\s+/g, '_');
  const fileRef = ref(storage, `uploads/${userId}/${Date.now()}_${safeName}`);
  const uploadTask = uploadBytesResumable(fileRef, file);

  await new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (!snapshot.totalBytes || !onProgress) return;
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      (error) => reject(error),
      () => resolve()
    );
  });

  const downloadURL = await getDownloadURL(fileRef);
  const records = await parseFile(file);

  const batch = writeBatch(db);
  const salesCollection = collection(db, 'salesData');

  records.forEach((record) => {
    const docRef = doc(salesCollection);
    batch.set(docRef, {
      productName: record.productName,
      sales: record.sales,
      stock: record.stock,
      date: Timestamp.fromDate(record.date),
      userId,
      createdAt: serverTimestamp()
    });
  });

  await batch.commit();

  await addDoc(collection(db, 'uploads'), {
    userId,
    fileName: file.name,
    fileType: file.type || 'unknown',
    fileSize: file.size,
    filePath: fileRef.fullPath,
    downloadURL,
    recordsCount: records.length,
    status: 'success',
    createdAt: serverTimestamp()
  });

  await refreshDerivedCollections(userId);

  return { recordsCount: records.length, downloadURL };
}

export async function saveManualRecord({ userId, record }) {
  const normalized = ensureValidRecord(record, 1);

  await addDoc(collection(db, 'salesData'), {
    productName: normalized.productName,
    sales: normalized.sales,
    stock: normalized.stock,
    date: Timestamp.fromDate(normalized.date),
    userId,
    createdAt: serverTimestamp()
  });

  await addDoc(collection(db, 'uploads'), {
    userId,
    fileName: `manual_${normalized.productName}`,
    fileType: 'manual',
    fileSize: 0,
    filePath: 'manual',
    downloadURL: '',
    recordsCount: 1,
    status: 'success',
    createdAt: serverTimestamp()
  });

  await refreshDerivedCollections(userId);
}

function subscribeToUserCollection(collectionName, userId, mapper, onData, onError) {
  const q = query(collection(db, collectionName), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => mapper(docSnap));
      onData(rows);
    },
    onError
  );
}

export function subscribeToUserSalesData(userId, onData, onError) {
  return subscribeToUserCollection(
    'salesData',
    userId,
    (docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        date: normalizeDate(data.date)
      };
    },
    onData,
    onError
  );
}

export function subscribeToUploads(userId, onData, onError) {
  return subscribeToUserCollection(
    'uploads',
    userId,
    (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }),
    (rows) => {
      const sorted = rows.sort((a, b) => {
        const aTime = normalizeDate(a.createdAt || 0).getTime() || 0;
        const bTime = normalizeDate(b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });
      onData(sorted);
    },
    onError
  );
}

export function subscribeToAlerts(userId, onData, onError) {
  return subscribeToUserCollection(
    'alerts',
    userId,
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() }),
    (rows) => {
      const sorted = rows.sort((a, b) => {
        const aTime = normalizeDate(a.createdAt || 0).getTime() || 0;
        const bTime = normalizeDate(b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });
      onData(sorted);
    },
    onError
  );
}

export function subscribeToRecommendations(userId, onData, onError) {
  return subscribeToUserCollection(
    'recommendations',
    userId,
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() }),
    (rows) => {
      const sorted = rows.sort((a, b) => {
        const aTime = normalizeDate(a.createdAt || 0).getTime() || 0;
        const bTime = normalizeDate(b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });
      onData(sorted);
    },
    onError
  );
}

export function subscribeToForecasts(userId, onData, onError) {
  return subscribeToUserCollection(
    'forecasts',
    userId,
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() }),
    (rows) => {
      const sorted = rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      onData(sorted);
    },
    onError
  );
}
