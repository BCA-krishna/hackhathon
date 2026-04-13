const storeService = require('./storeService');

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function getForecast(userId, days = 7) {
  const sales = await storeService.listSalesByUser(userId);
  const dailyMap = sales.reduce((acc, item) => {
    const key = item.date.toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + item.sales;
    return acc;
  }, {});

  const values = Object.values(dailyMap);
  const window = Math.min(7, values.length || 1);

  const movingAverage = values.length
    ? values.slice(-window).reduce((sum, val) => sum + val, 0) / window
    : 0;

  const startDate = values.length
    ? new Date(Object.keys(dailyMap).at(-1))
    : new Date();

  const predictions = Array.from({ length: days }).map((_, idx) => {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + idx + 1);
    return {
      date: nextDate.toISOString().slice(0, 10),
      predictedSales: round2(movingAverage)
    };
  });

  return {
    method: 'moving_average',
    window,
    predictions
  };
}

module.exports = { getForecast };
