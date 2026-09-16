const prisma = require('../prismaClient');
const bcrypt = require('bcrypt');
const {
  ensureTeachersFromEtsIds,
  buildMuellimAssignments,
  ensureQuestionTypeOrder,
} = require('../services/teacherSyncService');

// ============================================================
// Köməkçi: çətinliyə görə bərabər nisbətdə sual seç
// ============================================================
async function sualSec(testBankiId, sualTipi, movzuIds, lazimSayi) {
  const chetinlikler = ['ASAN', 'ORTA', 'CETTIN'];
  const herBirinden = Math.floor(lazimSayi / 3);
  const qalan = lazimSayi % 3; // artıq qalan ORTA-ya əlavə olunur

  const movzuFilter = movzuIds?.length ? { movzuId: { in: movzuIds } } : {};

  let secilmis = [];

  for (let i = 0; i < chetinlikler.length; i++) {
    const ched = chetinlikler[i];
    const say = herBirinden + (i === 1 ? qalan : 0); // artıq qalan ORTA-ya
    if (say === 0) continue;

    const suallar = await prisma.sual.findMany({
      where: { testBankiId, sualTipi, chetinlik: ched, ...movzuFilter },
    });

    // Random qarışdır
    const karisdirilmis = suallar.sort(() => Math.random() - 0.5).slice(0, say);
    secilmis = secilmis.concat(karisdirilmis);
  }

  // Kifayət qədər sual yoxdursa qalanını istənilən çətinlikdən götür
  if (secilmis.length < lazimSayi) {
    const artiqIds = secilmis.map((s) => s.id);
    const elave = await prisma.sual.findMany({
      where: {
        testBankiId,
        sualTipi,
        ...movzuFilter,
        id: { notIn: artiqIds },
      },
      take: lazimSayi - secilmis.length,
    });
    secilmis = secilmis.concat(elave);
  }

  return secilmis;
}

