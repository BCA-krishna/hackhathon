const storeService = require('./storeService');

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function aggregateDailyTrends(rows) {
  const trendMap = rows.reduce((acc, item) => {
    const key = new Date(item.date).toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + Number(item.sales || 0);
    return acc;
  }, {});

  return Object.entries(trendMap)
    .map(([date, value]) => ({ date, sales: round2(value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateProducts(rows) {
  const productMap = rows.reduce((acc, item) => {
    const key = item.productName || 'Unknown';
    acc[key] = (acc[key] || 0) + Number(item.sales || 0);
    return acc;
  }, {});

  return Object.entries(productMap)
    .map(([productName, salesValue]) => ({ productName, sales: round2(salesValue) }))
    .sort((a, b) => b.sales - a.sales);
}

function aggregateCategories(rows) {
  const categoryMap = rows.reduce((acc, item) => {
    const key = item.category || item.productCategory || 'Uncategorized';
    acc[key] = (acc[key] || 0) + Number(item.sales || 0);
    return acc;
  }, {});

  return Object.entries(categoryMap)
    .map(([category, sales]) => ({ category, sales: round2(sales) }))
    .sort((a, b) => b.sales - a.sales);
}

function aggregateProfit(rows) {
  const profitMap = rows.reduce((acc, item) => {
    const key = item.productName || 'Unknown';
    const computedProfit =
      item.profit != null
        ? Number(item.profit || 0)
        : (Number(item.price || 0) - Number(item.cost || 0)) * Number(item.quantity || 0);

    acc[key] = (acc[key] || 0) + (Number.isFinite(computedProfit) ? computedProfit : 0);
    return acc;
  }, {});

  return Object.entries(profitMap)
    .map(([productName, profit]) => ({ productName, profit: round2(profit) }))
    .sort((a, b) => b.profit - a.profit);
}

function getLatestDate(rows) {
  if (!rows.length) return new Date();
  return new Date(Math.max(...rows.map((item) => new Date(item.date).getTime())));
}

function getRowsBetween(rows, fromDate, toDate) {
  const fromTime = new Date(fromDate).getTime();
  const toTime = new Date(toDate).getTime();
  return rows.filter((item) => {
    const time = new Date(item.date).getTime();
    return time >= fromTime && time <= toTime;
  });
}

async function getInsights(userId) {
  const sales = await storeService.listSalesByUser(userId);

  const totalSales = sales.reduce((sum, item) => sum + Number(item.sales || 0), 0);
  const dailyTrends = aggregateDailyTrends(sales);
  const productRows = aggregateProducts(sales);
  const categoryRows = aggregateCategories(sales);
  const profitRows = aggregateProfit(sales);

  const topProducts = productRows.slice(0, 5);
  const lowProducts = [...productRows].reverse().slice(0, 5);

  return {
    totalSales: round2(totalSales),
    dailyTrends,
    topProducts,
    lowProducts,
    topCategories: categoryRows.slice(0, 5),
    lowCategories: [...categoryRows].reverse().slice(0, 5),
    topProfitProducts: profitRows.slice(0, 5),
    lowProfitProducts: [...profitRows].reverse().slice(0, 5),
    records: sales.length
  };
}

async function getWeekComparison(userId) {
  const sales = await storeService.listSalesByUser(userId);
  const latestDate = getLatestDate(sales);
  const currentStart = new Date(latestDate);
  currentStart.setDate(latestDate.getDate() - 6);

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(currentStart.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - 6);

  const currentRows = getRowsBetween(sales, currentStart, latestDate);
  const previousRows = getRowsBetween(sales, previousStart, previousEnd);

  const currentTotal = currentRows.reduce((sum, item) => sum + Number(item.sales || 0), 0);
  const previousTotal = previousRows.reduce((sum, item) => sum + Number(item.sales || 0), 0);
  const growthPercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  return {
    currentWindow: {
      from: currentStart.toISOString().slice(0, 10),
      to: latestDate.toISOString().slice(0, 10),
      totalSales: round2(currentTotal),
      topProducts: aggregateProducts(currentRows).slice(0, 5)
    },
    previousWindow: {
      from: previousStart.toISOString().slice(0, 10),
      to: previousEnd.toISOString().slice(0, 10),
      totalSales: round2(previousTotal),
      topProducts: aggregateProducts(previousRows).slice(0, 5)
    },
    growthPercent: round2(growthPercent)
  };
}

async function getProductAnalytics(userId, productName) {
  const sales = await storeService.listSalesByUser(userId);
  const filtered = productName
    ? sales.filter((item) => (item.productName || '').toLowerCase() === String(productName).toLowerCase())
    : sales;

  const dailyTrend = aggregateDailyTrends(filtered);

  const monthlyMap = filtered.reduce((acc, item) => {
    const month = new Date(item.date).toISOString().slice(0, 7);
    acc[month] = (acc[month] || 0) + Number(item.sales || 0);
    return acc;
  }, {});

  const monthlySales = Object.entries(monthlyMap)
    .map(([month, value]) => ({ month, sales: round2(value) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const yearlyMap = filtered.reduce((acc, item) => {
    const year = new Date(item.date).toISOString().slice(0, 4);
    acc[year] = (acc[year] || 0) + Number(item.sales || 0);
    return acc;
  }, {});

  const yearlySales = Object.entries(yearlyMap)
    .map(([year, value]) => ({ year, sales: round2(value) }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const currentMonth = monthlySales.length ? monthlySales[monthlySales.length - 1].sales : 0;
  const previousMonth = monthlySales.length > 1 ? monthlySales[monthlySales.length - 2].sales : 0;
  const momGrowthPercent = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0;

  return {
    productName: productName || 'All Products',
    records: filtered.length,
    dailyTrend,
    monthlySales,
    yearlySales,
    currentMonthSales: round2(currentMonth),
    currentYearSales: yearlySales.length ? yearlySales[yearlySales.length - 1].sales : 0,
    momGrowthPercent: round2(momGrowthPercent)
  };
}

async function getProductTrends(userId, limit = 6) {
  const sales = await storeService.listSalesByUser(userId);
  const grouped = sales.reduce((acc, item) => {
    const key = item.productName || 'Unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([productName, rows]) => {
      const trend = aggregateDailyTrends(rows);
      const totalSales = trend.reduce((sum, item) => sum + Number(item.sales || 0), 0);
      return {
        productName,
        totalSales: round2(totalSales),
        trend
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, Math.max(1, Number(limit) || 6));
}

module.exports = {
  getInsights,
  getWeekComparison,
  getProductAnalytics,
  getProductTrends
};
