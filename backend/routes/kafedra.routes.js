const router = require('express').Router();
const c = require('../controllers/kafedra.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', authorize('ADMIN'), c.create);
router.put('/:id', authorize('ADMIN'), c.update);
router.delete('/:id', authorize('ADMIN'), c.remove);

module.exports = router;