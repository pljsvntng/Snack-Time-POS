const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser } = require('../controllers/userController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, requireRole('admin'), getUsers);
router.post('/', verifyToken, requireRole('admin'), createUser);
router.put('/:id', verifyToken, requireRole('admin'), updateUser);

module.exports = router;
