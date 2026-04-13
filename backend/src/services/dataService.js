const storeService = require('./storeService');
const ApiError = require('../utils/apiError');

function normalizeRecord(record) {
  return {
    productName: String(record.productName || '').trim(),
    sales: Number(record.sales),
    stock: Number(record.stock),
    date: new Date(record.date)
  };
}

function validateRecord(record, rowIndex = 0) {
  const normalized = normalizeRecord(record);
  if (!normalized.productName) {
    throw new ApiError(400, `Row ${rowIndex}: productName is required`);
  }
  if (Number.isNaN(normalized.sales) || normalized.sales < 0) {
    throw new ApiError(400, `Row ${rowIndex}: sales must be a non-negative number`);
  }
  if (Number.isNaN(normalized.stock) || normalized.stock < 0) {
    throw new ApiError(400, `Row ${rowIndex}: stock must be a non-negative number`);
  }
  if (Number.isNaN(normalized.date.getTime())) {
    throw new ApiError(400, `Row ${rowIndex}: date must be valid`);
  }
  return normalized;
}

async function uploadRecords(userId, records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'No records found in payload');
  }

  const normalized = records.map((record, index) => validateRecord(record, index + 1));

  await storeService.createSalesBulk(userId, normalized);
  await storeService.upsertInventoryBulk(userId, normalized);

  return {
    count: normalized.length,
    products: [...new Set(normalized.map((item) => item.productName))]
  };
}

module.exports = { uploadRecords };
