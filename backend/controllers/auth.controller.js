const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { loginTeacher } = require('../services/etsAuthService');
const { ensureTeacherIstifadeci } = require('../services/teacherSyncService');

const issueToken = (istifadeci) =>
  jwt.sign(
    {
      id: istifadeci.id,
      username: istifadeci.username,
      rol: istifadeci.rol,
      kafedraId: istifadeci.kafedraId,
      etsId: istifadeci.etsId || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

const serializeUser = (istifadeci) => ({
  id: istifadeci.id,
  ad: istifadeci.ad,
  soyad: istifadeci.soyad,
  username: istifadeci.username,
  rol: istifadeci.rol,
  etsId: istifadeci.etsId || null,
  kafedra: istifadeci.kafedra || null,
});

const register = async (req, res) => {
  const { username, parol, ad, soyad, rol } = req.body;
  if (!username || !parol || !ad || !soyad) {
    return res.status(400).json({ message: 'Username, parol, ad və soyad tələb olunur' });
  }

  try {
    const existing = await prisma.istifadeci.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: 'Bu istifadəçi adı artıq mövcuddur' });
    }

    const hash = await bcrypt.hash(parol, 10);
    const user = await prisma.istifadeci.create({
      data: {
        username,
        parol: hash,
        ad,
        soyad,
        rol: rol || 'ADMIN',
      },
    });

    const token = issueToken(user);
    res.status(201).json({ token, istifadeci: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/auth/login
// Admin/Kafedra: local bcrypt. Müəllim: ETS username + password.
const login = async (req, res) => {
  const { username, parol } = req.body;

  if (!username || !parol) {
    return res.status(400).json({ message: 'Username və parol tələb olunur' });
  }

  try {
    const istifadeci = await prisma.istifadeci.findUnique({
      where: { username },
      include: { kafedra: { select: { id: true, ad: true } } },
    });

    if (istifadeci && istifadeci.aktiv && istifadeci.rol !== 'MUELLIM') {
      const uygun = await bcrypt.compare(parol, istifadeci.parol);
      if (uygun) {
        const token = issueToken(istifadeci);
        return res.json({ token, istifadeci: serializeUser(istifadeci) });
      }
      return res.status(401).json({ message: 'Parol yanlışdır' });
    }

    const ets = await loginTeacher({ identifier: username, password: parol });
    const muellim = await ensureTeacherIstifadeci(ets.profile);
    const withKafedra = await prisma.istifadeci.findUnique({
      where: { id: muellim.id },
      include: { kafedra: { select: { id: true, ad: true } } },
    });

    if (!withKafedra?.aktiv) {
      return res.status(403).json({ message: 'Hesab deaktivdir' });
    }

    const token = issueToken(withKafedra);
    res.json({ token, istifadeci: serializeUser(withKafedra) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: err.message || 'Giriş uğursuz oldu' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const istifadeci = await prisma.istifadeci.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        ad: true,
        soyad: true,
        username: true,
        rol: true,
        etsId: true,
        kafedra: { select: { id: true, ad: true } },
        muellimFennler: { include: { fenn: { select: { id: true, fennAdi: true } } } },
      },
    });
    res.json(istifadeci);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { register, login, me };
