const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/seviyeYoxlama.controller');

router.use(authenticate, authorize('MUELLIM'));
router.get('/imtahanlar', c.getMyLevelAssignments);
router.get('/imtahanlar/:id/nobet', c.getLevelEssayQueue);
router.post('/essayler/:id/qiymet', c.gradeLevelEssay);

module.exports = router;
