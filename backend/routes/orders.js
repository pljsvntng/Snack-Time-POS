const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrder } = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

// Both admin and cashier can create orders and view history (cashiers see only their own)
router.post('/', verifyToken, createOrder);
router.get('/', verifyToken, getOrders);
router.get('/:id', verifyToken, getOrder);

module.exports = router;
