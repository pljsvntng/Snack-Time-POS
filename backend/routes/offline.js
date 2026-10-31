const router=require('express').Router();
const {verifyToken,requireRole}=require('../middleware/auth');
router.get('/bootstrap',verifyToken,requireRole('admin','cashier'),require('../controllers/offlineController').bootstrap);
module.exports=router;
