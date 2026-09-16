const router = require('express').Router();
const c = require('../controllers/tedrisIl.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', c.getAll);
router.post('/', authorize('ADMIN'), c.create);
router.put('/:id/aktiv', authorize('ADMIN'), c.aktivEt);

module.exports = router;