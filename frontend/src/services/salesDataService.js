import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from './firebase';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
}

export function subscribeToUserSalesData(userId, onData, onError) {
  const q = query(collection(db, 'salesData'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const dateValue = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        return { id: docSnap.id, ...data, date: dateValue };
      });
      onData(records);
    },
    onError
  );
}

export function subscribeToUploads(userId, onData, onError) {
  const q = query(collection(db, 'uploads'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
      onData(rows);
    },
    onError
  );
}
