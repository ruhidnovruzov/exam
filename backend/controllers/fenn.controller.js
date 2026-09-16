const prisma = require('../prismaClient');
const {
  getOrCreateKafedraFromEts,
  getOrCreateFennFromEts,
  getOrCreateFennsFromEtsByDepartmentId,
  syncFennlerFromEts,
} = require('../services/etsImportService');

// GET /api/fennler
const getAll = async (req, res) => {
  try {
    const { kafedraId, kafedraExternalId, externalId, bolme } = req.query;
    const where = {};

    if (kafedraExternalId) {
      if (!req.user?.id) return res.status(401).json({ message: 'Autentifikasiya tələb olunur' });
      await getOrCreateFennsFromEtsByDepartmentId(kafedraExternalId, req.user.id);
      const kafedra = await getOrCreateKafedraFromEts(kafedraExternalId);
      where.kafedraId = kafedra.id;
    } else {
      if (!req.user?.id) return res.status(401).json({ message: 'Autentifikasiya tələb olunur' });
      await syncFennlerFromEts(req.user.id);
      if (kafedraId) where.kafedraId = Number(kafedraId);
    }

    if (bolme) where.bolme = bolme;

    if (externalId) {
      if (!req.user?.id) return res.status(401).json({ message: 'Autentifikasiya tələb olunur' });
      const fenn = await getOrCreateFennFromEts(externalId, req.user.id);
      const fennWithInclude = await prisma.fenn.findUnique({
        where: { id: fenn.id },
        include: {
          kafedra: { select: { id: true, ad: true } },
          istifadeci: { select: { id: true, ad: true, soyad: true } },
          _count: { select: { movzular: true, testBanki: true } },
        },
      });
      return res.json(fennWithInclude ? [fennWithInclude] : []);
    }

    const fennler = await prisma.fenn.findMany({
      where,
      orderBy: { fennKodu: 'asc' },
      include: {
        kafedra: { select: { id: true, ad: true } },
        istifadeci: { select: { id: true, ad: true, soyad: true } },
        _count: { select: { movzular: true, testBanki: true } },
      },
    });
    res.json(fennler);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/fennler/:id
const getOne = async (req, res) => {
  try {
    const { externalId } = req.query;
    if (externalId) {
      if (!req.user?.id) return res.status(401).json({ message: 'Autentifikasiya tələb olunur' });
      const fenn = await getOrCreateFennFromEts(externalId, req.user.id);
      const fennWithInclude = await prisma.fenn.findUnique({
        where: { id: fenn.id },
        include: {
          kafedra: true,
          movzular: { orderBy: { ad: 'asc' } },
          istifadeci: { select: { id: true, ad: true, soyad: true } },
        },
      });
      if (!fennWithInclude) return res.status(404).json({ message: 'Fənn tapılmadı' });
      return res.json(fennWithInclude);
    }

    const fenn = await prisma.fenn.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        kafedra: true,
        movzular: { orderBy: { ad: 'asc' } },
        istifadeci: { select: { id: true, ad: true, soyad: true } },
      },
    });
    if (!fenn) return res.status(404).json({ message: 'Fənn tapılmadı' });
    res.json(fenn);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/fennler
const create = async (req, res) => {
  const { kafedraId, fennKodu, fennAdi, bolme } = req.body;

  if (!kafedraId || !fennKodu || !fennAdi || !bolme) {
    return res.status(400).json({ message: 'Bütün sahələr tələb olunur' });
  }

  try {
    const fenn = await prisma.fenn.create({
      data: {
        kafedraId: Number(kafedraId),
        fennKodu,
        fennAdi,
        bolme,
        elavEden: req.user.id,
      },
      include: {
        kafedra: { select: { id: true, ad: true } },
        istifadeci: { select: { id: true, ad: true, soyad: true } },
      },
    });
    res.status(201).json(fenn);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu fənn kodu artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/fennler/:id
const update = async (req, res) => {
  const { kafedraId, fennKodu, fennAdi, bolme } = req.body;
  try {
    const existing = await prisma.fenn.findUnique({
      where: { id: Number(req.params.id) },
      select: { source: true },
    });
    if (!existing) return res.status(404).json({ message: 'Fənn tapılmadı' });
    if (existing.source === 'ETS') {
      return res.status(403).json({ message: 'ETS fənnini dəyişdirmək olmaz' });
    }

    const fenn = await prisma.fenn.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(kafedraId && { kafedraId: Number(kafedraId) }),
        ...(fennKodu && { fennKodu }),
        ...(fennAdi && { fennAdi }),
        ...(bolme && { bolme }),
      },
      include: {
        kafedra: { select: { id: true, ad: true } },
        istifadeci: { select: { id: true, ad: true, soyad: true } },
      },
    });
    res.json(fenn);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu fənn kodu artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/fennler/:id
const remove = async (req, res) => {
  try {
    const existing = await prisma.fenn.findUnique({
      where: { id: Number(req.params.id) },
      select: { source: true },
    });
    if (!existing) return res.status(404).json({ message: 'Fənn tapılmadı' });
    if (existing.source === 'ETS') {
      return res.status(403).json({ message: 'ETS fənnini silmək olmaz' });
    }

    await prisma.fenn.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Fənn silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, getOne, create, update, remove };