const router = require('express').Router();
const c = require('../controllers/telebe.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/bulk-upsert', authorize('ADMIN'), c.bulkUpsert);  // ETS-dən import
router.put('/:id', authorize('ADMIN'), c.update);

module.exports = router;