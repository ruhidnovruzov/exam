const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const prisma = require('../prismaClient');
const { resolveStudent } = require('../services/etsAuthService');
const { verifyDailyExamPassword } = require('../services/dailyExamPasswordService');
const { ensureTeachersFromEtsIds } = require('../services/teacherSyncService');
const {
  DEFAULT_SHEET_NAME,
  parseSpeakingWorkbook,
  matchSpeakingRows,
} = require('../services/speakingImportService');

const normalize = (value) => String(value ?? '').trim();
const cellValue = (cell) => normalize(cell?.text ?? cell?.value);
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const normalizeOptionLabel = (value) => normalize(value).toUpperCase();

const normalizeTest = (variantlar, duzgunCavab) => {
  if (!Array.isArray(variantlar) || variantlar.length < 2 || variantlar.length > OPTION_LABELS.length) {
    throw Object.assign(new Error('Test sualı üçün 2-4 cavab variantı tələb olunur.'), { status: 400 });
  }
  const options = variantlar.map((variant, index) => ({
    label: normalizeOptionLabel(variant?.label) || OPTION_LABELS[index],
    text: normalize(variant?.text),
  }));
  const labels = options.map((option) => option.label);
  const correct = normalizeOptionLabel(duzgunCavab);
  if (options.some((option) => !option.text) || new Set(labels).size !== labels.length || !labels.includes(correct)) {
    throw Object.assign(new Error('Test variantları və düzgün cavab uyğun deyil.'), { status: 400 });
  }
  return { options, correct };
};

// A reading is one passage with several multiple-choice sub-questions. Keeping
// this structure in `variantlar` lets the existing question/answer tables remain
// backwards compatible while still saving every student selection together.
const normalizeReading = (variantlar, metn, readingNo) => {
  if (!variantlar || Array.isArray(variantlar) || typeof variantlar !== 'object') {
    throw Object.assign(new Error('Reading üçün mətn və suallar düzgün formatda göndərilməlidir.'), { status: 400 });
  }

  const number = Number(readingNo ?? variantlar.readingNo);
  if (![1, 2].includes(number)) {
    throw Object.assign(new Error('Reading nömrəsi 1 və ya 2 olmalıdır.'), { status: 400 });
  }
  const expectedQuestionCount = number === 1 ? 3 : 4;
  const sourceQuestions = variantlar.questions;
  if (!Array.isArray(sourceQuestions) || sourceQuestions.length !== expectedQuestionCount) {
    throw Object.assign(new Error(`Reading ${number} üçün tam ${expectedQuestionCount} sual daxil edilməlidir.`), { status: 400 });
  }

  const questions = sourceQuestions.map((item, index) => {
    const question = normalize(item?.question);
    const variants = item?.variants;
    const correct = normalizeOptionLabel(item?.correct);
    if (!question || !Array.isArray(variants) || variants.length !== 4 || !OPTION_LABELS.includes(correct)) {
      throw Object.assign(new Error(`Reading ${number}, sual ${index + 1}: mətn, 4 variant və düzgün cavab tələb olunur.`), { status: 400 });
    }

    const normalizedVariants = variants.map((variant, variantIndex) => ({
      label: normalizeOptionLabel(variant?.label) || OPTION_LABELS[variantIndex],
      text: normalize(variant?.text),
    }));
    if (
      normalizedVariants.some((variant, variantIndex) => variant.label !== OPTION_LABELS[variantIndex] || !variant.text) ||
      !normalizedVariants.some((variant) => variant.label === correct)
    ) {
      throw Object.assign(new Error(`Reading ${number}, sual ${index + 1}: A, B, C, D variantları tam doldurulmalıdır.`), { status: 400 });
    }
    return { question, variants: normalizedVariants, correct };
  });

  return {
    title: normalize(variantlar.title),
    readingText: normalize(metn),
    readingNo: number,
    questions,
  };
};

const normalizeListening = (variantlar, metn, listeningNo) => {
  const listeningLabels = ['A', 'B', 'C'];
  if (!variantlar || Array.isArray(variantlar) || typeof variantlar !== 'object') {
    throw Object.assign(new Error('Listening üçün audio və suallar düzgün formatda göndərilməlidir.'), { status: 400 });
  }
  const number = Number(listeningNo ?? variantlar.listeningNo);
  if (![1, 2].includes(number)) throw Object.assign(new Error('Listening nömrəsi 1 və ya 2 olmalıdır.'), { status: 400 });
  if (!Array.isArray(variantlar.questions) || variantlar.questions.length !== 4) {
    throw Object.assign(new Error(`Listening ${number} üçün tam 4 sual daxil edilməlidir.`), { status: 400 });
  }
  const questions = variantlar.questions.map((item, index) => {
    const question = normalize(item?.question);
    const correct = normalizeOptionLabel(item?.correct);
    if (!question || !Array.isArray(item?.variants) || item.variants.length !== 3 || !listeningLabels.includes(correct)) {
      throw Object.assign(new Error(`Listening ${number}, sual ${index + 1}: mətn, 3 variant və düzgün cavab tələb olunur.`), { status: 400 });
    }
    const variants = item.variants.map((variant, variantIndex) => ({ label: normalizeOptionLabel(variant?.label) || listeningLabels[variantIndex], text: normalize(variant?.text) }));
    if (variants.some((variant, variantIndex) => variant.label !== listeningLabels[variantIndex] || !variant.text) || !variants.some((variant) => variant.label === correct)) {
      throw Object.assign(new Error(`Listening ${number}, sual ${index + 1}: A, B, C variantları tam doldurulmalıdır.`), { status: 400 });
    }
    return { question, variants, correct };
  });
  return { listeningNo: number, listeningText: normalize(metn), questions };
};

const studentReading = (variantlar) => ({
  title: variantlar?.title || '',
  readingText: variantlar?.readingText || '',
  readingNo: variantlar?.readingNo || null,
  questions: Array.isArray(variantlar?.questions)
    ? variantlar.questions.map(({ question, variants }) => ({ question, variants }))
    : [],
});

const studentListening = (variantlar, metn) => {
  // Old listening records stored one question directly as an array of options.
  // Convert them as well, so already uploaded audio/questions still appear.
  if (Array.isArray(variantlar)) {
    return {
      listeningNo: null,
      listeningText: metn || '',
      questions: [{ question: metn || 'Listening sualı', variants: variantlar }],
    };
  }
  return {
    listeningNo: variantlar?.listeningNo || null,
    listeningText: variantlar?.listeningText || '',
    questions: Array.isArray(variantlar?.questions)
      ? variantlar.questions.map(({ question, variants }) => ({ question, variants }))
      : [],
  };
};

const parseReadingAnswer = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const questionUnitCount = (question) => {
  if (question.sualTipi === 'READING' || question.sualTipi === 'LISTENING') {
    return Array.isArray(question.variantlar?.questions) ? question.variantlar.questions.length : 1;
  }
  return 1;
};

const answeredUnitCount = (question, answer) => {
  if (!answer?.cavab) return 0;
  if (question.sualTipi === 'READING' || question.sualTipi === 'LISTENING') {
    const selections = parseReadingAnswer(answer.cavab);
    const count = Object.values(selections).filter((value) => Boolean(normalize(value))).length;
    return count;
  }
  if (question.sualTipi === 'ESSAY') {
    const essay = parseEssayAnswer(answer.cavab);
    return normalize(essay.topic) && normalize(essay.text) ? 1 : 0;
  }
  return normalize(answer.cavab) ? 1 : 0;
};

const normalizeEssayTopics = (variantlar) => {
  const topics = Array.isArray(variantlar?.essayTopics)
    ? variantlar.essayTopics.map(normalize).filter(Boolean)
    : [];
  if (topics.length !== 2 || new Set(topics.map((topic) => topic.toLocaleLowerCase())).size !== 2) {
    throw Object.assign(new Error('Essay üçün bir-birindən fərqli, tam 2 mövzu daxil edilməlidir.'), { status: 400 });
  }
  return { essayTopics: topics };
};

const parseEssayAnswer = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

// Student order must stay stable even if questions were created before the
// fixed-layout rules were introduced or were inserted in a different order.
const orderedStudentQuestions = (questions) => {
  const typeOrder = { LISTENING: 0, ESSAY: 1, TEST: 2, READING: 3 };
  const passageNumber = (question, field) => Number(question.variantlar?.[field] || 0);
  const sorted = [...questions].sort((a, b) => {
    const typeDifference = typeOrder[a.sualTipi] - typeOrder[b.sualTipi];
    if (typeDifference) return typeDifference;
    if (a.sualTipi === 'LISTENING') return passageNumber(a, 'listeningNo') - passageNumber(b, 'listeningNo');
    if (a.sualTipi === 'READING') return passageNumber(a, 'readingNo') - passageNumber(b, 'readingNo');
    return a.sira - b.sira;
  });

  let testNumber = 10;
  let legacyListeningNumber = 0;
  return sorted.map((question) => {
    let sira = question.sira;
    if (question.sualTipi === 'LISTENING') {
      const number = passageNumber(question, 'listeningNo') || ++legacyListeningNumber;
      sira = number === 1 ? 1 : 5;
    }
    if (question.sualTipi === 'ESSAY') sira = 9;
    if (question.sualTipi === 'TEST') sira = testNumber++;
    if (question.sualTipi === 'READING') sira = passageNumber(question, 'readingNo') === 1 ? 35 : 38;
    return { ...question, sira };
  });
};

const activeExam = () => prisma.seviyeImtahani.findFirst({
  where: { aktiv: true },
  orderBy: { yenilendi: 'desc' },
});

const getExams = async (_req, res) => {
  const exams = await prisma.seviyeImtahani.findMany({
    include: {
      seriya: { select: { id: true, ad: true } },
      _count: { select: { suallar: true, cehdler: true } },
    },
    orderBy: [{ baslamaVaxti: 'desc' }, { id: 'desc' }],
  });
  res.json(exams);
};

const hasSubmittedEssay = (answer) => {
  const essay = parseEssayAnswer(answer?.cavab);
  return Boolean(normalize(essay.topic) && normalize(essay.text));
};

const distributeLevelEssays = async (examId, { redistribute = false } = {}) => {
  const teachers = await prisma.seviyeImtahanMuellim.findMany({
    where: { seviyeImtahanId: examId }, orderBy: { muellimId: 'asc' },
  });
  if (!teachers.length) return;

  if (redistribute) {
    await prisma.seviyeEssayYoxlama.deleteMany({
      where: { yoxlanildi: null, cehd: { seviyeImtahanId: examId } },
    });
  }

  const answers = await prisma.seviyeCavab.findMany({
    where: { sual: { seviyeImtahanId: examId, sualTipi: 'ESSAY' }, cehd: { cixisVaxti: { not: null } } },
    include: { cehd: true, sual: true, essayYoxlama: true },
    orderBy: { cehdId: 'asc' },
  });
  const pending = answers.filter((answer) => hasSubmittedEssay(answer) && !answer.essayYoxlama);
  if (!pending.length) return;

  const workload = new Map(teachers.map((teacher) => [teacher.muellimId, 0]));
  const existing = await prisma.seviyeEssayYoxlama.groupBy({
    by: ['muellimId'],
    where: { cehd: { seviyeImtahanId: examId } },
    _count: { _all: true },
  });
  existing.forEach((row) => workload.set(row.muellimId, row._count._all));

  for (const answer of pending) {
    const teacher = teachers.reduce((selected, candidate) =>
      workload.get(candidate.muellimId) < workload.get(selected.muellimId) ? candidate : selected
    );
    await prisma.seviyeEssayYoxlama.create({
      data: { cehdId: answer.cehdId, sualId: answer.sualId, cavabId: answer.id, muellimId: teacher.muellimId },
    });
    workload.set(teacher.muellimId, (workload.get(teacher.muellimId) || 0) + 1);
  }
};

const ensureLevelStudent = (req, res) => {
  if (req.user?.rol !== 'LEVEL_STUDENT' || !req.user?.levelAttemptId) {
    res.status(403).json({ message: 'Bu əməliyyat yalnız səviyyə imtahanı tələbəsi üçündür.' });
    return null;
  }
  return Number(req.user.levelAttemptId);
};

const getConfig = async (_req, res) => {
  const exam = await prisma.seviyeImtahani.findFirst({
    orderBy: { yenilendi: 'desc' },
    include: {
      muellimler: { include: { muellim: { select: { id: true, ad: true, soyad: true, username: true, etsId: true } } }, orderBy: { muellim: { soyad: 'asc' } } },
      _count: { select: { suallar: true, cehdler: true } },
    },
  });
  res.json(exam);
};

const getConfigById = async (req, res) => {
  const exam = await prisma.seviyeImtahani.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      seriya: { select: { id: true, ad: true } },
      muellimler: { include: { muellim: { select: { id: true, ad: true, soyad: true, username: true, etsId: true } } }, orderBy: { muellim: { soyad: 'asc' } } },
      _count: { select: { suallar: true, cehdler: true } },
    },
  });
  if (!exam) return res.status(404).json({ message: 'Səviyyə imtahanı tapılmadı.' });
  res.json(exam);
};

const setEssayTeachers = async (req, res) => {
  const examId = Number(req.params.id);
  const etsTeacherIds = [...new Set((req.body.etsTeacherIds || []).map(String).filter(Boolean))];
  if (!etsTeacherIds.length) return res.status(400).json({ message: 'Ən azı bir müəllim seçilməlidir.' });
  const exam = await prisma.seviyeImtahani.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exam) return res.status(404).json({ message: 'Səviyyə imtahanı tapılmadı.' });
  try {
    const teachers = await ensureTeachersFromEtsIds(etsTeacherIds);
    const teacherIds = teachers.map((teacher) => teacher.istifadeci.id);
    await prisma.$transaction(async (tx) => {
      await tx.seviyeImtahanMuellim.deleteMany({ where: { seviyeImtahanId: examId, muellimId: { notIn: teacherIds } } });
      for (const teacher of teachers) {
        await tx.seviyeImtahanMuellim.upsert({
          where: { seviyeImtahanId_muellimId: { seviyeImtahanId: examId, muellimId: teacher.istifadeci.id } },
          create: { seviyeImtahanId: examId, muellimId: teacher.istifadeci.id, etsTeacherId: String(teacher.etsId) },
          update: { etsTeacherId: String(teacher.etsId) },
        });
      }
    });
    await distributeLevelEssays(examId, { redistribute: true });
    const assignments = await prisma.seviyeImtahanMuellim.findMany({
      where: { seviyeImtahanId: examId }, include: { muellim: { select: { id: true, ad: true, soyad: true, username: true, etsId: true } } },
    });
    res.json({ message: `${assignments.length} müəllim təhkim olundu.`, assignments });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Müəllimlər təhkim edilə bilmədi.' });
  }
};

const getResults = async (req, res) => {
  const examId = Number(req.params.id);
  const attempts = await prisma.seviyeCehd.findMany({
    where: { seviyeImtahanId: examId },
    include: { essayYoxlamalari: { include: { muellim: { select: { ad: true, soyad: true } } } } },
    orderBy: [{ soyad: 'asc' }, { ad: 'asc' }],
  });

  // `etsStudentId` ETS-dəki daxili tələbə ID-sidir, FİN deyil. Həm yeni, həm
  // də əvvəlki cəhdlər üçün FİN-i ETS tələbə profilindəki `pin` sahəsindən alırıq.
  const attemptsWithProfiles = await Promise.all(attempts.map(async (attempt) => {
    try {
      const ets = await resolveStudent(attempt.etsStudentId);
      return {
        attempt,
        fin: ets.profile?.pin || null,
        facultyName: ets.profile?.faculty?.name || null,
        specialtyName: ets.profile?.specialty?.name || null,
        groupName: ets.profile?.group?.name || attempt.qrup || null,
      };
    } catch {
      // ETS müvəqqəti əlçatan olmadıqda daxili ID-ni FİN kimi göstərməyək.
      return { attempt, fin: null, facultyName: null, specialtyName: null, groupName: attempt.qrup || null };
    }
  }));

  res.json(attemptsWithProfiles.map(({ attempt, fin, facultyName, specialtyName, groupName }) => {
    const essay = attempt.essayYoxlamalari[0];
    return {
      id: attempt.id, ad: attempt.ad, soyad: attempt.soyad, fin,
      facultyName, specialtyName, groupName,
      score: Number(attempt.bal || 0), finishedAt: attempt.cixisVaxti,
      speakingScore: attempt.speakingBal == null ? null : Number(attempt.speakingBal),
      essay: essay ? { assigned: true, graded: Boolean(essay.yoxlanildi), score: essay.bal, teacher: `${essay.muellim.ad} ${essay.muellim.soyad}` } : { assigned: false, graded: false },
    };
  }));
};

const setSpeakingScore = async (req, res) => {
  const examId = Number(req.params.id);
  const attemptId = Number(req.params.attemptId);
  const speakingScore = Number(req.body.bal);
  if (!Number.isFinite(speakingScore) || speakingScore < 0 || speakingScore > 5) {
    return res.status(400).json({ message: 'Speaking balı 0–5 aralığında olmalıdır.' });
  }
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SeviyeCehd" WHERE id = ${attemptId} FOR UPDATE`;
      const attempt = await tx.seviyeCehd.findFirst({ where: { id: attemptId, seviyeImtahanId: examId } });
      if (!attempt) throw Object.assign(new Error('Tələbənin imtahan nəticəsi tapılmadı.'), { status: 404 });
      if (!attempt.cixisVaxti) throw Object.assign(new Error('Speaking balı yalnız yekunlaşmış imtahana yazıla bilər.'), { status: 409 });
      const answerTotal = await tx.seviyeCavab.aggregate({ where: { cehdId: attemptId }, _sum: { bal: true } });
      return tx.seviyeCehd.update({
        where: { id: attemptId },
        data: { speakingBal: speakingScore, bal: Number(answerTotal._sum.bal || 0) + speakingScore },
      });
    });
    res.json({ message: 'Speaking balı yadda saxlanıldı.', speakingScore: Number(updated.speakingBal), score: Number(updated.bal || 0) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Speaking balı yadda saxlanmadı.' });
  }
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
};

const levelForScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 50) return { level: 'Yoxlanmalıdır', note: '—' };
  if (score < 16) return { level: 'Beginner', note: 'A1' };
  if (score < 25) return { level: 'Elementary', note: 'A2' };
  if (score < 33) return { level: 'Pre-intermediate', note: 'B1' };
  if (score < 40) return { level: 'Intermediate', note: 'B1+/B2' };
  if (score < 46) return { level: 'Upper Intermediate', note: 'B2' };
  return { level: 'Advanced', note: 'C1/C2' };
};

const exportLevelResults = async (req, res) => {
  const examId = Number(req.params.id);
  if (!Number.isInteger(examId) || examId <= 0) return res.status(400).json({ message: 'İmtahan ID-si düzgün deyil.' });

  try {
    const selectedExam = await prisma.seviyeImtahani.findUnique({
      where: { id: examId },
      select: { id: true, seriyaId: true, ad: true },
    });
    if (!selectedExam) return res.status(404).json({ message: 'Səviyyə imtahanı tapılmadı.' });

    const sessions = selectedExam.seriyaId
      ? await prisma.seviyeImtahani.findMany({ where: { seriyaId: selectedExam.seriyaId }, select: { id: true } })
      : [{ id: selectedExam.id }];

    const attempts = await prisma.seviyeCehd.findMany({
      where: {
        cixisVaxti: { not: null },
        seviyeImtahanId: { in: sessions.map((session) => session.id) },
      },
      select: { etsStudentId: true, ad: true, soyad: true, qrup: true, bal: true },
      orderBy: [{ soyad: 'asc' }, { ad: 'asc' }],
    });

    const rows = await mapWithConcurrency(attempts, 10, async (attempt) => {
      let profile = null;
      try {
        profile = (await resolveStudent(attempt.etsStudentId)).profile;
      } catch {
        // ETS əlçatan olmadıqda hesabat yenə hazırlanır; məlum olmayan xanalar boş qalır.
      }
      const score = Number(attempt.bal || 0);
      return {
        fullName: `${attempt.ad} ${attempt.soyad}`.trim(),
        lastName: attempt.soyad,
        fin: profile?.pin || '',
        faculty: profile?.faculty?.name || '',
        specialty: profile?.specialty?.name || '',
        group: profile?.group?.name || attempt.qrup || '',
        score,
        ...levelForScore(score),
      };
    });

    rows.sort((left, right) => left.lastName.localeCompare(right.lastName, 'az') || left.fullName.localeCompare(right.fullName, 'az'));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'İmtahan sistemi';
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const sheet = workbook.addWorksheet('Nəticələr', {
      views: [{ state: 'frozen', ySplit: 2 }],
      properties: { defaultRowHeight: 20 },
    });
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'Tələbə məlumatları';
    sheet.mergeCells('F1:H1');
    sheet.getCell('F1').value = 'İngilis dili səviyyəsi';
    sheet.getRow(2).values = ['Ad, soyad', 'FİN', 'Fakültə', 'İxtisas', 'Akademik qrup', 'Total score', 'Level', 'Note'];

    for (const item of rows) {
      sheet.addRow([item.fullName, item.fin, item.faculty, item.specialty, item.group, item.score, item.level, item.note]);
    }

    const darkBlue = 'FF1E3A5F';
    const lightBlue = 'FFDCE6F1';
    for (const rowNumber of [1, 2]) {
      const row = sheet.getRow(rowNumber);
      row.height = rowNumber === 1 ? 27 : 25;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true, color: { argb: rowNumber === 1 ? 'FFFFFFFF' : 'FF17324D' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 1 ? darkBlue : lightBlue } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF9FB3C8' } } };
      });
    }
    sheet.columns = [
      { width: 28 }, { width: 14 }, { width: 34 }, { width: 36 },
      { width: 18 }, { width: 13 }, { width: 22 }, { width: 12 },
    ];
    sheet.autoFilter = { from: 'A2', to: `H${Math.max(2, rows.length + 2)}` };
    sheet.getColumn(6).numFmt = '0.0';
    sheet.getColumn(6).alignment = { horizontal: 'center' };
    sheet.getColumn(8).alignment = { horizontal: 'center' };
    for (let rowNumber = 3; rowNumber <= rows.length + 2; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.alignment = { vertical: 'middle' };
      if (rowNumber % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FA' } };
        });
      }
    }

    const rubric = workbook.addWorksheet('Səviyyə bölgüsü', { views: [{ state: 'frozen', ySplit: 1 }] });
    rubric.addRow(['Total score', 'Level', 'Note']);
    [
      ['0–15', 'Beginner', 'A1'],
      ['16–24', 'Elementary', 'A2'],
      ['25–32', 'Pre-intermediate', 'B1'],
      ['33–39', 'Intermediate', 'B1+/B2'],
      ['40–45', 'Upper Intermediate', 'B2'],
      ['46–50', 'Advanced', 'C1/C2'],
    ].forEach((item) => rubric.addRow(item));
    rubric.columns = [{ width: 18 }, { width: 25 }, { width: 14 }];
    rubric.getRow(1).height = 26;
    rubric.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkBlue } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    rubric.getColumn(1).alignment = { horizontal: 'center' };
    rubric.getColumn(3).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''ingilis-dili-seviyye-neticesi.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Excel hesabatı hazırlana bilmədi.' });
  }
};

const importSpeakingScores = async (req, res) => {
  const examId = Number(req.params.id);
  const dryRun = String(req.query.dryRun ?? 'true').toLowerCase() !== 'false';
  const overwrite = String(req.query.overwrite ?? 'false').toLowerCase() === 'true';
  const sheetName = normalize(req.body?.sheetName || req.query.sheetName) || DEFAULT_SHEET_NAME;

  if (!Number.isInteger(examId) || examId <= 0) return res.status(400).json({ message: 'İmtahan ID-si düzgün deyil.' });
  if (!req.file?.buffer) return res.status(400).json({ message: 'XLSX faylı tələb olunur.' });
  if (!dryRun && req.query.confirm !== 'APPLY') {
    return res.status(400).json({ message: 'Yazmaq üçün dryRun=false və confirm=APPLY göndərilməlidir.' });
  }

  try {
    const exam = await prisma.seviyeImtahani.findUnique({ where: { id: examId }, select: { id: true, ad: true } });
    if (!exam) return res.status(404).json({ message: 'Səviyyə imtahanı tapılmadı.' });

    const parsed = await parseSpeakingWorkbook(req.file.buffer, sheetName);
    const attempts = await prisma.seviyeCehd.findMany({
      where: { seviyeImtahanId: examId, cixisVaxti: { not: null } },
      select: { id: true, etsStudentId: true, ad: true, soyad: true, speakingBal: true },
    });

    let profileFailures = 0;
    const candidates = await mapWithConcurrency(attempts, 10, async (attempt) => {
      try {
        const ets = await resolveStudent(attempt.etsStudentId);
        return {
          attemptId: attempt.id,
          firstName: ets.profile?.firstName || attempt.ad,
          lastName: ets.profile?.lastName || attempt.soyad,
          fatherName: ets.profile?.fatherName || '',
          currentSpeakingScore: attempt.speakingBal == null ? null : Number(attempt.speakingBal),
        };
      } catch {
        profileFailures += 1;
        return {
          attemptId: attempt.id,
          firstName: attempt.ad,
          lastName: attempt.soyad,
          fatherName: '',
          currentSpeakingScore: attempt.speakingBal == null ? null : Number(attempt.speakingBal),
        };
      }
    });

    const plan = matchSpeakingRows(parsed.scoredRows, candidates);
    const candidateByAttemptId = new Map(candidates.map((item) => [item.attemptId, item]));
    const unchanged = [];
    const conflicts = [];
    const ready = [];
    for (const match of plan.matches) {
      const current = candidateByAttemptId.get(match.attemptId)?.currentSpeakingScore;
      if (current != null && current === match.score) unchanged.push({ ...match, currentSpeakingScore: current });
      else if (current != null && !overwrite) conflicts.push({ ...match, currentSpeakingScore: current, reason: 'existing_score_not_overwritten' });
      else ready.push({ ...match, currentSpeakingScore: current });
    }

    let updated = 0;
    if (!dryRun && ready.length) {
      await prisma.$transaction(async (tx) => {
        for (const item of ready) {
          await tx.$queryRaw`SELECT id FROM "SeviyeCehd" WHERE id = ${item.attemptId} FOR UPDATE`;
          const attempt = await tx.seviyeCehd.findFirst({
            where: { id: item.attemptId, seviyeImtahanId: examId, cixisVaxti: { not: null } },
            select: { id: true, speakingBal: true },
          });
          if (!attempt) throw Object.assign(new Error(`Cəhd artıq yazıla bilən vəziyyətdə deyil: ${item.attemptId}`), { status: 409 });
          if (attempt.speakingBal != null && !overwrite) {
            throw Object.assign(new Error(`Mövcud Speaking balı dəyişib: ${item.attemptId}`), { status: 409 });
          }
          const answerTotal = await tx.seviyeCavab.aggregate({ where: { cehdId: item.attemptId }, _sum: { bal: true } });
          await tx.seviyeCehd.update({
            where: { id: item.attemptId },
            data: { speakingBal: item.score, bal: Number(answerTotal._sum.bal || 0) + item.score },
          });
          updated += 1;
        }
      }, { maxWait: 10000, timeout: 120000 });
    }

    res.json({
      message: dryRun ? 'Dry-run tamamlandı; bazada dəyişiklik edilmədi.' : `${updated} Speaking balı yazıldı.`,
      dryRun,
      overwrite,
      exam,
      sheetName: parsed.sheetName,
      summary: {
        sheetRows: parsed.scoredRows.length + parsed.skippedRows.length,
        numericScores: parsed.scoredRows.length,
        zeroScores: parsed.scoredRows.filter((item) => item.score === 0).length,
        skippedBlank: parsed.skippedRows.filter((item) => item.reason === 'blank_score').length,
        skippedText: parsed.skippedRows.filter((item) => item.reason === 'non_numeric_score').length,
        skippedInvalid: parsed.skippedRows.filter((item) => !['blank_score', 'non_numeric_score'].includes(item.reason)).length,
        finishedExamAttempts: attempts.length,
        etsProfileFailures: profileFailures,
        exactMatches: plan.matches.length,
        readyToWrite: ready.length,
        unchanged: unchanged.length,
        existingScoreConflicts: conflicts.length,
        unresolved: plan.unresolved.length,
        updated,
      },
      ready,
      unchanged,
      conflicts,
      unresolved: plan.unresolved,
      skippedRows: parsed.skippedRows,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || 'Speaking balları import edilə bilmədi.',
      ...(error.availableSheets ? { availableSheets: error.availableSheets } : {}),
    });
  }
};

const saveConfig = async (req, res) => {
  const { id, ad, muddet, baslamaVaxti, bitmeVaxti, aktiv, seriyaId } = req.body;
  if (!ad || !muddet || !baslamaVaxti || !bitmeVaxti) {
    return res.status(400).json({ message: 'Ad, müddət, başlama və bitmə vaxtı tələb olunur.' });
  }
  const data = { ad: normalize(ad), muddet: Number(muddet), baslamaVaxti: new Date(baslamaVaxti), bitmeVaxti: new Date(bitmeVaxti), aktiv: Boolean(aktiv) };
  if (!Number.isInteger(data.muddet) || data.muddet <= 0 || Number.isNaN(data.baslamaVaxti.getTime()) || Number.isNaN(data.bitmeVaxti.getTime())) {
    return res.status(400).json({ message: 'Müddət və tarixlər düzgün formatda olmalıdır.' });
  }
  if (data.bitmeVaxti <= data.baslamaVaxti) return res.status(400).json({ message: 'Bitmə vaxtı başlama vaxtından sonra olmalıdır.' });

  try {
    const exam = await prisma.$transaction(async (tx) => {
      if (id) {
        const existing = await tx.seviyeImtahani.findUnique({ where: { id: Number(id) }, select: { id: true, seriyaId: true } });
        if (!existing) throw Object.assign(new Error('Səviyyə imtahanı tapılmadı.'), { status: 404 });
      }
      if (data.aktiv) await tx.seviyeImtahani.updateMany({ where: id ? { id: { not: Number(id) } } : undefined, data: { aktiv: false } });
      if (id) return tx.seviyeImtahani.update({ where: { id: Number(id) }, data });

      let targetSeriesId = Number(seriyaId) || null;
      if (!targetSeriesId) {
        const latest = await tx.seviyeImtahani.findFirst({ where: { seriyaId: { not: null } }, orderBy: { yaradildi: 'desc' }, select: { seriyaId: true } });
        targetSeriesId = latest?.seriyaId || null;
      }
      if (!targetSeriesId) {
        const series = await tx.seviyeImtahanSeriyasi.create({ data: { ad: data.ad } });
        targetSeriesId = series.id;
      }
      const aggregate = await tx.seviyeImtahani.aggregate({ where: { seriyaId: targetSeriesId }, _max: { sessiyaNo: true } });
      return tx.seviyeImtahani.create({ data: { ...data, seriyaId: targetSeriesId, sessiyaNo: Number(aggregate._max.sessiyaNo || 0) + 1 } });
    });
    res.json(exam);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'İmtahan tənzimləmələri saxlanmadı.' });
  }
};

const getQuestions = async (req, res) => {
  const examId = Number(req.params.id);
  const questions = await prisma.seviyeSual.findMany({ where: { seviyeImtahanId: examId }, orderBy: { sira: 'asc' } });
  res.json(questions);
};

const uploadListeningAudio = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'M4A audio faylı seçilməyib.' });
  const extension = path.extname(req.file.originalname).toLowerCase();
  if (extension !== '.m4a') return res.status(400).json({ message: 'Yalnız .m4a audio faylı yüklənə bilər.' });
  if (req.file.buffer.length < 12 || req.file.buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
    return res.status(400).json({ message: 'Fayl etibarlı M4A audio formatında deyil.' });
  }
  try {
    const directory = path.join(__dirname, '..', 'public', 'uploads', 'listening');
    await fs.mkdir(directory, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.m4a`;
    await fs.writeFile(path.join(directory, filename), req.file.buffer);
    res.status(201).json({ url: `${req.protocol}://${req.get('host')}/uploads/listening/${filename}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Audio faylı yüklənə bilmədi.' });
  }
};

const createQuestion = async (req, res) => {
  const examId = Number(req.params.id);
  const { sualTipi, kateqoriya, seviye, metn, mediaUrl, variantlar, duzgunCavab, bal, sira, readingNo, listeningNo } = req.body;
  if (!['TEST', 'LISTENING', 'READING', 'ESSAY'].includes(sualTipi)) {
    return res.status(400).json({ message: 'Düzgün sual tipi tələb olunur.' });
  }
  // Essays may not have a main `metn` (we store topics inside `variantlar`), but other types require text
  if (!['ESSAY', 'LISTENING'].includes(sualTipi) && !metn) {
    return res.status(400).json({ message: 'Sual mətnləri tələb olunur.' });
  }
  if (sualTipi === 'LISTENING' && !mediaUrl) {
    return res.status(400).json({ message: 'Listening üçün M4A audio faylı/linki tələb olunur.' });
  }
  let variantData = variantlar || null;
  let correctAnswer = duzgunCavab || null;
  try {
    if (sualTipi === 'TEST') {
      const normalizedTest = normalizeTest(variantlar, duzgunCavab);
      variantData = normalizedTest.options;
      correctAnswer = normalizedTest.correct;
    }
    if (sualTipi === 'READING') variantData = normalizeReading(variantlar, metn, readingNo);
    if (sualTipi === 'LISTENING') variantData = normalizeListening(variantlar, metn, listeningNo);
    if (sualTipi === 'ESSAY') variantData = normalizeEssayTopics(variantlar);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  const exam = await prisma.seviyeImtahani.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exam) return res.status(404).json({ message: 'Səviyyə imtahanı tapılmadı.' });
  if (sualTipi === 'ESSAY') {
    const existingEssay = await prisma.seviyeSual.findFirst({ where: { seviyeImtahanId: examId, sualTipi: 'ESSAY' }, select: { id: true } });
    if (existingEssay) return res.status(400).json({ message: 'Bu imtahan üçün essay mövzuları artıq əlavə olunub.' });
  }
  if (sualTipi === 'LISTENING') {
    // Keep this check in JavaScript so it also works with existing JSON values
    // created by earlier versions of the level-exam module.
    const existingListenings = await prisma.seviyeSual.findMany({ where: { seviyeImtahanId: examId, sualTipi: 'LISTENING' }, select: { id: true, variantlar: true } });
    if (existingListenings.some((item) => Number(item.variantlar?.listeningNo) === variantData.listeningNo)) {
      return res.status(400).json({ message: `Listening ${variantData.listeningNo} artıq əlavə olunub.` });
    }
  }

  const question = await prisma.seviyeSual.create({
    data: {
      seviyeImtahanId: examId,
      sualTipi,
      kateqoriya: kateqoriya || null,
      seviye: seviye || null,
      metn: metn || '',
      mediaUrl: mediaUrl || null,
      variantlar: variantData,
      duzgunCavab: correctAnswer,
      bal: sualTipi === 'ESSAY' ? 5 : 1,
      // Fixed exam layout: listening 1-8, essay 9, imported tests 10-34, reading 35-41.
      sira: sualTipi === 'LISTENING' ? (variantData.listeningNo === 1 ? 1 : 5) : sualTipi === 'ESSAY' ? 9 : sualTipi === 'READING' ? (variantData.readingNo === 1 ? 35 : 38) : Number(sira || 0),
    },
  });
  res.status(201).json(question);
};

const updateQuestion = async (req, res) => {
  const examId = Number(req.params.id);
  const questionId = Number(req.params.questionId);
  const existing = await prisma.seviyeSual.findFirst({ where: { id: questionId, seviyeImtahanId: examId } });
  if (!existing) return res.status(404).json({ message: 'Sual tapılmadı.' });
  const { sualTipi = existing.sualTipi, kateqoriya, seviye, metn, mediaUrl, variantlar, duzgunCavab, bal, sira, readingNo, listeningNo } = req.body;
  if (!['TEST', 'LISTENING', 'READING', 'ESSAY'].includes(sualTipi)) return res.status(400).json({ message: 'Düzgün sual tipi tələb olunur.' });
  if (!['ESSAY', 'LISTENING'].includes(sualTipi) && !metn) return res.status(400).json({ message: 'Sual mətnləri tələb olunur.' });
  if (sualTipi === 'LISTENING' && !mediaUrl) return res.status(400).json({ message: 'Listening üçün M4A audio faylı/linki tələb olunur.' });
  let variantData = variantlar || null;
  let correctAnswer = duzgunCavab || null;
  try {
    if (sualTipi === 'TEST') {
      const normalizedTest = normalizeTest(variantlar, duzgunCavab);
      variantData = normalizedTest.options;
      correctAnswer = normalizedTest.correct;
    }
    if (sualTipi === 'READING') variantData = normalizeReading(variantlar, metn, readingNo);
    if (sualTipi === 'LISTENING') variantData = normalizeListening(variantlar, metn, listeningNo);
    if (sualTipi === 'ESSAY') variantData = normalizeEssayTopics(variantlar);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
  if (sualTipi === 'ESSAY') {
    const duplicate = await prisma.seviyeSual.findFirst({ where: { seviyeImtahanId: examId, sualTipi: 'ESSAY', id: { not: questionId } }, select: { id: true } });
    if (duplicate) return res.status(400).json({ message: 'Bu imtahan üçün yalnız bir essay bloku ola bilər.' });
  }
  if (sualTipi === 'LISTENING') {
    const others = await prisma.seviyeSual.findMany({ where: { seviyeImtahanId: examId, sualTipi: 'LISTENING', id: { not: questionId } }, select: { variantlar: true } });
    if (others.some((item) => Number(item.variantlar?.listeningNo) === variantData.listeningNo)) return res.status(400).json({ message: `Listening ${variantData.listeningNo} artıq mövcuddur.` });
  }
  const question = await prisma.seviyeSual.update({ where: { id: questionId }, data: {
    sualTipi, kateqoriya: kateqoriya || null, seviye: seviye || null, metn: metn || '', mediaUrl: mediaUrl || null, variantlar: variantData, duzgunCavab: correctAnswer,
    bal: sualTipi === 'ESSAY' ? 5 : Number(bal || 1),
    sira: sualTipi === 'LISTENING' ? (variantData.listeningNo === 1 ? 1 : 5) : sualTipi === 'ESSAY' ? 9 : sualTipi === 'READING' ? (variantData.readingNo === 1 ? 35 : 38) : Number(sira || existing.sira),
  } });
  res.json(question);
};

const removeQuestion = async (req, res) => {
  const examId = Number(req.params.id);
  const questionId = Number(req.params.questionId);
  const question = await prisma.seviyeSual.findFirst({ where: { id: questionId, seviyeImtahanId: examId }, select: { id: true } });
  if (!question) return res.status(404).json({ message: 'Sual tapılmadı.' });
  await prisma.seviyeSual.delete({ where: { id: questionId } });
  res.json({ message: 'Sual silindi.' });
};

const importTestQuestions = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Excel faylı seçilməyib.' });
  const examId = Number(req.params.id);
  try {
    const exam = await prisma.seviyeImtahani.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) return res.status(404).json({ message: 'Səviyyə imtahanı tapılmadı.' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ message: 'Excel-də worksheet tapılmadı.' });

    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 3) return;
      const question = cellValue(row.getCell(4));
      if (!question) return;
      const answer = cellValue(row.getCell(9)).toUpperCase().replace(/[^A-D]/g, '');
      const variants = ['A', 'B', 'C', 'D'].map((label, index) => ({ label, text: cellValue(row.getCell(index + 5)) })).filter((item) => item.text);
      if (variants.length < 2 || !answer || !variants.some((item) => item.label === answer)) {
        throw Object.assign(new Error(`${rowNumber}-ci sətirdə variant və ya düzgün cavab yanlışdır.`), { status: 400 });
      }
      rows.push({
        seviyeImtahanId: examId,
        sualTipi: 'TEST',
        kateqoriya: cellValue(row.getCell(2)) || null,
        seviye: cellValue(row.getCell(3)) || null,
        metn: question,
        variantlar: variants,
        duzgunCavab: answer,
        bal: 1,
        sira: rows.length + 1,
      });
    });
    if (rows.length !== 25) return res.status(400).json({ message: 'Excel-də tam 25 qrammatika/vocabulary sualı olmalıdır.' });
    const existingTests = await prisma.seviyeSual.count({ where: { seviyeImtahanId: examId, sualTipi: 'TEST' } });
    if (existingTests) return res.status(400).json({ message: 'Bu imtahan üçün Excel sualları artıq import edilib.' });
    rows.forEach((row, index) => { row.sira = index + 10; row.bal = 1; });
    await prisma.seviyeSual.createMany({ data: rows });
    res.status(201).json({ message: `${rows.length} test sualı import edildi.`, imported: rows.length });
  } catch (error) {
    res.status(error?.status || 500).json({ message: error.message || 'Excel importu zamanı xəta baş verdi.' });
  }
};

const studentLogin = async (req, res) => {
  const identifier = req.body.identifier || req.body.username;
  const password = req.body.password;
  if (!identifier || !password) return res.status(400).json({ message: 'Login və imtahan şifrəsi tələb olunur.' });
  try {
    const ets = await resolveStudent(identifier);
    if (!verifyDailyExamPassword(ets.studentId, password)) return res.status(401).json({ message: 'ETS kabinetindəki günlük imtahan şifrəsi yanlışdır.' });
    const profile = ets.profile || {};
    if (Number(profile.course) !== 1 || String(profile.educationLevel).toUpperCase() !== 'BACHELOR') {
      return res.status(403).json({ message: 'Səviyyə imtahanına yalnız I kurs bakalavr tələbələri daxil ola bilər.' });
    }
    const exam = await activeExam();
    if (!exam) return res.status(404).json({ message: 'Aktiv səviyyə imtahanı yoxdur.' });
    const now = new Date();
    if (now < exam.baslamaVaxti || now > exam.bitmeVaxti) {
      return res.status(403).json({ message: 'İmtahan hazırda giriş üçün açıq deyil.' });
    }
    const testIdentifiers = (process.env.LEVEL_EXAM_TEST_IDENTIFIERS || '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const isTestAccount = testIdentifiers.includes(String(identifier).trim().toUpperCase());
    const studentId = String(ets.studentId);
    let attempt;
    if (isTestAccount || !exam.seriyaId) {
      attempt = await prisma.seviyeCehd.upsert({
        where: { seviyeImtahanId_etsStudentId: { seviyeImtahanId: exam.id, etsStudentId: studentId } },
        update: {},
        create: { seviyeImtahanId: exam.id, etsStudentId: studentId, ad: profile.firstName || '', soyad: profile.lastName || '', qrup: profile.group?.name || profile.groupName || null },
      });
    } else {
      try {
        attempt = await prisma.$transaction(async (tx) => {
          const existingClaim = await tx.seviyeImtahanIstirak.findUnique({
            where: { seriyaId_etsStudentId: { seriyaId: exam.seriyaId, etsStudentId: studentId } },
          });
          if (existingClaim) {
            const existingAttempt = existingClaim.cehdId
              ? await tx.seviyeCehd.findUnique({ where: { id: existingClaim.cehdId } })
              : null;
            if (existingAttempt?.seviyeImtahanId === exam.id) return existingAttempt;
            throw Object.assign(new Error('Səviyyə imtahanında iştirak hüququndan artıq istifadə etmisiniz.'), { status: 403 });
          }
          const created = await tx.seviyeCehd.create({
            data: { seviyeImtahanId: exam.id, etsStudentId: studentId, ad: profile.firstName || '', soyad: profile.lastName || '', qrup: profile.group?.name || profile.groupName || null },
          });
          await tx.seviyeImtahanIstirak.create({ data: { seriyaId: exam.seriyaId, etsStudentId: studentId, cehdId: created.id } });
          return created;
        });
      } catch (claimError) {
        if (claimError.status === 403) throw claimError;
        if (claimError.code === 'P2002') throw Object.assign(new Error('Səviyyə imtahanında iştirak hüququndan artıq istifadə etmisiniz.'), { status: 403 });
        throw claimError;
      }
    }
    const token = jwt.sign({ rol: 'LEVEL_STUDENT', levelAttemptId: attempt.id, etsStudentId: ets.studentId, testAccount: isTestAccount }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, attemptId: attempt.id, exam: { id: exam.id, ad: exam.ad } });
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message || 'Giriş uğursuz oldu.' });
  }
};

const getStudentExam = async (req, res) => {
  const attemptId = ensureLevelStudent(req, res); if (!attemptId) return;
  const attempt = await prisma.seviyeCehd.findUnique({ where: { id: attemptId }, include: { seviyeImtahan: { include: { suallar: { orderBy: { sira: 'asc' } } } }, cavablar: true } });
  if (!attempt) return res.status(404).json({ message: 'İmtahan cəhdi tapılmadı.' });
  if (attempt.cixisVaxti) {
    const answersByQuestionId = new Map(attempt.cavablar.map((answer) => [answer.sualId, answer]));
    const questions = attempt.seviyeImtahan.suallar;
    return res.json({
      finished: true,
      result: {
        score: Number(attempt.bal || 0),
        answered: questions.reduce((total, question) => total + answeredUnitCount(question, answersByQuestionId.get(question.id)), 0),
        total: questions.reduce((total, question) => total + questionUnitCount(question), 0),
      },
      canRetry: Boolean(req.user?.testAccount),
      exam: { id: attempt.seviyeImtahan.id, ad: attempt.seviyeImtahan.ad, muddet: attempt.seviyeImtahan.muddet },
    });
  }
  const now = new Date(); const exam = attempt.seviyeImtahan;
  if (!exam.aktiv || now < exam.baslamaVaxti || now > exam.bitmeVaxti) return res.status(403).json({ message: 'İmtahan hazırda aktiv deyil.' });
  const startedAt = attempt.girisVaxti || now;
  if (!attempt.girisVaxti) await prisma.seviyeCehd.update({ where: { id: attempt.id }, data: { girisVaxti: startedAt } });
  const deadline = new Date(Math.min(new Date(exam.bitmeVaxti).getTime(), new Date(startedAt).getTime() + exam.muddet * 60 * 1000));
  res.json({
    attemptId: attempt.id,
    deadlineAt: deadline,
    exam: { id: exam.id, ad: exam.ad, muddet: exam.muddet },
    questions: orderedStudentQuestions(exam.suallar).map((q) => ({
      ...q,
      bal: q.sualTipi === 'ESSAY' ? 5 : q.bal,
      duzgunCavab: undefined,
      // Correct answers for reading sub-questions must never be exposed to students.
      variantlar: q.sualTipi === 'READING'
        ? studentReading(q.variantlar)
        : q.sualTipi === 'LISTENING'
          ? studentListening(q.variantlar, q.metn)
          : q.sualTipi === 'TEST' && Array.isArray(q.variantlar)
            ? q.variantlar.map((option) => ({ label: option.label, text: option.text }))
            : q.variantlar,
    })),
    // Per-question scores would let a student probe options until finding the
    // correct answer, so only return the data needed to restore the form.
    answers: attempt.cavablar.map((answer) => ({
      sualId: answer.sualId,
      cavab: answer.cavab,
      kilidlendi: answer.kilidlendi,
      kilidliVahidler: answer.kilidliVahidler,
      yenilendi: answer.yenilendi,
    })),
  });
};

const answerStudentQuestion = async (req, res) => {
  const attemptId = ensureLevelStudent(req, res); if (!attemptId) return;
  const questionId = Number(req.params.questionId);
  const rawValue = req.body.cavab;
  const requestedUnitIndex = Number(req.body.vahidIndex ?? 0);
  try {
    const answer = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SeviyeCehd" WHERE id = ${attemptId} FOR UPDATE`;
      const attempt = await tx.seviyeCehd.findUnique({ where: { id: attemptId }, include: { seviyeImtahan: true } });
      const question = await tx.seviyeSual.findFirst({ where: { id: questionId, seviyeImtahanId: attempt?.seviyeImtahanId } });
      if (!attempt || !question || attempt.cixisVaxti) throw Object.assign(new Error('Cavab yadda saxlanıla bilmədi.'), { status: 400 });
      const existingAnswer = await tx.seviyeCavab.findUnique({ where: { cehdId_sualId: { cehdId: attemptId, sualId: questionId } } });
      const isStructuredBlock = (question.sualTipi === 'READING' || question.sualTipi === 'LISTENING') && !Array.isArray(question.variantlar);
      const unitCount = isStructuredBlock && Array.isArray(question.variantlar?.questions) ? question.variantlar.questions.length : 1;
      if (!Number.isInteger(requestedUnitIndex) || requestedUnitIndex < 0 || requestedUnitIndex >= unitCount) {
        throw Object.assign(new Error('Sual nömrəsi düzgün deyil.'), { status: 400 });
      }
      const lockedUnits = Array.isArray(existingAnswer?.kilidliVahidler) ? existingAnswer.kilidliVahidler.map(Number) : (existingAnswer?.kilidlendi ? [0] : []);
      if (lockedUnits.includes(requestedUnitIndex)) {
        throw Object.assign(new Error('Bu cavab artıq yadda saxlanılıb və dəyişdirilə bilməz.'), { status: 409 });
      }

      const now = new Date();
      const startedAt = attempt.girisVaxti || now;
      if (!attempt.girisVaxti) await tx.seviyeCehd.update({ where: { id: attemptId }, data: { girisVaxti: startedAt } });
      const deadline = new Date(Math.min(new Date(attempt.seviyeImtahan.bitmeVaxti).getTime(), new Date(startedAt).getTime() + attempt.seviyeImtahan.muddet * 60 * 1000));
      if (!attempt.seviyeImtahan.aktiv || now < attempt.seviyeImtahan.baslamaVaxti || now > deadline) {
        throw Object.assign(new Error('İmtahan vaxtı bitib.'), { status: 403 });
      }

      let value;
      let bal;
      if (question.sualTipi === 'READING' || question.sualTipi === 'LISTENING') {
        if (question.sualTipi === 'LISTENING' && Array.isArray(question.variantlar)) {
          const selected = normalizeOptionLabel(rawValue);
          if (!question.variantlar.some((variant) => variant.label === selected)) throw Object.assign(new Error('Seçilmiş listening cavabı düzgün deyil.'), { status: 400 });
          value = selected;
          bal = question.duzgunCavab ? (selected === question.duzgunCavab ? Number(question.bal || 1) : 0) : 0;
        } else {
          const selections = parseReadingAnswer(existingAnswer?.cavab);
          const passage = question.variantlar;
          const typeLabel = question.sualTipi === 'READING' ? 'Reading' : 'Listening';
          if (!Array.isArray(passage?.questions)) throw Object.assign(new Error(`${typeLabel} sualları düzgün qurulmayıb.`), { status: 400 });
          const cleaned = {};
          let correctCount = 0;
          for (let index = 0; index < passage.questions.length; index += 1) {
            const selected = normalizeOptionLabel(index === requestedUnitIndex ? rawValue : selections[index]);
            if (!selected) continue;
            const subQuestion = passage.questions[index];
            if (!subQuestion.variants?.some((variant) => variant.label === selected)) throw Object.assign(new Error(`${typeLabel} sual ${index + 1} üçün cavab variantı yanlışdır.`), { status: 400 });
            cleaned[index] = selected;
            if (selected === subQuestion.correct) correctCount += 1;
          }
          if (!cleaned[requestedUnitIndex]) throw Object.assign(new Error('Cavab variantı seçilməlidir.'), { status: 400 });
          value = JSON.stringify(cleaned);
          bal = correctCount * Number(question.bal || 0);
        }
      } else if (question.sualTipi === 'ESSAY') {
        const essay = parseEssayAnswer(rawValue);
        const topic = normalize(essay.topic);
        const text = normalize(essay.text);
        const topics = question.variantlar?.essayTopics;
        if (!Array.isArray(topics) || topics.length !== 2) throw Object.assign(new Error('Essay mövzuları düzgün qurulmayıb.'), { status: 400 });
        if (topic && !topics.includes(topic)) throw Object.assign(new Error('Seçilmiş essay mövzusu düzgün deyil.'), { status: 400 });
        if (!topic || !text) throw Object.assign(new Error('Essay mövzusu və mətni tam daxil edilməlidir.'), { status: 400 });
        value = JSON.stringify({ topic, text });
        // Essay is added to the total only after a teacher grades it.
        bal = null;
      } else {
        value = normalize(rawValue);
        if (!value || !Array.isArray(question.variantlar) || !question.variantlar.some((option) => option.label === value)) {
          throw Object.assign(new Error('Cavab variantı seçilməlidir.'), { status: 400 });
        }
        bal = !question.duzgunCavab ? null : value === question.duzgunCavab ? question.bal : 0;
      }
      const nextLockedUnits = [...new Set([...lockedUnits, requestedUnitIndex])].sort((a, b) => a - b);
      const fullyLocked = nextLockedUnits.length === unitCount;
      return tx.seviyeCavab.upsert({
        where: { cehdId_sualId: { cehdId: attemptId, sualId: questionId } },
        update: { cavab: value, bal, kilidlendi: fullyLocked, kilidliVahidler: nextLockedUnits },
        create: { cehdId: attemptId, sualId: questionId, cavab: value, bal, kilidlendi: fullyLocked, kilidliVahidler: nextLockedUnits },
      });
    });
    res.json({ sualId: answer.sualId, cavab: answer.cavab, kilidlendi: answer.kilidlendi, kilidliVahidler: answer.kilidliVahidler, yenilendi: answer.yenilendi });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Cavab yadda saxlanıla bilmədi.' });
  }
};

const finalizeLevelAttempt = async (attemptId) => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SeviyeCehd" WHERE id = ${attemptId} FOR UPDATE`;
    const existing = await tx.seviyeCehd.findUnique({ where: { id: attemptId } });
    if (!existing) return { attempt: null, finalized: false };
    if (existing.cixisVaxti) return { attempt: existing, finalized: false };
    const total = await tx.seviyeCavab.aggregate({ where: { cehdId: attemptId }, _sum: { bal: true } });
    const attempt = await tx.seviyeCehd.update({
      where: { id: attemptId },
      data: { cixisVaxti: new Date(), bal: Number(total._sum.bal || 0) + Number(existing.speakingBal || 0) },
    });
    return { attempt, finalized: true };
  });
  if (result.finalized) await distributeLevelEssays(result.attempt.seviyeImtahanId);
  return result.attempt;
};

const finalizeExpiredLevelAttempts = async () => {
  const now = new Date();
  const attempts = await prisma.seviyeCehd.findMany({
    where: { girisVaxti: { not: null }, cixisVaxti: null },
    include: { seviyeImtahan: true },
  });
  await Promise.all(attempts.filter((attempt) => {
    const deadline = Math.min(
      new Date(attempt.seviyeImtahan.bitmeVaxti).getTime(),
      new Date(attempt.girisVaxti).getTime() + attempt.seviyeImtahan.muddet * 60 * 1000,
    );
    return now.getTime() >= deadline;
  }).map((attempt) => finalizeLevelAttempt(attempt.id)));
};

const finishStudentExam = async (req, res) => {
  const attemptId = ensureLevelStudent(req, res); if (!attemptId) return;
  const current = await prisma.seviyeCehd.findUnique({ where: { id: attemptId }, select: { girisVaxti: true } });
  if (!current) return res.status(404).json({ message: 'İmtahan cəhdi tapılmadı.' });
  if (!current.girisVaxti) return res.status(409).json({ message: 'İmtahan başlamadan yekunlaşdırıla bilməz.' });
  const attempt = await finalizeLevelAttempt(attemptId);
  res.json(attempt);
};

const restartTestStudentExam = async (req, res) => {
  const attemptId = ensureLevelStudent(req, res); if (!attemptId) return;
  if (!req.user?.testAccount) return res.status(403).json({ message: 'Bu əməliyyat yalnız test hesabları üçündür.' });
  await prisma.$transaction([
    prisma.seviyeCavab.deleteMany({ where: { cehdId: attemptId } }),
    prisma.seviyeCehd.update({ where: { id: attemptId }, data: { girisVaxti: null, cixisVaxti: null, bal: null, speakingBal: null } }),
  ]);
  res.json({ message: 'Test cəhdi sıfırlandı.' });
};

module.exports = { getExams, getConfig, getConfigById, saveConfig, getQuestions, createQuestion, updateQuestion, removeQuestion, importTestQuestions, uploadListeningAudio, setEssayTeachers, getResults, exportLevelResults, setSpeakingScore, importSpeakingScores, studentLogin, getStudentExam, answerStudentQuestion, finishStudentExam, restartTestStudentExam, finalizeExpiredLevelAttempts };
