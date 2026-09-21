const ExcelJS = require('exceljs');

const DEFAULT_SHEET_NAME = 'Ener Rəqəmsal 17-18 sentyabr';

const AZERBAIJANI_ASCII = {
  'Ə': 'E', 'ə': 'E', 'Ğ': 'G', 'ğ': 'G', 'İ': 'I', 'ı': 'I',
  'Ö': 'O', 'ö': 'O', 'Ş': 'S', 'ş': 'S', 'Ü': 'U', 'ü': 'U',
  'Ç': 'C', 'ç': 'C',
};

const normalizeName = (value) => String(value ?? '')
  .replace(/[ƏəĞğİıÖöŞşÜüÇç]/g, (letter) => AZERBAIJANI_ASCII[letter])
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizeFatherName = (value) => normalizeName(value)
  .replace(/\s+(OGLU|QIZI)$/u, '')
  .trim();

const headerKey = (value) => normalizeName(value).replace(/\s+/g, '');

const levenshteinDistance = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
};

const similarity = (left, right) => {
  if (!left || !right) return 0;
  return 1 - (levenshteinDistance(left, right) / Math.max(left.length, right.length));
};

const numericCellValue = (cell) => {
  const value = cell?.value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.result === 'number' && Number.isFinite(value.result)) {
    return value.result;
  }
  return null;
};

const findColumns = (sheet) => {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
    const columns = {};
    sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const key = headerKey(cell.text || cell.value);
      if (key === 'SOYAD' || key === 'SOYADI') columns.lastName = columnNumber;
      if (key === 'AD' || key === 'ADI') columns.firstName = columnNumber;
      if (key === 'ATAADI' || key === 'ATASININADI') columns.fatherName = columnNumber;
      if (key === 'SPEAKING') columns.score = columnNumber;
    });
    if (columns.lastName && columns.firstName && columns.fatherName && columns.score) {
      return { headerRow: rowNumber, ...columns };
    }
  }
  throw Object.assign(new Error('Soyad, ad, ata adı və SPEAKING sütunları tapılmadı.'), { status: 400 });
};

const parseSpeakingWorkbook = async (buffer, requestedSheetName = DEFAULT_SHEET_NAME) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(requestedSheetName);
  if (!sheet) {
    throw Object.assign(new Error(`"${requestedSheetName}" adlı sheet tapılmadı.`), {
      status: 400,
      availableSheets: workbook.worksheets.map((item) => item.name),
    });
  }

  const columns = findColumns(sheet);
  const scoredRows = [];
  const skippedRows = [];
  for (let rowNumber = columns.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const rawScore = row.getCell(columns.score).value;
    const score = numericCellValue(row.getCell(columns.score));
    const base = {
      row: rowNumber,
      lastName: String(row.getCell(columns.lastName).text || '').trim(),
      firstName: String(row.getCell(columns.firstName).text || '').trim(),
      fatherName: String(row.getCell(columns.fatherName).text || '').trim(),
    };

    if (score == null) {
      const text = String(row.getCell(columns.score).text || rawScore || '').trim();
      skippedRows.push({ ...base, value: text || null, reason: text ? 'non_numeric_score' : 'blank_score' });
      continue;
    }
    if (score < 0 || score > 5) {
      skippedRows.push({ ...base, value: score, reason: 'score_out_of_range' });
      continue;
    }
    if (!base.lastName || !base.firstName || !base.fatherName) {
      skippedRows.push({ ...base, value: score, reason: 'incomplete_name' });
      continue;
    }
    scoredRows.push({ ...base, score });
  }

  return { sheetName: sheet.name, columns, scoredRows, skippedRows };
};

const normalizedPerson = ({ firstName, lastName, fatherName }) => ({
  firstName: normalizeName(firstName),
  lastName: normalizeName(lastName),
  fatherName: normalizeFatherName(fatherName),
});

const personKey = (person) => `${person.lastName}|${person.firstName}|${person.fatherName}`;

const fuzzyScore = (source, candidate) => (
  similarity(source.lastName, candidate.lastName) * 0.45
  + similarity(source.firstName, candidate.firstName) * 0.35
  + similarity(source.fatherName, candidate.fatherName) * 0.20
);

const matchSpeakingRows = (rows, attempts) => {
  const candidates = attempts.map((attempt) => ({
    ...attempt,
    normalized: normalizedPerson(attempt),
  }));
  const exactIndex = new Map();
  for (const candidate of candidates) {
    const key = personKey(candidate.normalized);
    if (!exactIndex.has(key)) exactIndex.set(key, []);
    exactIndex.get(key).push(candidate);
  }

  const matches = [];
  const unresolved = [];
  for (const row of rows) {
    const normalized = normalizedPerson(row);
    const exact = exactIndex.get(personKey(normalized)) || [];
    if (exact.length === 1) {
      matches.push({
        row: row.row,
        score: row.score,
        attemptId: exact[0].attemptId,
        source: { lastName: row.lastName, firstName: row.firstName, fatherName: row.fatherName },
        target: { lastName: exact[0].lastName, firstName: exact[0].firstName, fatherName: exact[0].fatherName },
        matchType: 'exact_normalized',
      });
      continue;
    }
    if (exact.length > 1) {
      unresolved.push({ ...row, reason: 'ambiguous_exact_match', candidateAttemptIds: exact.map((item) => item.attemptId) });
      continue;
    }

    const suggestions = candidates
      .map((candidate) => ({ candidate, score: fuzzyScore(normalized, candidate.normalized) }))
      .filter((item) => item.score >= 0.72)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ candidate, score }) => ({
        attemptId: candidate.attemptId,
        similarity: Number(score.toFixed(4)),
        lastName: candidate.lastName,
        firstName: candidate.firstName,
        fatherName: candidate.fatherName,
      }));
    unresolved.push({ ...row, reason: suggestions.length ? 'fuzzy_suggestion_only' : 'not_found', suggestions });
  }

  const rowsByAttempt = new Map();
  for (const match of matches) {
    if (!rowsByAttempt.has(match.attemptId)) rowsByAttempt.set(match.attemptId, []);
    rowsByAttempt.get(match.attemptId).push(match);
  }
  const safeMatches = [];
  for (const match of matches) {
    const duplicates = rowsByAttempt.get(match.attemptId);
    if (duplicates.length === 1) safeMatches.push(match);
    else if (duplicates[0] === match) {
      unresolved.push({
        reason: 'duplicate_spreadsheet_match',
        attemptId: match.attemptId,
        rows: duplicates.map((item) => item.row),
      });
    }
  }

  return { matches: safeMatches, unresolved };
};

module.exports = {
  DEFAULT_SHEET_NAME,
  normalizeName,
  normalizeFatherName,
  similarity,
  parseSpeakingWorkbook,
  matchSpeakingRows,
};
