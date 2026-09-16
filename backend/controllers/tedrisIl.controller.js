const prisma = require('../prismaClient');

// GET /api/tedris-iller
const getAll = async (req, res) => {
  try {
    const iller = await prisma.tedrisIl.findMany({
      orderBy: [{ il: 'desc' }, { fesil: 'asc' }],
    });
    res.json(iller);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/tedris-iller
// Body: { il: 2026, fesil: 'YAZ' }
const create = async (req, res) => {
  const { il, fesil } = req.body;
  if (!il || !fesil) return res.status(400).json({ message: 'İl və fəsil tələb olunur' });

  const label = `${il} ${fesil === 'YAZ' ? 'Yaz' : 'Payız'}`;

  try {
    const tedrisIl = await prisma.tedrisIl.create({
      data: { il: Number(il), fesil, label },
    });
    res.status(201).json(tedrisIl);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu tədris ili artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/tedris-iller/:id/aktiv
const aktivEt = async (req, res) => {
  try {
    const tedrisIl = await prisma.tedrisIl.update({
      where: { id: Number(req.params.id) },
      data: { aktiv: true },
    });
    res.json(tedrisIl);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Tədris ili tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, create, aktivEt };