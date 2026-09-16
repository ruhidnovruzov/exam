const router = require('express').Router();
const c = require('../controllers/studentExam.controller');
const { authenticate } = require('../middleware/auth');

router.post('/login', c.login);
router.get('/me', authenticate, c.me);
router.get('/exams', authenticate, c.listExams);
router.get('/exams/:id', authenticate, c.getExam);
router.post('/exams/:id/questions/:questionId/answer', authenticate, c.answerQuestion);
router.post('/exams/:id/finish', authenticate, c.finishExam);

module.exports = router;
