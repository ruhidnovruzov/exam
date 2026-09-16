const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { resolveStudent } = require('../services/etsAuthService');
const { verifyDailyExamPassword } = require('../services/dailyExamPasswordService');
const { generateYoxlamaKodu } = require('../services/teacherSyncService');

const publicTelebeSelect = {
  id: true,
  etsId: true,
  ad: true,
  soyad: true,
  ata: true,
  qrup: true,
  ixtisas: true,
  kurs: true,
  email: true,
};

const ensureStudent = (req, res) => {
  if (req.user?.rol !== 'STUDENT' || !req.user?.telebeId) {
    res.status(403).json({ message: 'Bu əməliyyat yalnız tələbə üçündür' });
    return null;
  }
  return Number(req.user.telebeId);
};

const getAssignment = async (imtahanId, telebeId, includeQuestions = false) =>
  prisma.imtahanTelebe.findUnique({
    where: { imtahanId_telebeId: { imtahanId, telebeId } },
    include: {
      telebe: { select: publicTelebeSelect },
      imtahan: {
        include: {
          fenn: { select: { id: true, fennAdi: true, fennKodu: true } },
          tedrisIl: true,
          terkib: true,
          ...(includeQuestions
            ? {
                suallar: {
                  where: { telebeId },
                  orderBy: { sira: 'asc' },
                  include: {
                    sual: {
                      include: {
                        cavablar: {
                          select: { id: true, metn: true, sekil: true, sira: true },
                          orderBy: { sira: 'asc' },
                        },
                        movzu: { select: { id: true, ad: true } },
                      },
                    },
                  },
                },
              }
            : {}),
        },
      },
    },
  });

const getDeadline = (row) => {
  const examEnd = new Date(row.imtahan.bitmeVaxti);
  if (!row.girisVaxti) return examEnd;

  const durationEnd = new Date(new Date(row.girisVaxti).getTime() + Number(row.imtahan.muddet) * 60 * 1000);
  return durationEnd < examEnd ? durationEnd : examEnd;
};

const finalizeAssignment = async (imtahanId, telebeId, imtahan) => {
  const aggregate = await prisma.imtahanSual.aggregate({
    where: { imtahanId, telebeId },
    _sum: { bal: true },
  });
  const total = Number(aggregate._sum.bal || 0);

  // Eyni anda həm tələbə brauzeri, həm də avtomatik vaxt yoxlaması işləsə,
  // ilk yekunlaşdırma qalib gəlir; sessiya ikinci dəfə yazılmır.
  await prisma.imtahanTelebe.updateMany({
    where: { imtahanId, telebeId, cixisVaxti: null },
    data: {
      cixisVaxti: new Date(),
      yoxlamaKodu: generateYoxlamaKodu(),
      bal: total,
      kecdi: total >= Number(imtahan.kecidBali),
    },
  });

  return prisma.imtahanTelebe.findUnique({
    where: { imtahanId_telebeId: { imtahanId, telebeId } },
  });
};

// Açıq qalmış sessiyaları server tərəfdə yekunlaşdır. Bu funksiya server
// başlayanda və periodik işlədilir; tələbənin brauzerinin açıq qalmasına ehtiyac yoxdur.
const finalizeExpiredAssignments = async () => {
  const rows = await prisma.imtahanTelebe.findMany({
    where: {
      girisVaxti: { not: null },
      cixisVaxti: null,
      imtahan: { status: { not: 'LEGV_EDILDI' } },
    },
    include: { imtahan: true },
  });

  const now = new Date();
  await Promise.all(
    rows
      .filter((row) => now >= getDeadline(row))
      .map((row) => finalizeAssignment(row.imtahanId, row.telebeId, row.imtahan))
  );
};

const serializeAssignment = (row) => {
  const now = new Date();
  const baslama = new Date(row.imtahan.baslamaVaxti);
  const bitme = new Date(row.imtahan.bitmeVaxti);
  const deadline = getDeadline(row);
  const canStart = now >= baslama && now <= deadline && !row.cixisVaxti && row.imtahan.status !== 'LEGV_EDILDI';
  const finished = Boolean(row.cixisVaxti);

  return {
    id: row.id,
    imtahanId: row.imtahanId,
    telebeId: row.telebeId,
    girisVaxti: row.girisVaxti,
    cixisVaxti: row.cixisVaxti,
    bal: row.bal,
    kecdi: row.kecdi,
    deadlineAt: deadline,
    canStart,
    finished,
    imtahan: {
      id: row.imtahan.id,
      ad: row.imtahan.ad,
      imtahanNovu: row.imtahan.imtahanNovu,
      tehsilNovu: row.imtahan.tehsilNovu,
      sualTipleri: row.imtahan.sualTipleri,
      muddet: row.imtahan.muddet,
      kecidBali: row.imtahan.kecidBali,
      baslamaVaxti: row.imtahan.baslamaVaxti,
      bitmeVaxti: row.imtahan.bitmeVaxti,
      status: row.imtahan.status,
      fenn: row.imtahan.fenn,
      tedrisIl: row.imtahan.tedrisIl,
      terkib: row.imtahan.terkib,
    },
  };
};

