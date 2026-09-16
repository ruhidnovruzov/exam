const http = require('http');
const https = require('https');
const { URL } = require('url');
const prisma = require('../prismaClient');

const ETS_API_BASE_URL = process.env.ETS_API_BASE_URL || 'http://localhost:5001/api';
const ETS_API_KEY = process.env.ETS_API_KEY || '';
const ETS_API_TOKEN = process.env.ETS_API_TOKEN || '';

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const headers = { Accept: 'application/json' };
    // Prefer a Bearer token if provided, otherwise fall back to x-api-key
    if (ETS_API_TOKEN) {
      headers['Authorization'] = `Bearer ${ETS_API_TOKEN}`;
    } else if (ETS_API_KEY) {
      headers['x-api-key'] = ETS_API_KEY;
    }

    const req = client.get(parsed, { headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        // Try to parse body as JSON for richer error messages
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (err) {
          // leave parsed as null
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed ?? body);
          return;
        }

        const snippet = body ? (body.length > 1000 ? body.slice(0, 1000) + '...': body) : '';
        const msg = parsed?.message || parsed?.error || snippet || `Status ${res.statusCode}`;
        reject(new Error(`ETS request failed with status ${res.statusCode}: ${msg}`));
      });
    });

    req.on('error', reject);
    req.end();
  });

const normalizePayload = (payload) => (Array.isArray(payload) ? payload : payload?.data ?? []);

const fetchEtsList = async (path) => {
  const payload = await fetchJson(`${ETS_API_BASE_URL}/${path.replace(/^\/+/, '')}`);
  return normalizePayload(payload);
};

const safeEtsSync = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.error('[ETS sync]', err.message);
    return null;
  }
};

const mapEtsLangToBolme = (lang) => {
  if (lang === 'RU') return 'RU';
  if (lang === 'EN') return 'EN';
  return 'AZ';
};

// ─── ETS axtarış ───────────────────────────────────────────

const findEtsDepartment = async (externalId) => {
  const departments = await fetchEtsList('departments');
  return departments.find((dept) => String(dept?.id) === String(externalId));
};

const findEtsSubject = async (externalId) => {
  const subjects = await fetchEtsList('subjects');
  return subjects.find((subject) => String(subject?.id) === String(externalId));
};

const findEtsTeachers = async () => fetchEtsList('teachers');

const findEtsTeacher = async (externalId) => {
  if (!externalId) return null;
  try {
    const payload = await fetchJson(`${ETS_API_BASE_URL}/teachers/${externalId}`);
    return payload?.data ?? payload;
  } catch {
    const teachers = await findEtsTeachers();
    return teachers.find((teacher) => String(teacher?.id) === String(externalId));
  }
};

const findEtsDepartments = async () => fetchEtsList('departments');

const findEtsSubjects = async () => fetchEtsList('subjects');

const findEtsTopics = async () => fetchEtsList('topics');

const findEtsSubjectGroups = async ({ academicYear, semester, status, subjectId } = {}) => {
  const params = new URLSearchParams();
  if (academicYear) params.append('academicYear', academicYear);
  if (semester) params.append('semester', semester);
  if (status) params.append('status', status);
  if (subjectId != null && subjectId !== '') params.append('subjectId', String(subjectId));
  const qs = params.toString();
  const path = qs ? `subject-groups?${qs}` : 'subject-groups';
  return fetchEtsList(path);
};

const findEtsSubjectsByDepartmentId = async (externalDepartmentId) => {
  const subjects = await findEtsSubjects();
  return subjects.filter(
    (subject) => String(subject?.departmentId ?? subject?.department?.id) === String(externalDepartmentId)
  );
};

const findEtsSubjectGroup = async (externalId) => {
  if (!externalId) return null;
  try {
    const payload = await fetchJson(`${ETS_API_BASE_URL}/subject-groups/${externalId}`);
    return payload?.data ?? payload;
  } catch {
    const list = await fetchEtsList('subject-groups');
    return list.find((g) => String(g?.id) === String(externalId));
  }
};

