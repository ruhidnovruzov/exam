const prisma = require('../prismaClient');
const { requestJson } = require('../services/etsAuthService');
const { GRADABLE_TYPES, ensureQuestionTypeOrder } = require('../services/teacherSyncService');

const ensureMuellim = (req, res) => {
  if (req.user?.rol !== 'MUELLIM') {
    res.status(403).json({ message: 'Bu əməliyyat yalnız müəllimlər üçündür' });
    return null;
  }
  return Number(req.user.id);
};

const syncEtsExamScoreIfReady = async ({ imtahan, telebe, totalBal }) => {
  if (!imtahan?.subjectGroupExternalId) {
    return;
  }
  const studentIdentifier = telebe?.email || telebe?.pin || telebe?.id;
  if (!studentIdentifier) {
    console.warn('ETS exam score sync skipped: missing student identifier');
    return;
  }

  const hasManualQuestions = Array.isArray(imtahan.terkib)
    ? imtahan.terkib.some((item) => item.sualTipi !== 'TEST')
    : false;

  if (hasManualQuestions) {
    const pendingCount = await prisma.imtahanSual.count({
      where: {
        imtahanId: imtahan.id,
        telebeId: telebe.id,
        bal: null,
        sual: { sualTipi: { not: 'TEST' } },
      },
    });

    if (pendingCount > 0) {
      return;
    }
  }

  try {
    const resp = await requestJson(`/subject-groups/${encodeURIComponent(imtahan.subjectGroupExternalId)}/students/${encodeURIComponent(studentIdentifier)}/exam-score`, {
      method: 'PUT',
      body: { examScore: totalBal },
    });
    console.info('syncEtsExamScoreIfReady: ETS response', { subjectGroupExternalId: imtahan.subjectGroupExternalId, studentIdentifier, resp });
  } catch (error) {
    console.error('ETS exam score sync failed:', error.message || error);
  }
};

