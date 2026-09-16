const bcrypt = require('bcrypt');
const prisma = require('../prismaClient');

const SALT_ROUNDS = 10;

// GET /api/istifadeciler
const getAll = async (req, res) => {
  try {
    const { rol, kafedraId } = req.query;
    const where = {};
    if (rol) where.rol = rol;
    if (kafedraId) where.kafedraId = Number(kafedraId);

    const list = await prisma.istifadeci.findMany({
      where,
      orderBy: { ad: 'asc' },
      select: {
        id: true, ad: true, soyad: true, username: true,
        rol: true, aktiv: true, yaradildi: true,
        kafedra: { select: { id: true, ad: true } },
        muellimFennler: { include: { fenn: { select: { id: true, fennAdi: true } } } },
      },
    });
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/istifadeciler/:id
const getOne = async (req, res) => {
  try {
    const ist = await prisma.istifadeci.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true, ad: true, soyad: true, username: true,
        rol: true, aktiv: true, yaradildi: true,
        kafedra: { select: { id: true, ad: true } },
        muellimFennler: { include: { fenn: { select: { id: true, fennAdi: true } } } },
      },
    });
    if (!ist) return res.status(404).json({ message: 'İstifadəçi tapılmadı' });
    res.json(ist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/istifadeciler
// Body (Admin):   { ad, soyad, username, parol, rol: 'ADMIN' }
// Body (Kafedra): { ad, soyad, username, parol, rol: 'KAFEDRA', kafedraId }
// Body (Müəllim): { ad, soyad, username, parol, rol: 'MUELLIM', kafedraId, fennIds: [1,2] }
const create = async (req, res) => {
  const { ad, soyad, username, parol, rol, kafedraId, fennIds } = req.body;

  if (!ad || !soyad || !username || !parol || !rol) {
    return res.status(400).json({ message: 'Ad, soyad, username, parol və rol tələb olunur' });
  }

  if (rol === 'KAFEDRA' && !kafedraId) {
    return res.status(400).json({ message: 'Kafedra istifadəçisi üçün kafedra seçilməlidir' });
  }
  if (rol === 'MUELLIM' && !kafedraId) {
    return res.status(400).json({ message: 'Müəllim üçün kafedra seçilməlidir' });
  }

  try {
    const hash = await bcrypt.hash(parol, SALT_ROUNDS);

    const ist = await prisma.istifadeci.create({
      data: {
        ad, soyad, username,
        parol: hash,
        rol,
        kafedraId: kafedraId ? Number(kafedraId) : null,
        muellimFennler: fennIds?.length && rol === 'MUELLIM'
          ? { create: fennIds.map((fId) => ({ fennId: Number(fId) })) }
          : undefined,
      },
      select: {
        id: true, ad: true, soyad: true, username: true,
        rol: true, aktiv: true,
        kafedra: { select: { id: true, ad: true } },
        muellimFennler: { include: { fenn: { select: { id: true, fennAdi: true } } } },
      },
    });
    res.status(201).json(ist);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu username artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/istifadeciler/:id
const update = async (req, res) => {
  const { ad, soyad, username, parol, kafedraId, fennIds, aktiv } = req.body;

  try {
    let parolHash;
    if (parol) parolHash = await bcrypt.hash(parol, SALT_ROUNDS);

    // Əgər fennIds göndərilibsə, əvvəlcə köhnə fənn bağlantılarını sil
    if (fennIds !== undefined) {
      await prisma.muellimFenn.deleteMany({ where: { muellimId: Number(req.params.id) } });
    }

    const ist = await prisma.istifadeci.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(ad && { ad }),
        ...(soyad && { soyad }),
        ...(username && { username }),
        ...(parolHash && { parol: parolHash }),
        ...(kafedraId !== undefined && { kafedraId: kafedraId ? Number(kafedraId) : null }),
        ...(aktiv !== undefined && { aktiv }),
        ...(fennIds?.length && {
          muellimFennler: { create: fennIds.map((fId) => ({ fennId: Number(fId) })) },
        }),
      },
      select: {
        id: true, ad: true, soyad: true, username: true,
        rol: true, aktiv: true,
        kafedra: { select: { id: true, ad: true } },
        muellimFennler: { include: { fenn: { select: { id: true, fennAdi: true } } } },
      },
    });
    res.json(ist);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'İstifadəçi tapılmadı' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Bu username artıq mövcuddur' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/istifadeciler/:id  (deaktiv et, silmə)
const remove = async (req, res) => {
  try {
    // Tam silmə əvəzinə deaktiv etmək tövsiyə olunur
    await prisma.istifadeci.update({
      where: { id: Number(req.params.id) },
      data: { aktiv: false },
    });
    res.json({ message: 'İstifadəçi deaktiv edildi' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'İstifadəçi tapılmadı' });
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getAll, getOne, create, update, remove };