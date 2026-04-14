const express = require('express');
const chatbotController = require('../controllers/chatbotController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/chatbot', authGuard, chatbotController.sendMessage);

module.exports = router;