const serializeExamDetail = (row) => {
  const questions = row.imtahan.suallar.map((item) => ({
    id: item.id,
    sira: item.sira,
    sualTipi: item.sual.sualTipi,
    metn: item.sual.metn,
    sekil: item.sual.sekil,
    movzu: item.sual.movzu,
    cavablar: item.sual.cavablar,
    secilenCavabId: item.secilenCavabId,
    yaziliCavab: item.yaziliCavab,
    bal: item.bal,
    duzgundur: item.duzgundur,
  }));
  const testQuestions = questions.filter((item) => item.sualTipi === 'TEST');
  const essayQuestions = questions.filter((item) => item.sualTipi === 'NEZERI' || item.sualTipi === 'DUSTUR' || item.sualTipi === 'PRAKTIKI');

  return {
    ...serializeAssignment(row),
    questions,
    result: row.cixisVaxti
      ? {
          test: {
            total: testQuestions.length,
            answered: testQuestions.filter((item) => item.secilenCavabId).length,
            correct: testQuestions.filter((item) => item.duzgundur === true).length,
            incorrect: testQuestions.filter((item) => item.secilenCavabId && item.duzgundur === false).length,
            score: testQuestions.reduce((sum, item) => sum + Number(item.bal || 0), 0),
          },
          essay: {
            total: essayQuestions.length,
            answered: essayQuestions.filter((item) => Boolean(item.yaziliCavab?.trim())).length,
          },
        }
      : null,
  };
};

const isExamOpen = (imtahan) => {
  const now = new Date();
  return (
    now >= new Date(imtahan.baslamaVaxti) &&
    now <= new Date(imtahan.bitmeVaxti) &&
    imtahan.status !== 'LEGV_EDILDI'
  );
};

const login = async (req, res) => {
  const { username, email, identifier, password, parol } = req.body;
  const loginIdentifier = username || email || identifier;
  const loginPassword = password || parol;

  if (!loginIdentifier || !loginPassword) {
    return res.status(400).json({ message: 'Login və şifrə tələb olunur' });
  }

  try {
    const ets = await resolveStudent(loginIdentifier);

    if (!verifyDailyExamPassword(ets.studentId, loginPassword)) {
      return res.status(401).json({
        message: 'Günlük imtahan şifrəsi yanlışdır. ETS kabinetindən bugünkü şifrəni yoxlayın.',
      });
    }

    const telebe = await prisma.telebe.findUnique({
      where: { etsId: ets.studentId },
      select: publicTelebeSelect,
    });

    if (!telebe) {
      return res.status(403).json({
        message: 'Bu ETS tələbəsi exam sistemində heç bir imtahana təhkim olunmayıb',
      });
    }

    const token = jwt.sign(
      {
        rol: 'STUDENT',
        telebeId: telebe.id,
        etsStudentId: ets.studentId,
        etsUserId: ets.profile.userId || null,
        username: ets.profile.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, telebe, etsUser: ets.profile });
  } catch (err) {
    res.status(401).json({ message: err.message || 'Giriş uğursuz oldu' });
  }
};

const me = async (req, res) => {
  const telebeId = ensureStudent(req, res);
  if (!telebeId) return;

  const telebe = await prisma.telebe.findUnique({ where: { id: telebeId }, select: publicTelebeSelect });
  if (!telebe) return res.status(404).json({ message: 'Tələbə tapılmadı' });
  res.json({ telebe });
};

