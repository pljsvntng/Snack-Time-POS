const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', require('../middleware/loginThrottle').createLoginThrottle(), login);
router.get('/me', verifyToken, me);

module.exports = router;
