const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct,
  deactivateProduct, restoreProduct, uploadImage, removeImage,
} = require('../controllers/productController');
const { getRecipe, setRecipe } = require('../controllers/inventoryController');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', verifyToken, getProducts);
router.get('/:id', verifyToken, getProduct);
router.post('/', verifyToken, requireRole('admin'), createProduct);
router.put('/:id', verifyToken, requireRole('admin'), updateProduct);
router.delete('/:id', verifyToken, requireRole('admin'), deactivateProduct);
router.patch('/:id/restore', verifyToken, requireRole('admin'), restoreProduct);

router.post('/:id/image', verifyToken, requireRole('admin'), upload.single('image'), uploadImage);
router.delete('/:id/image', verifyToken, requireRole('admin'), removeImage);

router.get('/:productId/recipe', verifyToken, requireRole('admin'), getRecipe);
router.put('/:productId/recipe', verifyToken, requireRole('admin'), setRecipe);

module.exports = router;
