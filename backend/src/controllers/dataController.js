const { success } = require('../utils/response');
const ApiError = require('../utils/apiError');
const { parseCsvBuffer } = require('../utils/csvParser');
const dataService = require('../services/dataService');
const { emitToUser } = require('../services/realtimeService');

async function uploadData(req, res, next) {
  try {
    let records = [];

    if (req.file) {
      if (req.file.mimetype === 'application/json' || req.file.originalname.endsWith('.json')) {
        records = JSON.parse(req.file.buffer.toString('utf-8'));
      } else {
        records = parseCsvBuffer(req.file.buffer);
      }
    } else if (Array.isArray(req.body.records)) {
      records = req.body.records;
    } else {
      throw new ApiError(400, 'Provide CSV/JSON file or records array in body');
    }

    const result = await dataService.uploadRecords(req.user.id, records);
    emitToUser(req.user.id, 'data_uploaded', result);

    return success(res, result, 'Data uploaded successfully', 201);
  } catch (error) {
    return next(error);
  }
}

module.exports = { uploadData };
