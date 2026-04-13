const express = require('express');
const multer = require('multer');
const dataController = require('../controllers/dataController');
const { authGuard } = require('../middlewares/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-data', authGuard, upload.single('file'), dataController.uploadData);

module.exports = router;
