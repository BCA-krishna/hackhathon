const { success } = require('../utils/response');
const recommendationService = require('../services/recommendationService');

async function getRecommendations(req, res, next) {
  try {
    const payload = await recommendationService.getRecommendations(req.user.id);
    return success(res, payload, 'Recommendations generated');
  } catch (error) {
    return next(error);
  }
}

module.exports = { getRecommendations };
