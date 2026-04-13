const storeService = require('./storeService');

async function getInsights(userId) {
  const sales = await storeService.listSalesByUser(userId);

  const totalSales = sales.reduce((sum, item) => sum + item.sales, 0);

  const trendMap = sales.reduce((acc, item) => {
    const key = item.date.toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + item.sales;
    return acc;
  }, {});

  const dailyTrends = Object.entries(trendMap).map(([date, value]) => ({ date, sales: value }));

  const productMap = sales.reduce((acc, item) => {
    acc[item.productName] = (acc[item.productName] || 0) + item.sales;
    return acc;
  }, {});

  const topProducts = Object.entries(productMap)
    .map(([productName, salesValue]) => ({ productName, sales: salesValue }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return {
    totalSales,
    dailyTrends,
    topProducts,
    records: sales.length
  };
}

module.exports = { getInsights };
