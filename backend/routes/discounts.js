const express = require('express');
const router = express.Router();
const { getDiscounts } = require('../controllers/discountController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, getDiscounts);

module.exports = router;
