const prisma = require('../prismaClient');

const ensureMuellim = (req, res) => {
  if (req.user?.rol !== 'MUELLIM') {
    res.status(403).json({ message: 'Bu əməliyyat yalnız müəllimlər üçündür.' });
    return null;
  }
  return Number(req.user.id);
};

const parseEssay = (value) => {
  try {
    const parsed = JSON.parse(value || '{}');
    return { topic: String(parsed?.topic || '').trim(), text: String(parsed?.text || '').trim() };
  } catch {
    return { topic: '', text: String(value || '').trim() };
  }
};

const getMyLevelAssignments = async (req, res) => {
  const muellimId = ensureMuellim(req, res); if (!muellimId) return;
  const rows = await prisma.seviyeImtahanMuellim.findMany({
    where: { muellimId },
    include: { seviyeImtahan: true },
    orderBy: { seviyeImtahan: { bitmeVaxti: 'desc' } },
  });
  const data = await Promise.all(rows.map(async (row) => {
    const where = { muellimId, cehd: { seviyeImtahanId: row.seviyeImtahanId } };
    const [total, graded] = await Promise.all([
      prisma.seviyeEssayYoxlama.count({ where }),
      prisma.seviyeEssayYoxlama.count({ where: { ...where, yoxlanildi: { not: null } } }),
    ]);
    return {
      exam: row.seviyeImtahan,
      gradingDeadlineAt: null,
      gradingOpen: true,
      stats: { total, graded, pending: total - graded },
    };
  }));
  res.json(data);
};

const getLevelEssayQueue = async (req, res) => {
  const muellimId = ensureMuellim(req, res); if (!muellimId) return;
  const examId = Number(req.params.id);
  const assignment = await prisma.seviyeImtahanMuellim.findUnique({ where: { seviyeImtahanId_muellimId: { seviyeImtahanId: examId, muellimId } } });
  if (!assignment) return res.status(403).json({ message: 'Bu səviyyə imtahanına təhkim olunmamısınız.' });
  const rows = await prisma.seviyeEssayYoxlama.findMany({
    where: { muellimId, cehd: { seviyeImtahanId: examId } },
    include: { cavab: true, sual: { select: { id: true, bal: true } } },
    orderBy: [{ yoxlanildi: 'asc' }, { id: 'asc' }],
  });
  const queue = rows.map((row) => {
    const essay = parseEssay(row.cavab.cavab);
    return {
      id: row.id, yoxlamaKodu: `LVL-${row.cehdId}`, topic: essay.topic, text: essay.text,
      maxBal: 5, bal: row.bal, qeyd: row.qeyd, yoxlanilib: Boolean(row.yoxlanildi),
    };
  });
  res.json({
    gradingDeadlineAt: null,
    gradingOpen: true,
    stats: { total: queue.length, graded: queue.filter((item) => item.yoxlanilib).length, pending: queue.filter((item) => !item.yoxlanilib).length },
    queue,
  });
};

const gradeLevelEssay = async (req, res) => {
  const muellimId = ensureMuellim(req, res); if (!muellimId) return;
  const id = Number(req.params.id);
  const bal = Number(req.body.bal);
  const qeyd = String(req.body.qeyd || '').trim() || null;
  if (!Number.isFinite(bal)) return res.status(400).json({ message: 'Bal tələb olunur.' });
  const row = await prisma.seviyeEssayYoxlama.findFirst({
    where: { id, muellimId },
    include: { sual: true, cehd: { include: { seviyeImtahan: true } } },
  });
  if (!row) return res.status(404).json({ message: 'Essay yoxlama növbəsində tapılmadı.' });
  const score = Math.min(Math.max(0, bal), 5);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SeviyeCehd" WHERE id = ${row.cehdId} FOR UPDATE`;
    await tx.seviyeEssayYoxlama.update({ where: { id }, data: { bal: score, qeyd, yoxlanildi: new Date() } });
    await tx.seviyeCavab.update({ where: { id: row.cavabId }, data: { bal: score } });
    const total = await tx.seviyeCavab.aggregate({ where: { cehdId: row.cehdId }, _sum: { bal: true } });
    const attempt = await tx.seviyeCehd.findUnique({ where: { id: row.cehdId }, select: { speakingBal: true } });
    await tx.seviyeCehd.update({ where: { id: row.cehdId }, data: { bal: Number(total._sum.bal || 0) + Number(attempt?.speakingBal || 0) } });
  });
  res.json({ message: 'Essay qiymətləndirildi.', bal: score });
};

module.exports = { getMyLevelAssignments, getLevelEssayQueue, gradeLevelEssay };
