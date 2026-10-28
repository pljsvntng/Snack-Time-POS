const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, getSettings);
router.put('/', verifyToken, requireRole('admin'), updateSettings);

module.exports = router;
