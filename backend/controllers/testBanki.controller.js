const prisma = require('../prismaClient');
const { getOrCreateKafedraFromEts, getOrCreateFennFromEts } = require('../services/etsImportService');

// GET /api/test-bankilar
const getAll = async (req, res) => {
  try {
    const { fennId, status, blok } = req.query;
    const where = {};

    // Kafedra istifadəçisi yalnız öz kafedrasının test banklarını görür
    if (req.user.rol === 'KAFEDRA') {
      where.kafedraId = req.user.kafedraId;
    }

    if (fennId) where.fennId = Number(fennId);
    if (status) where.status = status;
    if (blok) where.blok = blok;

    const bankilar = await prisma.testBanki.findMany({
      where,
      orderBy: { yaradildi: 'desc' },
      include: {
        fenn: { select: { id: true, fennAdi: true, fennKodu: true } },
        kafedra: { select: { id: true, ad: true } },
        elavEden: { select: { id: true, ad: true, soyad: true } },
        _count: { select: { suallar: true } },
      },
    });
    res.json(bankilar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/test-bankilar/:id
const getOne = async (req, res) => {
  try {
    const bank = await prisma.testBanki.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        fenn: { include: { movzular: true } },
        kafedra: true,
        elavEden: { select: { id: true, ad: true, soyad: true } },
        _count: { select: { suallar: true } },
      },
    });
    if (!bank) return res.status(404).json({ message: 'Test bankı tapılmadı' });
    res.json(bank);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/test-bankilar
const create = async (req, res) => {
  const { ad, fennId, fennExternalId, kafedraId, kafedraExternalId } = req.body;
  if (!ad) return res.status(400).json({ message: 'Ad tələb olunur' });

  let finalFennId = fennId ? Number(fennId) : undefined;
  let finalKafedraId = req.user.rol === 'KAFEDRA' ? req.user.kafedraId : kafedraId ? Number(kafedraId) : undefined;

  try {
    if (!finalFennId && fennExternalId) {
      const fenn = await getOrCreateFennFromEts(fennExternalId, req.user.id);
      finalFennId = fenn.id;
      if (!finalKafedraId) finalKafedraId = fenn.kafedraId;
    }

    if (!finalKafedraId && kafedraExternalId) {
      const kafedra = await getOrCreateKafedraFromEts(kafedraExternalId);
      finalKafedraId = kafedra.id;
    }

    if (!finalFennId) return res.status(400).json({ message: 'Fənn tələb olunur' });
    if (!finalKafedraId) {
      const fallbackFenn = await prisma.fenn.findUnique({ where: { id: finalFennId }, select: { kafedraId: true } });
      finalKafedraId = fallbackFenn?.kafedraId;
    }

    if (!finalKafedraId) return res.status(400).json({ message: 'Kafedra tələb olunur' });
    if (req.user.rol === 'KAFEDRA' && finalKafedraId !== req.user.kafedraId) {
      return res.status(403).json({ message: 'Test bankı yalnız öz kafedranıza əlavə edə bilərsiniz' });
    }

    const bank = await prisma.testBanki.create({
      data: {
        ad,
        fennId: finalFennId,
        kafedraId: finalKafedraId,
        elavEdenId: req.user.id,
        status: 'GOZLEYIR',
        blok: 'BAGLIDIR',
      },
      include: {
        fenn: { select: { id: true, fennAdi: true } },
        kafedra: { select: { id: true, ad: true } },
        elavEden: { select: { id: true, ad: true, soyad: true } },
      },
    });
    res.status(201).json(bank);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/test-bankilar/:id
const update = async (req, res) => {
  const { ad, fennId } = req.body;
  try {
    const bank = await prisma.testBanki.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(ad && { ad }),
        ...(fennId && { fennId: Number(fennId) }),
      },
      include: {
        fenn: { select: { id: true, fennAdi: true } },
        kafedra: { select: { id: true, ad: true } },
      },
    });
    res.json(bank);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Test bankı tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/test-bankilar/:id
const remove = async (req, res) => {
  try {
    await prisma.testBanki.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Test bankı silindi' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Test bankı tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/test-bankilar/:id/tesdiqle  — yalnız Admin
const tesdiqle = async (req, res) => {
  try {
    const bank = await prisma.testBanki.update({
      where: { id: Number(req.params.id) },
      data: { status: 'TESDIQLENDI', blok: 'ACIQDIR' },
    });
    res.json(bank);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Test bankı tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/test-bankilar/:id/tesdiqden-qaldir  — yalnız Admin
const tesdiqdenQaldir = async (req, res) => {
  try {
    const bank = await prisma.testBanki.update({
      where: { id: Number(req.params.id) },
      data: { status: 'GOZLEYIR', blok: 'BAGLIDIR' },
    });
    res.json(bank);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Test bankı tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/test-bankilar/:id/redakteye-gonder  — Admin
const redakyeyeGonder = async (req, res) => {
  const { qeyd } = req.body;
  try {
    const bank = await prisma.testBanki.update({
      where: { id: Number(req.params.id) },
      data: { status: 'REDAKTEYE_GONDERILIB' },
    });
    // TODO: qeyd notification modeli əlavə oluna bilər
    res.json({ ...bank, qeyd });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Test bankı tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/test-bankilar/:id/blok-toggle  — Admin
const blokToggle = async (req, res) => {
  try {
    const bank = await prisma.testBanki.findUnique({ where: { id: Number(req.params.id) } });
    if (!bank) return res.status(404).json({ message: 'Test bankı tapılmadı' });

    const updated = await prisma.testBanki.update({
      where: { id: bank.id },
      data: { blok: bank.blok === 'ACIQDIR' ? 'BAGLIDIR' : 'ACIQDIR' },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/test-bankilar/:id/umumibaxis  — bütün suallar cavablarla
const umumiBaxis = async (req, res) => {
  try {
    const suallar = await prisma.sual.findMany({
      where: { testBankiId: Number(req.params.id) },
      include: {
        movzu: { select: { id: true, ad: true } },
        cavablar: true,
      },
      orderBy: { yaradildi: 'asc' },
    });
    res.json(suallar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/test-bankilar/:id/cavabsiz-baxis  — cavabsız (Nəzəri/Düstur/Praktiki)
const cavabsizBaxis = async (req, res) => {
  try {
    const suallar = await prisma.sual.findMany({
      where: {
        testBankiId: Number(req.params.id),
        sualTipi: { in: ['NEZERI', 'DUSTUR', 'PRAKTIKI'] },
      },
      include: { movzu: { select: { id: true, ad: true } } },
      orderBy: { yaradildi: 'asc' },
    });
    res.json(suallar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/test-bankilar/:id/dogru-cavabsiz-baxis  — test sualları düzgün cavab göstərilmədən
const dogruCavabsizBaxis = async (req, res) => {
  try {
    const suallar = await prisma.sual.findMany({
      where: {
        testBankiId: Number(req.params.id),
        sualTipi: 'TEST',
      },
      include: {
        movzu: { select: { id: true, ad: true } },
        cavablar: {
          select: { id: true, metn: true, sekil: true, sira: true },
          // duzgundur field-i göndərilmir
        },
      },
      orderBy: { yaradildi: 'asc' },
    });
    res.json(suallar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = {
  getAll, getOne, create, update, remove,
  tesdiqle, tesdiqdenQaldir, redakyeyeGonder, blokToggle,
  umumiBaxis, cavabsizBaxis, dogruCavabsizBaxis,
};