const express = require('express');
const AnalyzeController = require('../controllers/analyzeController');

const router = express.Router();

// 图像分析
router.post('/image', AnalyzeController.analyzeImage);

module.exports = router;