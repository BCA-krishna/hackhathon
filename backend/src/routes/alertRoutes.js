const express = require('express');
const alertController = require('../controllers/alertController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/alerts', authGuard, alertController.getAlerts);

module.exports = router;
