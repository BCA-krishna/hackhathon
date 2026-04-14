const storeService = require('../services/storeService');
const { success, error } = require('../utils/response');

/**
 * Get unique products for the POS item list
 */
async function getProducts(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.uid;
    const products = await storeService.getLatestProducts(userId);
    return success(res, products, 'Products retrieved successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * Record a single sale from the POS
 */
async function createSale(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.uid;
    const { productName, quantity, price, category } = req.body;

    if (!productName || !quantity || !price) {
      return error(res, 'Product name, quantity, and price are required', 400);
    }

    const saleData = {
      productName,
      quantity: Number(quantity),
      price: Number(price),
      sales: Number(quantity) * Number(price),
      category: category || 'General'
    };

    const result = await storeService.createSale(userId, saleData);
    return success(res, result, 'Sale recorded successfully', 201);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProducts,
  createSale
};
