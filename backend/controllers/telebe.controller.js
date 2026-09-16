const prisma = require('../prismaClient');

// GET /api/telebeler
const getAll = async (req, res) => {
  try {
    const { qrup, ixtisas, kurs } = req.query;
    const where = {};
    if (qrup) where.qrup = { contains: qrup, mode: 'insensitive' };
    if (ixtisas) where.ixtisas = { contains: ixtisas, mode: 'insensitive' };
    if (kurs) where.kurs = Number(kurs);

    const telebeler = await prisma.telebe.findMany({
      where,
      orderBy: [{ soyad: 'asc' }, { ad: 'asc' }],
    });
    res.json(telebeler);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/telebeler/:id
const getOne = async (req, res) => {
  try {
    const telebe = await prisma.telebe.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        imtahanlar: {
          include: { imtahan: { select: { id: true, ad: true, baslamaVaxti: true } } },
          orderBy: { yaradildi: 'desc' },
        },
      },
    });
    if (!telebe) return res.status(404).json({ message: 'Tələbə tapılmadı' });
    res.json(telebe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/telebeler  — ETS-dən gəlir (bulk import)
// Body: { telebeler: [{ etsId, ad, soyad, ata, qrup, ixtisas, kurs, email }] }
const bulkUpsert = async (req, res) => {
  const { telebeler } = req.body;
  if (!telebeler?.length) return res.status(400).json({ message: 'Tələbə siyahısı boşdur' });

  try {
    // upsert — etsId varsa yenilə, yoxdursa yaz
    const ops = telebeler.map((t) =>
      prisma.telebe.upsert({
        where: { etsId: t.etsId },
        update: {
          ad: t.ad, soyad: t.soyad, ata: t.ata,
          qrup: t.qrup, ixtisas: t.ixtisas,
          kurs: t.kurs ? Number(t.kurs) : null,
          email: t.email,
        },
        create: {
          etsId: t.etsId, ad: t.ad, soyad: t.soyad, ata: t.ata,
          qrup: t.qrup, ixtisas: t.ixtisas,
          kurs: t.kurs ? Number(t.kurs) : null,
          email: t.email,
        },
      })
    );

    const result = await prisma.$transaction(ops);
    res.status(201).json({ idxal: result.length, mesaj: `${result.length} tələbə idxal edildi` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/telebeler/:id
const update = async (req, res) => {
  const { ad, soyad, ata, qrup, ixtisas, kurs, email } = req.body;
  try {
    const telebe = await prisma.telebe.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(ad && { ad }), ...(soyad && { soyad }), ...(ata !== undefined && { ata }),
        ...(qrup !== undefined && { qrup }), ...(ixtisas !== undefined && { ixtisas }),
        ...(kurs !== undefined && { kurs: kurs ? Number(kurs) : null }),
        ...(email !== undefined && { email }),
      },
    });
    res.json(telebe);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Tələbə tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, getOne, bulkUpsert, update };