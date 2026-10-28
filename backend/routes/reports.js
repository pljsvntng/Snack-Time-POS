const express = require('express');
const router = express.Router();
const { getDashboard, getDailyReport, getWeeklyReport, getMonthlyReport } = require('../controllers/reportController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/dashboard', verifyToken, requireRole('admin'), getDashboard);
router.get('/daily', verifyToken, requireRole('admin'), getDailyReport);
router.get('/weekly', verifyToken, requireRole('admin'), getWeeklyReport);
router.get('/monthly', verifyToken, requireRole('admin'), getMonthlyReport);

module.exports = router;