const listExams = async (req, res) => {
  const telebeId = ensureStudent(req, res);
  if (!telebeId) return;

  try {
    await finalizeExpiredAssignments();
    const rows = await prisma.imtahanTelebe.findMany({
      where: {
        telebeId,
        imtahan: {
          status: { not: 'LEGV_EDILDI' },
        },
      },
      include: {
        imtahan: {
          include: {
            fenn: { select: { id: true, fennAdi: true, fennKodu: true } },
            tedrisIl: true,
            terkib: true,
          },
        },
      },
      orderBy: { yaradildi: 'desc' },
    });
    res.json(rows.map(serializeAssignment));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

const getExam = async (req, res) => {
  const telebeId = ensureStudent(req, res);
  if (!telebeId) return;

  try {
    let row = await getAssignment(Number(req.params.id), telebeId, true);
    if (!row) return res.status(404).json({ message: 'İmtahan tapılmadı' });
    if (!row.girisVaxti && !row.cixisVaxti && !isExamOpen(row.imtahan)) {
      return res.status(403).json({ message: 'İmtahan hazırda aktiv deyil' });
    }

    if (!row.girisVaxti && !row.cixisVaxti) {
      await prisma.imtahanTelebe.update({
        where: { imtahanId_telebeId: { imtahanId: row.imtahanId, telebeId } },
        data: { girisVaxti: new Date() },
      });
      row.girisVaxti = new Date();
    }

    if (!row.cixisVaxti && new Date() >= getDeadline(row)) {
      await finalizeAssignment(row.imtahanId, telebeId, row.imtahan);
      row = await getAssignment(row.imtahanId, telebeId, true);
    }

    res.json(serializeExamDetail(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

const answerQuestion = async (req, res) => {
  const telebeId = ensureStudent(req, res);
  if (!telebeId) return;

  const imtahanId = Number(req.params.id);
  const questionId = Number(req.params.questionId);
  const { secilenCavabId, yaziliCavab } = req.body;

  try {
    const assignment = await prisma.imtahanTelebe.findUnique({
      where: { imtahanId_telebeId: { imtahanId, telebeId } },
      include: { imtahan: { include: { terkib: true } } },
    });
    if (!assignment) return res.status(404).json({ message: 'İmtahan tapılmadı' });
    if (assignment.cixisVaxti) return res.status(400).json({ message: 'İmtahan artıq yekunlaşıb' });
    if (!isExamOpen(assignment.imtahan)) return res.status(403).json({ message: 'İmtahan hazırda aktiv deyil' });
    if (!assignment.girisVaxti) {
      assignment.girisVaxti = new Date();
      await prisma.imtahanTelebe.update({
        where: { imtahanId_telebeId: { imtahanId, telebeId } },
        data: { girisVaxti: assignment.girisVaxti },
      });
    }
    if (new Date() > getDeadline(assignment)) {
      const finished = await finalizeAssignment(imtahanId, telebeId, assignment.imtahan);
      return res.status(403).json({ message: 'İmtahan vaxtı bitib', result: finished });
    }

    const imtahanSual = await prisma.imtahanSual.findFirst({
      where: { id: questionId, imtahanId, telebeId },
      include: { sual: { include: { cavablar: true } } },
    });
    if (!imtahanSual) return res.status(404).json({ message: 'Sual tapılmadı' });

    const data = {};
    if (imtahanSual.sual.sualTipi === 'TEST') {
      const selected = imtahanSual.sual.cavablar.find((c) => c.id === Number(secilenCavabId));
      if (!selected) return res.status(400).json({ message: 'Seçilmiş cavab bu suala aid deyil' });
      const terkib = assignment.imtahan.terkib.find((t) => t.sualTipi === 'TEST');
      data.secilenCavabId = selected.id;
      data.duzgundur = selected.duzgundur;
      data.bal = selected.duzgundur ? Number(terkib?.balPerSual || 0) : 0;
    } else {
      data.yaziliCavab = typeof yaziliCavab === 'string' ? yaziliCavab : '';
      data.bal = null;
      data.duzgundur = null;
    }

    const updated = await prisma.imtahanSual.update({ where: { id: imtahanSual.id }, data });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

const finishExam = async (req, res) => {
  const telebeId = ensureStudent(req, res);
  if (!telebeId) return;

  const imtahanId = Number(req.params.id);

  try {
    const assignment = await prisma.imtahanTelebe.findUnique({
      where: { imtahanId_telebeId: { imtahanId, telebeId } },
      include: { imtahan: true },
    });
    if (!assignment) return res.status(404).json({ message: 'İmtahan tapılmadı' });
    if (assignment.cixisVaxti) {
      const finished = await getAssignment(imtahanId, telebeId, true);
      return res.json(serializeExamDetail(finished));
    }

    await finalizeAssignment(imtahanId, telebeId, assignment.imtahan);
    const finished = await getAssignment(imtahanId, telebeId, true);
    res.json(serializeExamDetail(finished));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { login, me, listExams, getExam, answerQuestion, finishExam, finalizeExpiredAssignments };
