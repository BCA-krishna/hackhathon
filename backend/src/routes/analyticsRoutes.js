const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/insights', authGuard, analyticsController.getInsights);

module.exports = router;
