const express = require('express');
const aiController = require('../controllers/aiController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/ai/feedback-insights', authGuard, aiController.generateFeedbackInsights);

module.exports = router;
