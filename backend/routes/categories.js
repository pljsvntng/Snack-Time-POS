const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory } = require('../controllers/categoryController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, getCategories);
router.post('/', verifyToken, requireRole('admin'), createCategory);
router.put('/:id', verifyToken, requireRole('admin'), updateCategory);

module.exports = router;
