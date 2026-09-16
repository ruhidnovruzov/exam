const router = require('express').Router();
const c = require('../controllers/istifadeci.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('ADMIN'), c.getAll);
router.get('/:id', authorize('ADMIN'), c.getOne);
router.post('/', authorize('ADMIN'), c.create);
router.put('/:id', authorize('ADMIN'), c.update);
router.delete('/:id', authorize('ADMIN'), c.remove);

module.exports = router;