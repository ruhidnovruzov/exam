const prisma = require('../prismaClient');
const { getOrCreateKafedraFromEts, syncKafedralarFromEts } = require('../services/etsImportService');

// GET /api/kafedralar
const getAll = async (req, res) => {
  try {
    await syncKafedralarFromEts();

    const { externalId } = req.query;
    if (externalId) {
      const kafedra = await getOrCreateKafedraFromEts(externalId);
      const kafedralar = await prisma.kafedra.findMany({
        where: { id: kafedra.id },
        include: { _count: { select: { fennler: true, istifadeci: true } } },
      });
      return res.json(kafedralar);
    }

    const kafedralar = await prisma.kafedra.findMany({
      orderBy: { ad: 'asc' },
      include: { _count: { select: { fennler: true, istifadeci: true } } },
    });
    res.json(kafedralar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/kafedralar/:id
const getOne = async (req, res) => {
  try {
    const { externalId } = req.query;
    if (externalId) {
      const kafedra = await getOrCreateKafedraFromEts(externalId);
      const result = await prisma.kafedra.findUnique({
        where: { id: kafedra.id },
        include: { fennler: true, istifadeci: { select: { id: true, ad: true, soyad: true, rol: true } } },
      });
      if (!result) return res.status(404).json({ message: 'Kafedra tapılmadı' });
      return res.json(result);
    }

    const kafedra = await prisma.kafedra.findUnique({
      where: { id: Number(req.params.id) },
      include: { fennler: true, istifadeci: { select: { id: true, ad: true, soyad: true, rol: true } } },
    });
    if (!kafedra) return res.status(404).json({ message: 'Kafedra tapılmadı' });
    res.json(kafedra);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/kafedralar
const create = async (req, res) => {
  const { ad, kod } = req.body;
  if (!ad || !kod) return res.status(400).json({ message: 'Ad və kod tələb olunur' });

  try {
    const kafedra = await prisma.kafedra.create({ data: { ad, kod } });
    res.status(201).json(kafedra);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu kod artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/kafedralar/:id
const update = async (req, res) => {
  const { ad, kod } = req.body;
  try {
    const existing = await prisma.kafedra.findUnique({
      where: { id: Number(req.params.id) },
      select: { source: true },
    });
    if (!existing) return res.status(404).json({ message: 'Kafedra tapılmadı' });
    if (existing.source === 'ETS') {
      return res.status(403).json({ message: 'ETS kafedrasını dəyişdirmək olmaz' });
    }

    const kafedra = await prisma.kafedra.update({
      where: { id: Number(req.params.id) },
      data: { ad, kod },
    });
    res.json(kafedra);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Kafedra tapılmadı' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu kod artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/kafedralar/:id
const remove = async (req, res) => {
  try {
    const existing = await prisma.kafedra.findUnique({
      where: { id: Number(req.params.id) },
      select: { source: true },
    });
    if (!existing) return res.status(404).json({ message: 'Kafedra tapılmadı' });
    if (existing.source === 'ETS') {
      return res.status(403).json({ message: 'ETS kafedrasını silmək olmaz' });
    }

    await prisma.kafedra.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Kafedra silindi' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Kafedra tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, getOne, create, update, remove };