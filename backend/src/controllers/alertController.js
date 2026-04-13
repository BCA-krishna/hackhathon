const { success } = require('../utils/response');
const alertService = require('../services/alertService');
const { emitToUser } = require('../services/realtimeService');

async function getAlerts(req, res, next) {
  try {
    const payload = await alertService.getAlerts(req.user.id);
    emitToUser(req.user.id, 'alerts_updated', payload);
    return success(res, payload, 'Alerts fetched');
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAlerts };
