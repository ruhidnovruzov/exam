const prisma = require('../prismaClient');

const getStats = async (req, res) => {
  try {
    const [
      kafedralar,
      fennler,
      testBankilar,
      movzular,
      suallar,
      imtahanlar,
      telebeler,
      istifadeciler,
      tedrisIller,
    ] = await Promise.all([
      prisma.kafedra.count(),
      prisma.fenn.count(),
      prisma.testBanki.count(),
      prisma.movzu.count(),
      prisma.sual.count(),
      prisma.imtahan.count(),
      prisma.telebe.count(),
      prisma.istifadeci.count(),
      prisma.tedrisIl.count(),
    ]);

    res.json({
      kafedralar,
      fennler,
      testBankilar,
      movzular,
      suallar,
      imtahanlar,
      telebeler,
      istifadeciler,
      tedrisIller,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

module.exports = { getStats };