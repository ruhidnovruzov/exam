const router = require('express').Router();
const c = require('../controllers/sual.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/statistika', c.statistika);  // ?testBankiId=
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', authorize('ADMIN', 'KAFEDRA'), c.create);
router.put('/:id', authorize('ADMIN', 'KAFEDRA'), c.update);
router.delete('/:id', authorize('ADMIN', 'KAFEDRA'), c.remove);

module.exports = router;