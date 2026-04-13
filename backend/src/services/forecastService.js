const storeService = require('./storeService');

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function getForecast(userId, days = 7) {
  const sales = await storeService.listSalesByUser(userId);
  const dailyMap = sales.reduce((acc, item) => {
    const key = item.date.toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + Number(item.sales || 0);
    return acc;
  }, {});

  const ordered = Object.entries(dailyMap)
    .map(([date, salesValue]) => ({ date, sales: Number(salesValue || 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const points = ordered.map((item, idx) => ({
    x: idx,
    y: Number(item.sales || 0),
    date: new Date(item.date)
  }));

  const n = points.length || 1;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = n ? (sumY - slope * sumX) / n : 0;

  const weekdayAverages = Array.from({ length: 7 }).map(() => ({ sum: 0, count: 0 }));
  points.forEach((p) => {
    const wd = p.date.getDay();
    weekdayAverages[wd].sum += p.y;
    weekdayAverages[wd].count += 1;
  });

  const globalAvg = n ? sumY / n : 0;
  const weekdayFactor = weekdayAverages.map((entry) => {
    if (!entry.count || !globalAvg) return 1;
    return (entry.sum / entry.count) / globalAvg;
  });

  const startDate = ordered.length ? new Date(ordered[ordered.length - 1].date) : new Date();

  const predictions = Array.from({ length: days }).map((_, idx) => {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + idx + 1);

    const trendComponent = intercept + slope * (n + idx);
    const seasonalComponent = weekdayFactor[nextDate.getDay()] || 1;
    const prediction = Math.max(0, trendComponent * seasonalComponent);

    return {
      date: nextDate.toISOString().slice(0, 10),
      predictedSales: round2(prediction)
    };
  });

  return {
    method: 'trend_seasonality',
    window: Math.min(14, n),
    predictions
  };
}

module.exports = { getForecast };
