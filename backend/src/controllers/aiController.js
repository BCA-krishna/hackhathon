const { success } = require('../utils/response');
const aiInsightsService = require('../services/aiInsightsService');

async function generateFeedbackInsights(req, res, next) {
  try {
    const summary = req.body?.summary;
    const { aiInsights, source } = await aiInsightsService.generateFeedbackInsights(summary);
    return success(res, { aiInsights, source }, 'AI insights generated');
  } catch (error) {
    return next(error);
  }
}

module.exports = { generateFeedbackInsights };
