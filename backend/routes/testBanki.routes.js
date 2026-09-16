const router = require('express').Router();
const c = require('../controllers/testBanki.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Baxış endpointləri
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.get('/:id/umumi-baxis', c.umumiBaxis);
router.get('/:id/cavabsiz-baxis', c.cavabsizBaxis);
router.get('/:id/dogru-cavabsiz-baxis', c.dogruCavabsizBaxis);

// CRUD
router.post('/', authorize('ADMIN', 'KAFEDRA'), c.create);
router.put('/:id', authorize('ADMIN', 'KAFEDRA'), c.update);
router.delete('/:id', authorize('ADMIN', 'KAFEDRA'), c.remove);

// Status əməliyyatları — yalnız Admin
router.post('/:id/tesdiqle', authorize('ADMIN'), c.tesdiqle);
router.post('/:id/tesdiqden-qaldir', authorize('ADMIN'), c.tesdiqdenQaldir);
router.post('/:id/redakteye-gonder', authorize('ADMIN'), c.redakyeyeGonder);
router.post('/:id/blok-toggle', authorize('ADMIN'), c.blokToggle);

module.exports = router;