const router = require('express').Router();
const c = require('../controllers/muellim.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', c.getAll);
router.get('/:id', c.getOne);

module.exports = router;
