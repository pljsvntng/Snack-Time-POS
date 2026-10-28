const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', verifyToken, me);

module.exports = router;
