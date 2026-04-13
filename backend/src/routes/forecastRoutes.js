const express = require('express');
const forecastController = require('../controllers/forecastController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/forecast', authGuard, forecastController.getForecast);

module.exports = router;
