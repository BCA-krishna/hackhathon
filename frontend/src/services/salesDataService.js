import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import * as XLSX from 'xlsx';
import { db, storage } from './firebase';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const HEADER_ALIASES = {
  productname: 'productName',
  product: 'productName',
  item: 'productName',
  name: 'productName',
  sales: 'sales',
  revenue: 'sales',
  quantitysold: 'sales',
  qtysold: 'sales',
  stock: 'stock',
  inventory: 'stock',
  quantity: 'stock',
  date: 'date',
  saledate: 'date',
  solddate: 'date',
  timestamp: 'date'
};

export function formatFirestoreError(error, fallbackMessage = 'Operation failed.') {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '');
  const isPermissionDenied = code.includes('permission-denied') || /insufficient permissions|permission-denied/i.test(message);

  if (isPermissionDenied) {
    return 'Firestore permission denied. Open Firestore Rules, apply the rules from FIRESTORE_RULES.md, and publish them.';
  }

  return message || fallbackMessage;
}

function debugInfo(event, payload = {}) {
  console.info(`[Firestore] ${event}`, payload);
}

function debugError(event, error, payload = {}) {
  console.error(`[Firestore] ${event}`, {
    ...payload,
    code: error?.code || '',
    message: error?.message || String(error || '')
  });
}

async function logActivity({ userId, action, status, message, meta = {} }) {
  if (!userId) {
    return;
  }

  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId,
      action,
      status,
      message,
      meta,
      createdAt: serverTimestamp()
    });
  } catch {
    // Logging should never block the main business flow.
  }
}

function normalizeDate(value) {
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

function normalizeNumeric(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    return cleaned ? Number(cleaned) : Number.NaN;
  }
  return Number(value);
}

function normalizeIncomingDate(value) {
  if (value instanceof Date) {
    return value;
  }
  if (value?.toDate) {
    return value.toDate();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial dates count from 1899-12-30 in most spreadsheets.
    const excelEpochMs = Date.UTC(1899, 11, 30);
    return new Date(excelEpochMs + value * 24 * 60 * 60 * 1000);
  }
  return new Date(value);
}

function normalizeRecordShape(record = {}) {
  const normalized = {};

  Object.entries(record).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || '').trim();
    if (!key) {
      return;
    }

    const compactKey = key.toLowerCase().replace(/[\s_-]/g, '');
    const mappedKey = HEADER_ALIASES[compactKey] || key;
    normalized[mappedKey] = rawValue;
  });

  return {
    productName: normalized.productName,
    sales: normalized.sales,
    stock: normalized.stock,
    date: normalizeIncomingDate(normalized.date)
  };
}

function ensureValidRecord(record, row = 0) {
  const normalizedRecord = normalizeRecordShape(record);
  const normalized = {
    productName: String(normalizedRecord.productName || '').trim(),
    sales: normalizeNumeric(normalizedRecord.sales),
    stock: normalizeNumeric(normalizedRecord.stock),
    date: normalizeIncomingDate(normalizedRecord.date)
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

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('CSV file is empty or missing data rows.');
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  if (!headers.length) {
    throw new Error('CSV header row is missing.');
  }

  return lines.slice(1).map((line, idx) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, colIdx) => {
      row[header] = values[colIdx] ?? '';
    });
    return ensureValidRecord(row, idx + 2);
  });
}

async function parseXlsx(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Spreadsheet has no sheets to read.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });

  if (!rows.length) {
    throw new Error('Spreadsheet is empty or missing data rows.');
  }

  return rows.map((record, index) => ensureValidRecord(record, index + 2));
}

async function parseFile(file) {
  const ext = file.name.toLowerCase();

  if (ext.endsWith('.json')) {
    const text = await file.text();
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
    const text = await file.text();
    return parseCsv(text);
  }

  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    return parseXlsx(file);
  }

  throw new Error('Only CSV, JSON, and XLSX files are supported.');
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

async function collectionHasUserRows(collectionName, userId) {
  const snapshot = await getDocs(query(collection(db, collectionName), where('userId', '==', userId), limit(1)));
  return !snapshot.empty;
}

async function seedCollectionIfMissing(collectionName, userId, buildData) {
  const exists = await collectionHasUserRows(collectionName, userId);
  if (exists) {
    debugInfo('seed_skipped_existing', { collectionName, userId });
    return false;
  }

  await addDoc(collection(db, collectionName), {
    ...buildData(),
    userId,
    createdAt: serverTimestamp(),
    source: 'bootstrap'
  });

  debugInfo('seed_created', { collectionName, userId });
  return true;
}