// ============================================================
// GET /api/imtahanlar
// ============================================================
const getAll = async (req, res) => {
  try {
    const { fennId, tedrisIlId, status } = req.query;
    const where = {};
    if (fennId) where.fennId = Number(fennId);
    if (tedrisIlId) where.tedrisIlId = Number(tedrisIlId);
    if (status) where.status = status;

    const imtahanlar = await prisma.imtahan.findMany({
      where,
      orderBy: { baslamaVaxti: 'desc' },
      include: {
        fenn: { select: { id: true, fennAdi: true, fennKodu: true } },
        tedrisIl: true,
        terkib: true,
        _count: { select: { telebeleri: true, suallar: true } },
      },
    });
    res.json(imtahanlar);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/imtahanlar/:id
const getOne = async (req, res) => {
  try {
    const imtahan = await prisma.imtahan.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        fenn: { include: { movzular: true } },
        tedrisIl: true,
        testBankilar: { include: { testBanki: { select: { id: true, ad: true } } } },
        movzular: { include: { movzu: { select: { id: true, ad: true } } } },
        terkib: true,
        _count: { select: { telebeleri: true } },
      },
    });
    if (!imtahan) return res.status(404).json({ message: 'İmtahan tapılmadı' });
    res.json(imtahan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// ============================================================
// POST /api/imtahanlar
// Body: {
//   ad, fennId, tedrisIlId, imtahanNovu, tehsilNovu,
//   muddet, kecidBali, imtahanSecimi,
//   baslamaVaxti, bitmeVaxti,
//   testBankiIds: [1,2],
//   movzuIds?: [1,2,3],   // opsional
//   terkib: [
//     { sualTipi: 'TEST', sualSayi: 20, balPerSual: 1, yoxlamaMuddeti: null },
//     { sualTipi: 'NEZERI', sualSayi: 5, balPerSual: 4, yoxlamaMuddeti: 3 },
//     ...
//   ]
// }
// ============================================================
const create = async (req, res) => {
  const {
    ad, fennId, tedrisIlId, imtahanNovu, tehsilNovu,
    muddet, kecidBali, imtahanSecimi,
    baslamaVaxti, bitmeVaxti,
    testBankiIds, movzuIds, terkib,
    subjectGroupExternalId,
    sualTipleri,
    etsSubjectId
  } = req.body;

  // require basic fields and at least one sual tipi (either via terkib or sualTipleri)
  if (!ad || (!fennId && !etsSubjectId) || !tedrisIlId || !tehsilNovu ||
      !muddet || kecidBali === undefined || !imtahanSecimi ||
      !baslamaVaxti || !bitmeVaxti || !testBankiIds?.length ||
      (!terkib?.length && !sualTipleri?.length)) {
    return res.status(400).json({ message: 'Bütün vacib sahələr tələb olunur' });
  }

  // default mapping for sual tipi when terkib not provided
  const DEFAULT_TERKIB_MAP = {
    TEST: { sualSayi: 20, balPerSual: 1, yoxlamaMuddeti: null },
    NEZERI: { sualSayi: 5, balPerSual: 4, yoxlamaMuddeti: 7 },
    DUSTUR: { sualSayi: 3, balPerSual: 5, yoxlamaMuddeti: 7 },
    PRAKTIKI: { sualSayi: 2, balPerSual: 10, yoxlamaMuddeti: 7 },
  };

  let finalFennId = Number(fennId) || null;

  try {
    const etsService = require('../services/etsImportService');

    // If ETS subject ID provided, fetch/create the fenn from ETS
    if (etsSubjectId && !finalFennId) {
      const fenn = await etsService.getOrCreateFennFromEts(etsSubjectId, req.user?.id || 1);
      finalFennId = fenn.id;
    }

    // If ETS subject group provided, ensure local fenn exists and set fennId
    if (!finalFennId && subjectGroupExternalId) {
      const group = await etsService.findEtsSubjectGroup(subjectGroupExternalId);
      if (!group) return res.status(404).json({ message: 'ETS subject group tapılmadı' });

      const subjectExternalId = group?.subject?.id ?? group?.subjectId ?? null;
      if (subjectExternalId) {
        const fenn = await etsService.getOrCreateFennFromEts(subjectExternalId, req.user?.id || 1);
        finalFennId = fenn.id;
      }
    }

    if (!finalFennId) {
      return res.status(400).json({ message: 'Fənn seçilməlidir' });
    }

    // Test bankları bu fənndən olmalıdır
    const banklar = await prisma.testBanki.findMany({
      where: { id: { in: testBankiIds.map(Number) }, fennId: finalFennId, status: 'TESDIQLENDI' },
    });
    if (banklar.length !== testBankiIds.length) {
      return res.status(400).json({ message: 'Bəzi test bankları tapılmadı, bu fənnə aid deyil və ya təsdiqlənməyib' });
    }

    // determine final terkib: prefer explicit `terkib`, otherwise build from `sualTipleri`
    const finalTerkib = (terkib && terkib.length)
      ? terkib
      : (sualTipleri || []).map((st) => ({
        sualTipi: st,
        sualSayi: DEFAULT_TERKIB_MAP[st]?.sualSayi ?? 0,
        balPerSual: DEFAULT_TERKIB_MAP[st]?.balPerSual ?? 0,
        yoxlamaMuddeti: DEFAULT_TERKIB_MAP[st]?.yoxlamaMuddeti ?? null,
      }));

    const imtahan = await prisma.imtahan.create({
      data: {
        ad,
        fenn: { connect: { id: finalFennId } },
        tedrisIl: { connect: { id: Number(tedrisIlId) } },
        imtahanNovu,
        sualTipleri: sualTipleri || [],
        tehsilNovu,
        muddet: Number(muddet),
        kecidBali: Number(kecidBali),
        imtahanSecimi,
        baslamaVaxti: new Date(baslamaVaxti),
        bitmeVaxti: new Date(bitmeVaxti),
        testBankilar: {
          create: testBankiIds.map((id) => ({ testBankiId: Number(id) })),
        },
        movzular: movzuIds?.length
          ? { create: movzuIds.map((id) => ({ movzuId: Number(id) })) }
          : undefined,
        subjectGroupExternalId: subjectGroupExternalId ? String(subjectGroupExternalId) : null,
        terkib: {
          create: finalTerkib.map((t) => ({
            sualTipi: t.sualTipi,
            sualSayi: Number(t.sualSayi),
            balPerSual: Number(t.balPerSual),
            yoxlamaMuddeti: t.yoxlamaMuddeti ? Number(t.yoxlamaMuddeti) : null,
          })),
        },
      },
      include: {
        fenn: { select: { id: true, fennAdi: true } },
        terkib: true,
        testBankilar: true,
        movzular: true,
      },
    });

    // If ETS subject group provided -> import students and attach
    if (subjectGroupExternalId) {
      try {
        const etsService = require('../services/etsImportService');
        const studentsPayload = await etsService.getEtsSubjectGroupStudents(subjectGroupExternalId);
        const students = Array.isArray(studentsPayload) ? studentsPayload : (studentsPayload?.students ?? []);

        if (students.length > 0) {
          // Upsert Student (central) when possible (match by pin), then upsert Telebe (exam) also.
          const telebeMap = new Map();
          for (const s of students) {
            const etsId = String(s.id);

            let studentRecord = null;
            // Prefer matching by pin (FIN)
            if (s.pin) {
              try {
                studentRecord = await prisma.student.upsert({
                  where: { pin: String(s.pin) },
                  update: {
                    firstName: s.firstName || undefined,
                    lastName: s.lastName || undefined,
                    fatherName: s.fatherName || undefined,
                    email: s.email || undefined,
                    mobile: s.mobile || undefined,
                    course: s.course ? parseInt(s.course) : undefined,
                    registrationType: s.registrationType || undefined,
                    admissionDate: s.admissionDate ? new Date(s.admissionDate) : undefined,
                  },
                  create: {
                    firstName: s.firstName || '',
                    lastName: s.lastName || '',
                    fatherName: s.fatherName || undefined,
                    pin: String(s.pin),
                    email: s.email || '',
                    mobile: s.mobile || undefined,
                    course: s.course ? parseInt(s.course) : undefined,
                    registrationType: s.registrationType || undefined,
                    admissionDate: s.admissionDate ? new Date(s.admissionDate) : undefined,
                    facultyId: 1, // fallback - adjust if you want to map faculty
                    specialtyId: 1,
                  }
                });

                // Note: user creation is intentionally skipped here to avoid role mismatches.
              } catch (err) {
                console.error('Student upsert failed', err);
                studentRecord = null;
              }
            }

            // Upsert Telebe (exam DB) - always create/update by etsId
            const up = await prisma.telebe.upsert({
              where: { etsId },
              update: {
                ad: s.firstName || s.ad || undefined,
                soyad: s.lastName || s.soyad || undefined,
                ata: s.fatherName || undefined,
                qrup: s.group || undefined,
                ixtisas: s.specialization || undefined,
                kurs: s.course ? parseInt(s.course) : undefined,
                email: s.email || undefined,
              },
              create: {
                etsId,
                ad: s.firstName || s.ad || '',
                soyad: s.lastName || s.soyad || '',
                ata: s.fatherName || undefined,
                qrup: s.group || undefined,
                ixtisas: s.specialization || undefined,
                kurs: s.course ? parseInt(s.course) : undefined,
                email: s.email || undefined,
              }
            });
            telebeMap.set(up.id, up);
          }

          // Prepare imtahanTelebe and imtahanSual rows similar to telebeElave
          const telebeIds = Array.from(telebeMap.keys());

          // avoid duplicates
          const existing = await prisma.imtahanTelebe.findMany({ where: { imtahanId: imtahan.id, telebeId: { in: telebeIds } }, select: { telebeId: true } });
          const existingSet = new Set(existing.map(e => e.telebeId));
          const yeniIds = telebeIds.filter(id => !existingSet.has(id));

          if (yeniIds.length > 0) {
            const movzuIdsFinal = imtahan.movzular.map((m) => m.movzuId);
            const testBankiIdsFinal = imtahan.testBankilar.map((t) => t.testBankiId);

            const telebeRows = [];
            const sualRows = [];

            for (const telebeId of yeniIds) {
              telebeRows.push({ imtahanId: imtahan.id, telebeId });

              let sira = 0;
              const tipSiraMap = {};
              for (const t of imtahan.terkib) {
                if (t.sualSayi === 0) continue;

                for (const bankId of testBankiIdsFinal) {
                  const secilmis = await sualSec(bankId, t.sualTipi, movzuIdsFinal, t.sualSayi);
                  for (const s of secilmis) {
                    tipSiraMap[t.sualTipi] = (tipSiraMap[t.sualTipi] || 0) + 1;
                    sualRows.push({
                      imtahanId: imtahan.id,
                      telebeId,
                      sualId: s.id,
                      sira: sira++,
                      tipSira: tipSiraMap[t.sualTipi],
                    });
                  }
                  break;
                }
              }
            }

            await prisma.$transaction([
              prisma.imtahanTelebe.createMany({ data: telebeRows, skipDuplicates: true }),
              prisma.imtahanSual.createMany({ data: sualRows, skipDuplicates: true }),
            ]);
          }
        }
      } catch (err) {
        console.error('ETS students import failed:', err);
        // do not fail exam creation for import errors; just log
      }
    }
    res.status(201).json(imtahan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// PUT /api/imtahanlar/:id  (yalnız PLANLANIB statusunda)
const update = async (req, res) => {
  const { ad, muddet, kecidBali, baslamaVaxti, bitmeVaxti } = req.body;

  try {
    const movcud = await prisma.imtahan.findUnique({ where: { id: Number(req.params.id) } });
    if (!movcud) return res.status(404).json({ message: 'İmtahan tapılmadı' });
    if (movcud.status !== 'PLANLANIB') {
      return res.status(400).json({ message: 'Yalnız planlanmış imtahanlar dəyişdirilə bilər' });
    }

    const imtahan = await prisma.imtahan.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(ad && { ad }),
        ...(muddet && { muddet: Number(muddet) }),
        ...(kecidBali !== undefined && { kecidBali: Number(kecidBali) }),
        ...(baslamaVaxti && { baslamaVaxti: new Date(baslamaVaxti) }),
        ...(bitmeVaxti && { bitmeVaxti: new Date(bitmeVaxti) }),
      },
    });
    res.json(imtahan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// DELETE /api/imtahanlar/:id
const remove = async (req, res) => {
  try {
    const movcud = await prisma.imtahan.findUnique({ where: { id: Number(req.params.id) } });
    if (!movcud) return res.status(404).json({ message: 'İmtahan tapılmadı' });
    if (movcud.status === 'AKTIV') {
      return res.status(400).json({ message: 'Aktiv imtahan silinə bilməz' });
    }

    await prisma.imtahan.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'İmtahan silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// ============================================================
// POST /api/imtahanlar/:id/telebeler
// Body: { telebeIds: [1, 2, 3] }
// Tələbələri imtahana təhkim et + hər tələbə üçün sual paketin yarat
// ============================================================
const telebeElave = async (req, res) => {
  const imtahanId = Number(req.params.id);
  const { telebeIds } = req.body;

  if (!telebeIds?.length) return res.status(400).json({ message: 'Tələbə siyahısı tələb olunur' });

  try {
    const imtahan = await prisma.imtahan.findUnique({
      where: { id: imtahanId },
      include: {
        terkib: true,
        testBankilar: true,
        movzular: true,
      },
    });
    if (!imtahan) return res.status(404).json({ message: 'İmtahan tapılmadı' });

    const movzuIds = imtahan.movzular.map((m) => m.movzuId);
    const testBankiIds = imtahan.testBankilar.map((t) => t.testBankiId);

    // Artıq əlavə olunmuş tələbələri çıxart
    const movcudlar = await prisma.imtahanTelebe.findMany({
      where: { imtahanId, telebeId: { in: telebeIds.map(Number) } },
      select: { telebeId: true },
    });
    const movcudIds = new Set(movcudlar.map((m) => m.telebeId));
    const yeniIds = telebeIds.map(Number).filter((id) => !movcudIds.has(id));

    if (!yeniIds.length) {
      return res.status(409).json({ message: 'Bütün tələbələr artıq bu imtahana təhkim olunub' });
    }

    // Hər yeni tələbə üçün sual paketin random yarat
    const telebeRows = [];
    const sualRows = [];

    for (const telebeId of yeniIds) {
      telebeRows.push({ imtahanId, telebeId });

      let sira = 0;
      const tipSiraMap = {};
      for (const t of imtahan.terkib) {
        if (t.sualSayi === 0) continue;

        // Bütün test banklarından bu tip + çətinlik üzrə sual seç
        for (const bankId of testBankiIds) {
          const secilmis = await sualSec(bankId, t.sualTipi, movzuIds, t.sualSayi);
          for (const s of secilmis) {
            tipSiraMap[t.sualTipi] = (tipSiraMap[t.sualTipi] || 0) + 1;
            sualRows.push({
              imtahanId,
              telebeId,
              sualId: s.id,
              sira: sira++,
              tipSira: tipSiraMap[t.sualTipi],
            });
          }
          break; // hər sual tipindən yalnız 1 bankdan götürülür (ilk uyğun bank)
        }
      }
    }

    // Transaction ilə yazılır
    await prisma.$transaction([
      prisma.imtahanTelebe.createMany({ data: telebeRows, skipDuplicates: true }),
      prisma.imtahanSual.createMany({ data: sualRows, skipDuplicates: true }),
    ]);

    res.status(201).json({ elave: yeniIds.length, mesaj: `${yeniIds.length} tələbə təhkim olundu` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/imtahanlar/:id/telebeler
const getTelebeler = async (req, res) => {
  try {
    const telebeler = await prisma.imtahanTelebe.findMany({
      where: { imtahanId: Number(req.params.id) },
      include: {
        telebe: true,
      },
      orderBy: { yaradildi: 'asc' },
    });
    res.json(telebeler);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/imtahanlar/:id/neticeler  — imtahan nəticələri cədvəli
const getNeticeler = async (req, res) => {
  try {
    const neticeler = await prisma.imtahanTelebe.findMany({
      where: { imtahanId: Number(req.params.id) },
      include: {
        telebe: { select: { id: true, ad: true, soyad: true, ata: true, qrup: true } },
      },
      orderBy: [{ kecdi: 'desc' }, { bal: 'desc' }],
    });
    res.json(neticeler);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// GET /api/imtahanlar/:id/muellimler
const getMuellimler = async (req, res) => {
  try {
    const rows = await prisma.imtahanMuellim.findMany({
      where: { imtahanId: Number(req.params.id) },
      include: {
        muellim: { select: { id: true, ad: true, soyad: true, username: true, etsId: true } },
      },
      orderBy: [{ sualTipi: 'asc' }, { sualBaslangic: 'asc' }],
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server xətası' });
  }
};

// POST /api/imtahanlar/:id/muellimler
// Body: { etsTeacherIds: [1, 2, 3] }
const assignMuellimler = async (req, res) => {
  const imtahanId = Number(req.params.id);
  const { etsTeacherIds } = req.body;

  if (!etsTeacherIds?.length) {
    return res.status(400).json({ message: 'Ən azı bir müəllim seçilməlidir' });
  }

  try {
    const imtahan = await prisma.imtahan.findUnique({ where: { id: imtahanId }, include: { terkib: true } });
    if (!imtahan) return res.status(404).json({ message: 'İmtahan tapılmadı' });

    const teachers = await ensureTeachersFromEtsIds(etsTeacherIds.map(String));
    const assignments = buildMuellimAssignments(imtahan.terkib, teachers);

    if (!assignments.length) {
      return res.status(400).json({ message: 'Bu imtahanda müəllim yoxlaması tələb edən sual tipi yoxdur (Nəzəri/Düstur/Praktiki)' });
    }

    await prisma.$transaction([
      prisma.imtahanMuellim.deleteMany({ where: { imtahanId } }),
      prisma.imtahanMuellim.createMany({ data: assignments.map((a) => ({ ...a, imtahanId })) }),
    ]);
    await ensureQuestionTypeOrder(imtahanId);

    const saved = await prisma.imtahanMuellim.findMany({
      where: { imtahanId },
      include: { muellim: { select: { id: true, ad: true, soyad: true, username: true, etsId: true } } },
    });

    res.status(201).json({ message: `${teachers.length} müəllim təhkim olundu`, assignments: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server xətası' });
  }
};

module.exports = { getAll, getOne, create, update, remove, telebeElave, getTelebeler, getNeticeler, getMuellimler, assignMuellimler };
