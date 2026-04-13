const { success } = require('../utils/response');
const forecastService = require('../services/forecastService');

async function getForecast(req, res, next) {
  try {
    const payload = await forecastService.getForecast(req.user.id, 7);
    return success(res, payload, 'Forecast generated');
  } catch (error) {
    return next(error);
  }
}

module.exports = { getForecast };