export async function bootstrapUserRealtimeData({ userId, userName = 'User', userEmail = '' }) {
  if (!userId) {
    throw new Error('Missing userId for bootstrap process.');
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  debugInfo('bootstrap_start', { userId });

  const created = {
    salesData: false,
    alerts: false,
    forecasts: false,
    recommendations: false
  };

  try {
    created.salesData = await seedCollectionIfMissing('salesData', userId, () => ({
      productName: 'Test Product',
      sales: 100,
      stock: 20,
      date: Timestamp.fromDate(now)
    }));

    created.alerts = await seedCollectionIfMissing('alerts', userId, () => ({
      message: 'Low stock detected',
      type: 'warning',
      severity: 'medium',
      timestamp: serverTimestamp(),
      sourceDate: now.toISOString(),
      productName: 'Test Product'
    }));

    created.forecasts = await seedCollectionIfMissing('forecasts', userId, () => ({
      date: tomorrow.toISOString().slice(0, 10),
      predictedSales: 110,
      method: 'bootstrap_seed',
      window: 1
    }));

    created.recommendations = await seedCollectionIfMissing('recommendations', userId, () => ({
      action: 'Review stock levels for Test Product',
      productName: 'Test Product',
      reason: 'Bootstrap recommendation for new user pipeline verification.',
      ownerName: userName,
      ownerEmail: userEmail
    }));

    await logActivity({
      userId,
      action: 'bootstrap_complete',
      status: Object.values(created).some(Boolean) ? 'success' : 'info',
      message: 'Bootstrap pipeline completed.',
      meta: created
    });

    debugInfo('bootstrap_complete', { userId, created });
    return created;
  } catch (error) {
    const message = formatFirestoreError(error, 'Bootstrap pipeline failed.');
    debugError('bootstrap_failed', error, { userId });

    await logActivity({
      userId,
      action: 'bootstrap_failed',
      status: 'error',
      message,
      meta: created
    });

    throw new Error(message);
  }
}

export function validateUploadFile(file) {
  if (!file) {
    return 'Please select a file.';
  }

  const ext = file.name.toLowerCase();
  const valid = ext.endsWith('.csv') || ext.endsWith('.json') || ext.endsWith('.xlsx') || ext.endsWith('.xls');
  if (!valid) {
    return 'Invalid file format. Only CSV, JSON, and XLSX files are allowed.';
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'File is too large. Maximum allowed size is 20MB.';
  }

  return '';
}

export async function uploadFileAndIngest({ userId, file, onProgress }) {
  if (!userId) {
    throw new Error('Please sign in before uploading data.');
  }

  const validationError = validateUploadFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  await logActivity({
    userId,
    action: 'upload_start',
    status: 'info',
    message: 'Upload started.',
    meta: {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'unknown'
    }
  });

  let records = [];
  try {
    records = await parseFile(file);
  } catch (error) {
    const parseMessage = error?.message || 'Unable to parse file.';
    await logActivity({
      userId,
      action: 'upload_parse_failed',
      status: 'error',
      message: parseMessage,
      meta: {
        fileName: file.name
      }
    });
    throw error;
  }

  await logActivity({
    userId,
    action: 'upload_parse_success',
    status: 'success',
    message: 'File parsed successfully.',
    meta: {
      fileName: file.name,
      recordsCount: records.length
    }
  });

  const warnings = [];
  let filePath = '';
  let downloadURL = '';

  const safeName = file.name.replace(/\s+/g, '_');
  const fileRef = ref(storage, `uploads/${userId}/${Date.now()}_${safeName}`);

  try {
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

    filePath = fileRef.fullPath;
    downloadURL = await getDownloadURL(fileRef);

    await logActivity({
      userId,
      action: 'upload_storage_success',
      status: 'success',
      message: 'File archived in Storage.',
      meta: {
        fileName: file.name,
        filePath
      }
    });
  } catch {
    warnings.push('Data rows were imported, but file archival failed. Check Firebase Storage rules.');

    await logActivity({
      userId,
      action: 'upload_storage_failed',
      status: 'warning',
      message: 'Storage archival failed but ingestion will continue.',
      meta: {
        fileName: file.name
      }
    });
  }

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

  try {
    await batch.commit();
    debugInfo('sales_write_success', { userId, recordsCount: records.length });
  } catch (error) {
    const saveMessage = formatFirestoreError(error, 'Failed to write sales records.');
    debugError('sales_write_failed', error, { userId, recordsCount: records.length });
    await logActivity({
      userId,
      action: 'upload_sales_write_failed',
      status: 'error',
      message: saveMessage,
      meta: {
        fileName: file.name,
        recordsCount: records.length
      }
    });
    throw new Error(saveMessage);
  }

  await logActivity({
    userId,
    action: 'upload_sales_write_success',
    status: 'success',
    message: 'Sales records saved to Firestore.',
    meta: {
      fileName: file.name,
      recordsCount: records.length
    }
  });

  try {
    await addDoc(collection(db, 'uploads'), {
      userId,
      fileName: file.name,
      fileType: file.type || 'unknown',
      fileSize: file.size,
      filePath,
      downloadURL,
      recordsCount: records.length,
      status: warnings.length ? 'partial' : 'success',
      warning: warnings.join(' '),
      createdAt: serverTimestamp()
    });
    debugInfo('upload_history_write_success', { userId, fileName: file.name, recordsCount: records.length });

    await logActivity({
      userId,
      action: 'upload_history_saved',
      status: 'success',
      message: 'Upload history record saved.',
      meta: {
        fileName: file.name,
        recordsCount: records.length
      }
    });
  } catch {
    debugError('upload_history_write_failed', new Error('Upload history write failed'), { userId, fileName: file.name });
    warnings.push('Data rows were imported, but upload history could not be saved. Check uploads rules.');

    await logActivity({
      userId,
      action: 'upload_history_failed',
      status: 'warning',
      message: 'Upload history record failed.',
      meta: {
        fileName: file.name
      }
    });
  }

  try {
    await refreshDerivedCollections(userId);
    debugInfo('derived_refresh_success', { userId });

    await logActivity({
      userId,
      action: 'upload_derived_refreshed',
      status: 'success',
      message: 'Derived collections refreshed.',
      meta: {
        fileName: file.name
      }
    });
  } catch {
    debugError('derived_refresh_failed', new Error('Derived refresh failed'), { userId });
    warnings.push('Data rows were imported, but derived insights could not refresh yet.');

    await logActivity({
      userId,
      action: 'upload_derived_failed',
      status: 'warning',
      message: 'Derived collections refresh failed.',
      meta: {
        fileName: file.name
      }
    });
  }

  if (onProgress) {
    onProgress(100);
  }

  const result = {
    recordsCount: records.length,
    downloadURL,
    warning: warnings.join(' ')
  };

  debugInfo('upload_complete', {
    userId,
    recordsCount: records.length,
    warnings: warnings.length
  });

  await logActivity({
    userId,
    action: 'upload_complete',
    status: warnings.length ? 'partial' : 'success',
    message: warnings.length ? 'Upload completed with warnings.' : 'Upload completed successfully.',
    meta: {
      fileName: file.name,
      recordsCount: records.length,
      warningCount: warnings.length
    }
  });

  return result;
}

export async function saveManualRecord({ userId, record }) {
  if (!userId) {
    throw new Error('Please sign in before submitting data.');
  }

  await logActivity({
    userId,
    action: 'manual_entry_start',
    status: 'info',
    message: 'Manual entry started.',
    meta: {
      productName: record?.productName || ''
    }
  });

  const normalized = ensureValidRecord(record, 1);
  const warnings = [];

  try {
    await addDoc(collection(db, 'salesData'), {
      productName: normalized.productName,
      sales: normalized.sales,
      stock: normalized.stock,
      date: Timestamp.fromDate(normalized.date),
      userId,
      createdAt: serverTimestamp()
    });
    debugInfo('manual_sales_write_success', { userId, productName: normalized.productName });
  } catch (error) {
    const saveMessage = formatFirestoreError(error, 'Manual record save failed.');
    debugError('manual_sales_write_failed', error, { userId, productName: normalized.productName });
    await logActivity({
      userId,
      action: 'manual_entry_sales_write_failed',
      status: 'error',
      message: saveMessage,
      meta: {
        productName: normalized.productName
      }
    });
    throw new Error(saveMessage);
  }

  await logActivity({
    userId,
    action: 'manual_entry_sales_write_success',
    status: 'success',
    message: 'Manual record saved to Firestore.',
    meta: {
      productName: normalized.productName,
      sales: normalized.sales,
      stock: normalized.stock
    }
  });

  try {
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

    await logActivity({
      userId,
      action: 'manual_entry_history_saved',
      status: 'success',
      message: 'Manual entry history saved.',
      meta: {
        productName: normalized.productName
      }
    });
  } catch {
    warnings.push('Manual record was saved, but upload history could not be saved.');

    await logActivity({
      userId,
      action: 'manual_entry_history_failed',
      status: 'warning',
      message: 'Manual entry history save failed.',
      meta: {
        productName: normalized.productName
      }
    });
  }

  try {
    await refreshDerivedCollections(userId);

    await logActivity({
      userId,
      action: 'manual_entry_derived_refreshed',
      status: 'success',
      message: 'Derived collections refreshed after manual entry.',
      meta: {
        productName: normalized.productName
      }
    });
  } catch {
    warnings.push('Manual record was saved, but derived insights could not refresh yet.');

    await logActivity({
      userId,
      action: 'manual_entry_derived_failed',
      status: 'warning',
      message: 'Derived refresh failed after manual entry.',
      meta: {
        productName: normalized.productName
      }
    });
  }

  const result = {
    warning: warnings.join(' ')
  };

  await logActivity({
    userId,
    action: 'manual_entry_complete',
    status: warnings.length ? 'partial' : 'success',
    message: warnings.length ? 'Manual entry completed with warnings.' : 'Manual entry completed successfully.',
    meta: {
      productName: normalized.productName,
      warningCount: warnings.length
    }
  });

  return result;
}

function subscribeToUserCollection(collectionName, userId, mapper, onData, onError) {
  const q = query(collection(db, collectionName), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => mapper(docSnap));
      debugInfo('data_fetched', { collectionName, userId, count: rows.length });
      onData(rows);
    },
    (snapshotError) => {
      debugError('listener_error', snapshotError, { collectionName, userId });
      if (onError) {
        onError(snapshotError);
      }
    }
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
