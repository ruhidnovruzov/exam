const prisma = require('../prismaClient');
const { syncMovzularFromEts } = require('../services/etsImportService');

// GET /api/movzular?fennId=
const getAll = async (req, res) => {
  try {
    const { fennId } = req.query;

    if (!req.user?.id) return res.status(401).json({ message: 'Autentifikasiya tələb olunur' });
    await syncMovzularFromEts(req.user.id, fennId ? Number(fennId) : undefined);

    const where = {};
    if (fennId) where.fennId = Number(fennId);

    const movzular = await prisma.movzu.findMany({
      where,
      orderBy: { ad: 'asc' },
      include: {
        fenn: { select: { id: true, fennAdi: true, fennKodu: true } },
        _count: { select: { suallar: true } },
      },
    });
    res.json(movzular);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/movzular/:id
const getOne = async (req, res) => {
  try {
    const movzu = await prisma.movzu.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        fenn: true,
        suallar: { select: { id: true, metn: true, sualTipi: true, chetinlik: true } },
      },
    });
    if (!movzu) return res.status(404).json({ message: 'Mövzu tapılmadı' });
    res.json(movzu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/movzular
const create = async (req, res) => {
  const { fennId, ad } = req.body;
  if (!fennId || !ad) return res.status(400).json({ message: 'Fənn və ad tələb olunur' });

  try {
    const fenn = await prisma.fenn.findUnique({
      where: { id: Number(fennId) },
      select: { source: true },
    });
    if (!fenn) return res.status(404).json({ message: 'Fənn tapılmadı' });
    if (fenn.source === 'ETS') {
      return res.status(400).json({ message: 'ETS fənninə mövzu əlavə etmək olmaz' });
    }

    const movzu = await prisma.movzu.create({
      data: { fennId: Number(fennId), ad },
      include: { fenn: { select: { id: true, fennAdi: true } } },
    });
    res.status(201).json(movzu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/movzular/:id
const update = async (req, res) => {
  const { fennId, ad } = req.body;
  try {
    const existingMovzu = await prisma.movzu.findUnique({
      where: { id: Number(req.params.id) },
      select: { source: true },
    });
    if (!existingMovzu) return res.status(404).json({ message: 'Mövzu tapılmadı' });
    if (existingMovzu.source === 'ETS') {
      return res.status(403).json({ message: 'ETS mövzusunu dəyişdirmək olmaz' });
    }

    if (fennId) {
      const fenn = await prisma.fenn.findUnique({
        where: { id: Number(fennId) },
        select: { source: true },
      });
      if (!fenn) return res.status(404).json({ message: 'Fənn tapılmadı' });
      if (fenn.source === 'ETS') {
        return res.status(400).json({ message: 'ETS fənninə mövzu əlavə etmək olmaz' });
      }
    }

    const movzu = await prisma.movzu.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(fennId && { fennId: Number(fennId) }),
        ...(ad && { ad }),
      },
      include: { fenn: { select: { id: true, fennAdi: true } } },
    });
    res.json(movzu);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Mövzu tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/movzular/:id
const remove = async (req, res) => {
  try {
    const existingMovzu = await prisma.movzu.findUnique({
      where: { id: Number(req.params.id) },
      select: { source: true },
    });
    if (!existingMovzu) return res.status(404).json({ message: 'Mövzu tapılmadı' });
    if (existingMovzu.source === 'ETS') {
      return res.status(403).json({ message: 'ETS mövzusunu silmək olmaz' });
    }

    await prisma.movzu.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Mövzu silindi' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Mövzu tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, getOne, create, update, remove };