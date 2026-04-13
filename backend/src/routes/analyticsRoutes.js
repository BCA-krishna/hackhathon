const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/insights', authGuard, analyticsController.getInsights);
router.get('/comparison/week', authGuard, analyticsController.getWeekComparison);
router.get('/product', authGuard, analyticsController.getProductAnalytics);
router.get('/product-trends', authGuard, analyticsController.getProductTrends);

module.exports = router;