const getMyAssignments = async (req, res) => {
  const muellimId = ensureMuellim(req, res);
  if (!muellimId) return;

  try {
    const assignments = await prisma.imtahanMuellim.findMany({
      where: { muellimId },
      include: {
        imtahan: {
          include: {
            fenn: { select: { id: true, fennAdi: true } },
            tedrisIl: true,
            terkib: true,
            _count: { select: { telebeleri: true } },
          },
        },
      },
      orderBy: { imtahan: { baslamaVaxti: 'desc' } },
    });

    const grouped = new Map();
    for (const row of assignments) {
      const key = row.imtahanId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          imtahan: row.imtahan,
          scopes: [],
        });
      }
      grouped.get(key).scopes.push({
        sualTipi: row.sualTipi,
        sualBaslangic: row.sualBaslangic,
        sualSon: row.sualSon,
      });
    }

    res.json(Array.from(grouped.values()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

const getPendingQueue = async (req, res) => {
  const muellimId = ensureMuellim(req, res);
  if (!muellimId) return;

  const imtahanId = Number(req.params.id);

  try {
    const scopes = await prisma.imtahanMuellim.findMany({
      where: { imtahanId, muellimId },
    });
    if (!scopes.length) {
      return res.status(403).json({ message: 'Bu imtahana təhkim olunmamısınız' });
    }

    const imtahan = await prisma.imtahan.findUnique({
      where: { id: imtahanId },
      include: { terkib: true, fenn: { select: { fennAdi: true } } },
    });
    if (!imtahan) return res.status(404).json({ message: 'İmtahan tapılmadı' });

    await ensureQuestionTypeOrder(imtahanId);

    const scopeFilters = scopes.map((s) => ({
      sual: { sualTipi: s.sualTipi },
      tipSira: { gte: s.sualBaslangic, lte: s.sualSon },
    }));

    const items = await prisma.imtahanSual.findMany({
      where: {
        imtahanId,
        OR: scopeFilters,
        telebe: {
          imtahanlar: {
            some: { imtahanId, cixisVaxti: { not: null } },
          },
        },
      },
      include: {
        sual: { include: { movzu: { select: { ad: true } } } },
        nezeriNetic: { select: { id: true, verileBal: true, qeyd: true } },
      },
      orderBy: [{ telebeId: 'asc' }, { tipSira: 'asc' }],
    });

    const telebeIds = [...new Set(items.map((i) => i.telebeId))];
    const assignments = await prisma.imtahanTelebe.findMany({
      where: { imtahanId, telebeId: { in: telebeIds } },
      select: { telebeId: true, yoxlamaKodu: true },
    });
    const codeMap = new Map(assignments.map((a) => [a.telebeId, a.yoxlamaKodu]));

    const terkibMap = Object.fromEntries(imtahan.terkib.map((t) => [t.sualTipi, t]));

    const queue = items.map((item) => ({
      id: item.id,
      yoxlamaKodu: codeMap.get(item.telebeId) || `TX-${item.telebeId}`,
      sualTipi: item.sual.sualTipi,
      tipSira: item.tipSira,
      sualMetn: item.sual.metn,
      sualSekil: item.sual.sekil,
      movzu: item.sual.movzu?.ad || null,
      yaziliCavab: item.yaziliCavab || '',
      maxBal: Number(terkibMap[item.sual.sualTipi]?.balPerSual || 0),
      bal: item.bal,
      qeyd: item.nezeriNetic?.qeyd || null,
      yoxlanilib: item.bal !== null,
    }));

    const pending = queue.filter((q) => !q.yoxlanilib).length;
    const graded = queue.filter((q) => q.yoxlanilib).length;

    res.json({
      imtahan: {
        id: imtahan.id,
        ad: imtahan.ad,
        fenn: imtahan.fenn,
        status: imtahan.status,
      },
      stats: { total: queue.length, pending, graded },
      queue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

const gradeQuestion = async (req, res) => {
  const muellimId = ensureMuellim(req, res);
  if (!muellimId) return;

  const imtahanId = Number(req.params.id);
  const sualId = Number(req.params.sualId);
  const { bal, qeyd } = req.body;

  if (bal === undefined || bal === null || Number.isNaN(Number(bal))) {
    return res.status(400).json({ message: 'Bal tələb olunur' });
  }

  try {
    const scopes = await prisma.imtahanMuellim.findMany({
      where: { imtahanId, muellimId },
    });
    if (!scopes.length) {
      return res.status(403).json({ message: 'Bu imtahana təhkim olunmamısınız' });
    }

    const imtahanSual = await prisma.imtahanSual.findFirst({
      where: { id: sualId, imtahanId },
      include: {
        sual: true,
        telebe: true,
        imtahan: { include: { terkib: true } },
      },
    });
    if (!imtahanSual) return res.status(404).json({ message: 'Sual tapılmadı' });

    if (!GRADABLE_TYPES.includes(imtahanSual.sual.sualTipi)) {
      return res.status(400).json({ message: 'Bu sual tipi müəllim tərəfindən yoxlanılmır' });
    }

    const allowed = scopes.some(
      (s) =>
        s.sualTipi === imtahanSual.sual.sualTipi &&
        imtahanSual.tipSira >= s.sualBaslangic &&
        imtahanSual.tipSira <= s.sualSon
    );
    if (!allowed) {
      return res.status(403).json({ message: 'Bu sual sizin yoxlama sahənizə daxil deyil' });
    }

    const assignment = await prisma.imtahanTelebe.findUnique({
      where: {
        imtahanId_telebeId: { imtahanId, telebeId: imtahanSual.telebeId },
      },
    });
    if (!assignment?.cixisVaxti) {
      return res.status(400).json({ message: 'Tələbə imtahanı hələ tamamlamayıb' });
    }

    const terkib = imtahanSual.imtahan.terkib.find((t) => t.sualTipi === imtahanSual.sual.sualTipi);
    const maxBal = Number(terkib?.balPerSual || 0);
    const verileBal = Math.min(Math.max(0, Number(bal)), maxBal);

    let totalBal = 0;
    await prisma.$transaction(async (tx) => {
      await tx.imtahanSual.update({
        where: { id: imtahanSual.id },
        data: { bal: verileBal, duzgundur: verileBal > 0 },
      });

      await tx.nezeriNetic.upsert({
        where: { imtahanSualId: imtahanSual.id },
        create: {
          telebeId: imtahanSual.telebeId,
          imtahanSualId: imtahanSual.id,
          yoxlayanId: muellimId,
          verileBal,
          qeyd: qeyd || null,
        },
        update: {
          yoxlayanId: muellimId,
          verileBal,
          qeyd: qeyd || null,
          yoxlanildi: new Date(),
        },
      });

      const aggregate = await tx.imtahanSual.aggregate({
        where: { imtahanId, telebeId: imtahanSual.telebeId },
        _sum: { bal: true },
      });
      totalBal = Number(aggregate._sum.bal || 0);

      await tx.imtahanTelebe.update({
        where: { imtahanId_telebeId: { imtahanId, telebeId: imtahanSual.telebeId } },
        data: {
          bal: totalBal,
          kecdi: totalBal >= Number(imtahanSual.imtahan.kecidBali),
        },
      });
    });

    await syncEtsExamScoreIfReady({
      imtahan: imtahanSual.imtahan,
      telebe: imtahanSual.telebe,
      totalBal,
    });

    res.json({ message: 'Qiymət yadda saxlanıldı', bal: verileBal, maxBal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = {
  getMyAssignments,
  getPendingQueue,
  gradeQuestion,
};
