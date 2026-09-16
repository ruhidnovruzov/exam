const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../prismaClient');
const { findEtsTeacher } = require('./etsImportService');

const GRADABLE_TYPES = ['NEZERI', 'DUSTUR', 'PRAKTIKI'];

const generateYoxlamaKodu = () => {
  const part = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `TX-${part}`;
};

const ensureTeacherIstifadeci = async (profile, etsTeacherData = null) => {
  const etsId = String(profile.teacherId);
  let teacherData = etsTeacherData;

  if (!teacherData) {
    try {
      teacherData = await findEtsTeacher(etsId);
    } catch {
      teacherData = null;
    }
  }

  const ad = profile.firstName || teacherData?.firstName || 'Müəllim';
  const soyad = profile.lastName || teacherData?.lastName || '';
  const username = profile.username || teacherData?.pin || etsId;

  let istifadeci = await prisma.istifadeci.findFirst({
    where: { OR: [{ etsId }, { username }] },
  });

  if (istifadeci) {
    if (!istifadeci.etsId || istifadeci.rol !== 'MUELLIM') {
      istifadeci = await prisma.istifadeci.update({
        where: { id: istifadeci.id },
        data: {
          etsId,
          rol: 'MUELLIM',
          ad,
          soyad,
          aktiv: true,
        },
      });
    }
    return istifadeci;
  }

  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  return prisma.istifadeci.create({
    data: {
      ad,
      soyad,
      username,
      parol: hash,
      rol: 'MUELLIM',
      etsId,
      aktiv: true,
    },
  });
};

const ensureTeachersFromEtsIds = async (etsTeacherIds) => {
  const results = [];
  for (const rawId of etsTeacherIds) {
    const etsId = String(rawId);
    const teacherData = await findEtsTeacher(etsId);
    if (!teacherData) {
      throw new Error(`ETS müəllimi tapılmadı: ${etsId}`);
    }
    const profile = {
      teacherId: teacherData.id,
      username: teacherData.pin || teacherData.user?.username,
      firstName: teacherData.firstName,
      lastName: teacherData.lastName,
    };
    const istifadeci = await ensureTeacherIstifadeci(profile, teacherData);
    results.push({ etsId, istifadeci, teacherData });
  }
  return results;
};

const distributeQuestionRanges = (sualSayi, teacherCount) => {
  const ranges = [];
  const base = Math.floor(sualSayi / teacherCount);
  let remainder = sualSayi % teacherCount;
  let start = 1;

  for (let i = 0; i < teacherCount; i += 1) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    const portion = base + extra;
    if (portion > 0) {
      ranges.push({ sualBaslangic: start, sualSon: start + portion - 1 });
      start += portion;
    }
  }
  return ranges;
};

const buildMuellimAssignments = (terkib, teachers) => {
  const assignments = [];
  const teacherCount = teachers.length;
  if (!teacherCount) return assignments;

  for (const sualTipi of GRADABLE_TYPES) {
    const row = terkib.find((t) => t.sualTipi === sualTipi);
    if (!row || row.sualSayi <= 0) continue;

    const ranges = distributeQuestionRanges(row.sualSayi, teacherCount);
    ranges.forEach((range, index) => {
      const teacher = teachers[index];
      if (!teacher) return;
      assignments.push({
        muellimId: teacher.istifadeci.id,
        etsTeacherId: teacher.etsId,
        sualTipi,
        sualBaslangic: range.sualBaslangic,
        sualSon: range.sualSon,
      });
    });
  }

  return assignments;
};

const ensureQuestionTypeOrder = async (imtahanId) => {
  const rows = await prisma.imtahanSual.findMany({
    where: {
      imtahanId,
      sual: { sualTipi: { in: GRADABLE_TYPES } },
    },
    select: {
      id: true,
      telebeId: true,
      sira: true,
      tipSira: true,
      sual: { select: { sualTipi: true } },
    },
    orderBy: [{ telebeId: 'asc' }, { sira: 'asc' }],
  });

  const counters = new Map();
  const updates = [];

  for (const row of rows) {
    const key = `${row.telebeId}:${row.sual.sualTipi}`;
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);

    if (row.tipSira !== next) {
      updates.push(prisma.imtahanSual.update({
        where: { id: row.id },
        data: { tipSira: next },
      }));
    }
  }

  if (!updates.length) return 0;

  for (let i = 0; i < updates.length; i += 100) {
    await prisma.$transaction(updates.slice(i, i + 100));
  }

  return updates.length;
};

module.exports = {
  GRADABLE_TYPES,
  generateYoxlamaKodu,
  ensureTeacherIstifadeci,
  ensureTeachersFromEtsIds,
  distributeQuestionRanges,
  buildMuellimAssignments,
  ensureQuestionTypeOrder,
};
