const storeService = require('./storeService');

async function getRecommendations(userId) {
  const inventory = await storeService.listInventoryByUser(userId);
  const sales = await storeService.listSalesByUser(userId);

  const salesByProduct = sales.reduce((acc, item) => {
    acc[item.productName] = (acc[item.productName] || 0) + item.sales;
    return acc;
  }, {});

  const sortedDemand = Object.entries(salesByProduct).sort((a, b) => b[1] - a[1]);
  const highDemandSet = new Set(sortedDemand.slice(0, 3).map(([productName]) => productName));

  const recommendations = [];

  inventory.forEach((item) => {
    const demand = salesByProduct[item.productName] || 0;

    if (item.stock < 10 && highDemandSet.has(item.productName)) {
      recommendations.push({
        productName: item.productName,
        action: 'Restock',
        reason: `Low stock (${item.stock}) with high demand (${demand})`
      });
    }

    if (demand < 20) {
      recommendations.push({
        productName: item.productName,
        action: 'Run promotion',
        reason: `Low sales volume detected (${demand})`
      });
    }
  });

  return recommendations;
}

module.exports = { getRecommendations };
