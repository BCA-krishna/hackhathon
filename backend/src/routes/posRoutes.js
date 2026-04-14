const express = require('express');
const posController = require('../controllers/posController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/products', authGuard, posController.getProducts);
router.post('/sale', authGuard, posController.createSale);

module.exports = router;
