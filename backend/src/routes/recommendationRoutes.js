const express = require('express');
const recommendationController = require('../controllers/recommendationController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/recommendations', authGuard, recommendationController.getRecommendations);

module.exports = router;
