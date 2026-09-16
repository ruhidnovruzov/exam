const prisma = require('../prismaClient');

// GET /api/suallar?testBankiId=&movzuId=&sualTipi=&chetinlik=
const getAll = async (req, res) => {
  try {
    const { testBankiId, movzuId, sualTipi, chetinlik } = req.query;
    const where = {};
    if (testBankiId) where.testBankiId = Number(testBankiId);
    if (movzuId) where.movzuId = Number(movzuId);
    if (sualTipi) where.sualTipi = sualTipi;
    if (chetinlik) where.chetinlik = chetinlik;

    const suallar = await prisma.sual.findMany({
      where,
      orderBy: { yaradildi: 'asc' },
      include: {
        movzu: { select: { id: true, ad: true } },
        cavablar: true,
        _count: { select: { cavablar: true } },
      },
    });
    res.json(suallar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/suallar/:id
const getOne = async (req, res) => {
  try {
    const sual = await prisma.sual.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        movzu: { select: { id: true, ad: true } },
        testBanki: { select: { id: true, ad: true } },
        cavablar: { orderBy: { sira: 'asc' } },
      },
    });
    if (!sual) return res.status(404).json({ message: 'Sual tapılmadı' });
    res.json(sual);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/suallar
// Body: { testBankiId, movzuId, sualTipi, chetinlik, metn, sekil?, cavablar? }
// cavablar: [{ metn, sekil?, duzgundur, sira }]  — yalnız TEST tipi üçün
const create = async (req, res) => {
  const { testBankiId, movzuId, sualTipi, chetinlik, metn, sekil, cavablar } = req.body;

  if (!testBankiId || !movzuId || !sualTipi || !chetinlik || !metn) {
    return res.status(400).json({ message: 'Bütün vacib sahələr tələb olunur' });
  }

  // Test sualında cavablar olmalıdır və biri duzgundur=true olmalıdır
  if (sualTipi === 'TEST') {
    if (!cavablar || cavablar.length < 2) {
      return res.status(400).json({ message: 'Test sualında ən az 2 cavab tələb olunur' });
    }
    const duzgunSayi = cavablar.filter((c) => c.duzgundur).length;
    if (duzgunSayi !== 1) {
      return res.status(400).json({ message: 'Test sualında tam 1 düzgün cavab seçilməlidir' });
    }
  }

  // Qeyri-test sualında cavablar göndərilməməlidir
  if (['NEZERI', 'DUSTUR', 'PRAKTIKI'].includes(sualTipi) && cavablar?.length) {
    return res.status(400).json({ message: 'Bu sual tipinin cavab variantları olmur' });
  }

  // Test bankının mövcudluğunu yoxla
  const bank = await prisma.testBanki.findUnique({ where: { id: Number(testBankiId) } });
  if (!bank) return res.status(404).json({ message: 'Test bankı tapılmadı' });

  // Kafedra istifadəçisi yalnız öz kafedrasının bankına sual əlavə edə bilər
  if (req.user.rol === 'KAFEDRA' && bank.kafedraId !== req.user.kafedraId) {
    return res.status(403).json({ message: 'Bu test bankına giriş icazəniz yoxdur' });
  }

  // Mövzunun bu bankın fənninə aid olduğunu yoxla
  const movzu = await prisma.movzu.findUnique({ where: { id: Number(movzuId) } });
  if (!movzu || movzu.fennId !== bank.fennId) {
    return res.status(400).json({ message: 'Mövzu bu test bankının fənninə aid deyil' });
  }

  try {
    const sual = await prisma.sual.create({
      data: {
        testBankiId: Number(testBankiId),
        movzuId: Number(movzuId),
        sualTipi,
        chetinlik,
        metn,
        sekil: sekil || null,
        cavablar:
          sualTipi === 'TEST'
            ? {
                create: cavablar.map((c, i) => ({
                  metn: c.metn,
                  sekil: c.sekil || null,
                  duzgundur: !!c.duzgundur,
                  sira: c.sira ?? i,
                })),
              }
            : undefined,
      },
      include: {
        movzu: { select: { id: true, ad: true } },
        cavablar: { orderBy: { sira: 'asc' } },
      },
    });
    res.status(201).json(sual);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/suallar/:id
const update = async (req, res) => {
  const { movzuId, sualTipi, chetinlik, metn, sekil, cavablar } = req.body;

  try {
    // Mövcud sualı tap
    const movcud = await prisma.sual.findUnique({ where: { id: Number(req.params.id) } });
    if (!movcud) return res.status(404).json({ message: 'Sual tapılmadı' });

    const yeniTip = sualTipi || movcud.sualTipi;

    if (yeniTip === 'TEST' && cavablar) {
      const duzgunSayi = cavablar.filter((c) => c.duzgundur).length;
      if (duzgunSayi !== 1) {
        return res.status(400).json({ message: 'Test sualında tam 1 düzgün cavab seçilməlidir' });
      }
    }

    // Əvvəlcə köhnə cavabları sil, sonra yenilərini yaz
    if (cavablar) {
      await prisma.cavab.deleteMany({ where: { sualId: Number(req.params.id) } });
    }

    const sual = await prisma.sual.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(movzuId && { movzuId: Number(movzuId) }),
        ...(sualTipi && { sualTipi }),
        ...(chetinlik && { chetinlik }),
        ...(metn && { metn }),
        sekil: sekil !== undefined ? sekil : undefined,
        ...(cavablar && yeniTip === 'TEST' && {
          cavablar: {
            create: cavablar.map((c, i) => ({
              metn: c.metn,
              sekil: c.sekil || null,
              duzgundur: !!c.duzgundur,
              sira: c.sira ?? i,
            })),
          },
        }),
      },
      include: {
        movzu: { select: { id: true, ad: true } },
        cavablar: { orderBy: { sira: 'asc' } },
      },
    });
    res.json(sual);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/suallar/:id
const remove = async (req, res) => {
  try {
    await prisma.sual.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Sual silindi' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Sual tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/suallar/statistika?testBankiId=
// Sual tipinə + çətinlik dərəcəsinə görə say statistikası
const statistika = async (req, res) => {
  const { testBankiId } = req.query;
  if (!testBankiId) return res.status(400).json({ message: 'testBankiId tələb olunur' });

  try {
    const stats = await prisma.sual.groupBy({
      by: ['sualTipi', 'chetinlik'],
      where: { testBankiId: Number(testBankiId) },
      _count: { id: true },
    });
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, getOne, create, update, remove, statistika };