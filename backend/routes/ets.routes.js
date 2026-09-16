const router = require('express').Router();
const c = require('../controllers/ets.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/departments', c.getDepartments);
router.get('/subjects', c.getSubjects);
router.get('/topics', c.getTopics);
router.get('/subject-groups', c.getSubjectGroups);

module.exports = router;
