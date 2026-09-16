const router = require('express').Router();
const c = require('../controllers/muellimYoxlama.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('MUELLIM'));

router.get('/imtahanlar', c.getMyAssignments);
router.get('/imtahanlar/:id/nobet', c.getPendingQueue);
router.post('/imtahanlar/:id/suallar/:sualId/qiymet', c.gradeQuestion);

module.exports = router;
