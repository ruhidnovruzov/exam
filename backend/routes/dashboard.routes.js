const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', controller.getStats);

module.exports = router;
