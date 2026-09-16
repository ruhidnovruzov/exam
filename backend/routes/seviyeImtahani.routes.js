const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/seviyeImtahani.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/student/login', c.studentLogin);
router.get('/student/exam', authenticate, c.getStudentExam);
router.post('/student/questions/:questionId/answer', authenticate, c.answerStudentQuestion);
router.post('/student/finish', authenticate, c.finishStudentExam);
router.post('/student/restart', authenticate, c.restartTestStudentExam);

router.use(authenticate, authorize('ADMIN'));
router.get('/', c.getConfig);
router.post('/', c.saveConfig);
router.post('/:id/muellimler', c.setEssayTeachers);
router.get('/:id/netice', c.getResults);
router.post('/:id/netice/:attemptId/speaking', c.setSpeakingScore);
router.post('/listening-audio', upload.single('audio'), c.uploadListeningAudio);
router.get('/:id/questions', c.getQuestions);
router.post('/:id/questions', c.createQuestion);
router.put('/:id/questions/:questionId', c.updateQuestion);
router.post('/:id/questions/import', upload.single('file'), c.importTestQuestions);
router.delete('/:id/questions/:questionId', c.removeQuestion);

module.exports = router;
