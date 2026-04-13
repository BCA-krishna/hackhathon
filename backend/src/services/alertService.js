const storeService = require('./storeService');
const env = require('../config/env');

async function detectAndPersistAlerts(userId) {
  const alerts = [];

  const inventory = await storeService.listInventoryByUser(userId);
  inventory.forEach((item) => {
    if (item.stock < env.stockThreshold) {
      alerts.push({
        userId,
        type: 'LOW_STOCK',
        productName: item.productName,
        message: `Low stock for ${item.productName}. Current stock: ${item.stock}`,
        severity: item.stock <= Math.ceil(env.stockThreshold / 2) ? 'high' : 'medium',
        meta: { stock: item.stock, threshold: env.stockThreshold }
      });
    }
  });

  const sales = await storeService.listSalesByUser(userId);
  const recent = sales.filter((s) => s.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const prev = sales.filter(
    (s) =>
      s.date < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) &&
      s.date >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  );

  const recentTotal = recent.reduce((sum, s) => sum + s.sales, 0);
  const prevTotal = prev.reduce((sum, s) => sum + s.sales, 0);

  if (prevTotal > 0 && recentTotal < prevTotal * 0.7) {
    alerts.push({
      userId,
      type: 'SALES_DROP',
      message: `Sales dropped by more than 30%. Prev 7d: ${prevTotal}, Recent 7d: ${recentTotal}`,
      severity: 'high',
      meta: { previous7DaysSales: prevTotal, recent7DaysSales: recentTotal }
    });
  }

  await storeService.replaceAlertsForUser(userId, alerts);
  return alerts;
}

async function getAlerts(userId) {
  await detectAndPersistAlerts(userId);
  return storeService.listAlertsByUser(userId, 100);
}

module.exports = { detectAndPersistAlerts, getAlerts };
