const { success } = require('../utils/response');
const analyticsService = require('../services/analyticsService');

async function getInsights(req, res, next) {
  try {
    const payload = await analyticsService.getInsights(req.user.id);
    return success(res, payload, 'Insights generated');
  } catch (error) {
    return next(error);
  }
}

module.exports = { getInsights };
