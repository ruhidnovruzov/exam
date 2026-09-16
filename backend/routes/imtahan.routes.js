const router = require('express').Router();
const c = require('../controllers/imtahan.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.get('/:id/telebeler', c.getTelebeler);
router.get('/:id/neticeler', c.getNeticeler);
router.get('/:id/muellimler', c.getMuellimler);

router.post('/', authorize('ADMIN'), c.create);
router.put('/:id', authorize('ADMIN'), c.update);
router.delete('/:id', authorize('ADMIN'), c.remove);

// Tələbə təhkimi + sual paketi generasiyası
router.post('/:id/telebeler', authorize('ADMIN'), c.telebeElave);
router.post('/:id/muellimler', authorize('ADMIN'), c.assignMuellimler);

module.exports = router;