const getEtsSubjectGroupStudents = async (externalGroupId) => {
  if (!externalGroupId) return [];
  try {
    const payload = await fetchJson(`${ETS_API_BASE_URL}/subject-groups/${externalGroupId}/students`);
    return payload?.students ?? payload?.data ?? payload;
  } catch {
    return [];
  }
};

// ─── Kafedra sinxronizasiyası ──────────────────────────────

const upsertKafedraFromEtsDepartment = async (department) => {
  const externalIdStr = String(department.id);
  const kod = department.code ? String(department.code) : String(department.id);
  const ad = department.name || department.faculty?.name || `ETS Kafedra ${department.id}`;

  const byExternal = await prisma.kafedra.findUnique({ where: { externalId: externalIdStr } });
  if (byExternal) {
    if (byExternal.source === 'ETS' && (byExternal.ad !== ad || byExternal.kod !== kod)) {
      return prisma.kafedra.update({
        where: { id: byExternal.id },
        data: { ad, kod },
      });
    }
    return byExternal;
  }

  const byKod = await prisma.kafedra.findUnique({ where: { kod } });
  if (byKod) {
    if (!byKod.externalId) {
      return prisma.kafedra.update({
        where: { id: byKod.id },
        data: { externalId: externalIdStr },
      });
    }
    return byKod;
  }

  try {
    return await prisma.kafedra.create({
      data: { ad, kod, externalId: externalIdStr, source: 'ETS' },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const fallback = await prisma.kafedra.findUnique({ where: { kod } });
      if (fallback) return fallback;
    }
    throw err;
  }
};

const syncKafedralarFromEts = async () =>
  safeEtsSync(async () => {
    const departments = await fetchEtsList('departments');
    const results = [];
    for (const department of departments) {
      results.push(await upsertKafedraFromEtsDepartment(department));
    }
    return results;
  });

const getOrCreateKafedraFromEts = async (externalId) => {
  if (!externalId) throw new Error('ETS kafedra externalId tələb olunur');
  const externalIdStr = String(externalId);

  const existing = await prisma.kafedra.findUnique({ where: { externalId: externalIdStr } });
  if (existing) return existing;

  const department = await findEtsDepartment(externalIdStr);
  if (!department) throw new Error('ETS kafedra tapılmadı');

  return upsertKafedraFromEtsDepartment(department);
};

// ─── Fənn sinxronizasiyası ─────────────────────────────────

const upsertFennFromEtsSubject = async (subject, elavEdenId) => {
  const externalIdStr = String(subject.id);
  const departmentId = subject.departmentId ?? subject.department?.id;
  const kafedra = await getOrCreateKafedraFromEts(departmentId);

  const fennKodu = subject.subjectCode ? String(subject.subjectCode) : `ETS-${subject.id}`;
  const fennAdi = subject.subjectTitle || subject.name || `ETS Fənn ${subject.id}`;
  const bolme = mapEtsLangToBolme(subject.lang);

  const byExternal = await prisma.fenn.findUnique({ where: { externalId: externalIdStr } });
  if (byExternal) {
    if (byExternal.source === 'ETS' && (byExternal.fennAdi !== fennAdi || byExternal.kafedraId !== kafedra.id)) {
      return prisma.fenn.update({
        where: { id: byExternal.id },
        data: { fennAdi, kafedraId: kafedra.id, bolme },
      });
    }
    return byExternal;
  }

  const byKod = await prisma.fenn.findUnique({ where: { fennKodu } });
  if (byKod) {
    if (!byKod.externalId) {
      return prisma.fenn.update({
        where: { id: byKod.id },
        data: { externalId: externalIdStr },
      });
    }
    return byKod;
  }

  try {
    return await prisma.fenn.create({
      data: {
        kafedraId: kafedra.id,
        fennKodu,
        fennAdi,
        bolme,
        externalId: externalIdStr,
        source: 'ETS',
        elavEden: elavEdenId,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const fallback = await prisma.fenn.findUnique({ where: { fennKodu } });
      if (fallback) return fallback;
    }
    throw err;
  }
};

const syncFennlerFromEts = async (elavEdenId) =>
  safeEtsSync(async () => {
    if (!elavEdenId) return [];
    await syncKafedralarFromEts();
    const subjects = await findEtsSubjects();
    const results = [];
    for (const subject of subjects) {
      results.push(await upsertFennFromEtsSubject(subject, elavEdenId));
    }
    return results;
  });

const getOrCreateFennFromEts = async (externalId, elavEdenId) => {
  if (!externalId) throw new Error('ETS fənn externalId tələb olunur');
  if (!elavEdenId) throw new Error('Fənn əlavə edən istifadəçi tələb olunur');

  const externalIdStr = String(externalId);
  const existing = await prisma.fenn.findUnique({ where: { externalId: externalIdStr } });
  if (existing) return existing;

  const subject = await findEtsSubject(externalIdStr);
  if (!subject) throw new Error('ETS fənn tapılmadı');

  return upsertFennFromEtsSubject(subject, elavEdenId);
};

const getOrCreateFennsFromEtsByDepartmentId = async (externalDepartmentId, elavEdenId) => {
  if (!externalDepartmentId) throw new Error('ETS kafedra externalId tələb olunur');
  if (!elavEdenId) throw new Error('Fənn əlavə edən istifadəçi tələb olunur');

  await getOrCreateKafedraFromEts(externalDepartmentId);
  const subjects = await findEtsSubjectsByDepartmentId(externalDepartmentId);
  const createdFennler = [];

  for (const subject of subjects) {
    createdFennler.push(await upsertFennFromEtsSubject(subject, elavEdenId));
  }

  return createdFennler;
};

// ─── Mövzu sinxronizasiyası ────────────────────────────────

const upsertMovzuFromEtsTopic = async (topic, elavEdenId) => {
  const externalIdStr = String(topic.id);
  const subjectExternalId = String(topic.subjectId ?? topic.subject?.id);
  const fenn = await getOrCreateFennFromEts(subjectExternalId, elavEdenId);
  const ad = topic.name || `ETS Mövzu ${topic.id}`;

  const byExternal = await prisma.movzu.findUnique({ where: { externalId: externalIdStr } });
  if (byExternal) {
    if (byExternal.source === 'ETS' && (byExternal.ad !== ad || byExternal.fennId !== fenn.id)) {
      return prisma.movzu.update({
        where: { id: byExternal.id },
        data: { ad, fennId: fenn.id },
      });
    }
    return byExternal;
  }

  try {
    return await prisma.movzu.create({
      data: {
        fennId: fenn.id,
        ad,
        externalId: externalIdStr,
        source: 'ETS',
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const fallback = await prisma.movzu.findFirst({
        where: { fennId: fenn.id, ad, source: 'ETS' },
      });
      if (fallback) return fallback;
    }
    throw err;
  }
};

const syncMovzularFromEts = async (elavEdenId, fennId) =>
  safeEtsSync(async () => {
    if (!elavEdenId) return [];

    await syncFennlerFromEts(elavEdenId);

    let topics = await fetchEtsList('topics');

    if (fennId) {
      const localFenn = await prisma.fenn.findUnique({ where: { id: fennId } });
      if (!localFenn?.externalId) return [];

      const subjectExternalId = localFenn.externalId;
      topics = topics.filter(
        (topic) => String(topic.subjectId ?? topic.subject?.id) === subjectExternalId
      );
    }

    const results = [];
    for (const topic of topics) {
      results.push(await upsertMovzuFromEtsTopic(topic, elavEdenId));
    }

    return results;
  });

module.exports = {
  syncKafedralarFromEts,
  syncFennlerFromEts,
  syncMovzularFromEts,
  getOrCreateKafedraFromEts,
  getOrCreateFennFromEts,
  getOrCreateFennsFromEtsByDepartmentId,
  findEtsDepartments,
  findEtsSubjects,
  findEtsTopics,
  findEtsSubjectGroups,
  findEtsSubjectGroup,
  getEtsSubjectGroupStudents,
  findEtsTeachers,
  findEtsTeacher,
};
