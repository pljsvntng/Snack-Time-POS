const express = require('express');
const router = express.Router();
const {
  getIngredients, createIngredient, updateIngredient, adjustStock, getTransactions,
} = require('../controllers/inventoryController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, requireRole('admin'), getIngredients);
router.post('/', verifyToken, requireRole('admin'), createIngredient);
router.put('/:id', verifyToken, requireRole('admin'), updateIngredient);
router.post('/adjust', verifyToken, requireRole('admin'), adjustStock);
router.get('/transactions', verifyToken, requireRole('admin'), getTransactions);

module.exports = router;
