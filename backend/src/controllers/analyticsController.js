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

async function getWeekComparison(req, res, next) {
  try {
    const payload = await analyticsService.getWeekComparison(req.user.id);
    return success(res, payload, 'Week comparison generated');
  } catch (error) {
    return next(error);
  }
}

async function getProductAnalytics(req, res, next) {
  try {
    const payload = await analyticsService.getProductAnalytics(req.user.id, req.query.product || '');
    return success(res, payload, 'Product analytics generated');
  } catch (error) {
    return next(error);
  }
}

async function getProductTrends(req, res, next) {
  try {
    const payload = await analyticsService.getProductTrends(req.user.id, req.query.limit || 6);
    return success(res, payload, 'Product trends generated');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getInsights,
  getWeekComparison,
  getProductAnalytics,
  getProductTrends
};
