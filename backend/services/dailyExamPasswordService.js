const crypto = require('crypto');

const TIMEZONE = 'Asia/Baku';

const getDateKey = (date = new Date()) =>
  date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });

const generateDailyExamPassword = (etsId, date = new Date()) => {
  const secret = process.env.EXAM_DAILY_PASSWORD_SECRET;
  if (!secret) throw new Error('EXAM_DAILY_PASSWORD_SECRET təyin edilməyib');
  const dateKey = getDateKey(date);
  const payload = `${String(etsId)}:${dateKey}`;
  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const num = parseInt(hash.slice(0, 7), 16) % 100000000;
  return String(num).padStart(8, '0');
};

const verifyDailyExamPassword = (etsId, password) => {
  const normalized = String(password || '').trim();
  if (!/^\d{8}$/.test(normalized)) return false;
  const expected = generateDailyExamPassword(etsId);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized));
};

const getValidUntil = (date = new Date()) => {
  const dateKey = getDateKey(date);
  const [year, month, day] = dateKey.split('-').map(Number);
  const validUntil = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  return validUntil.toISOString();
};

module.exports = {
  generateDailyExamPassword,
  verifyDailyExamPassword,
  getDateKey,
  getValidUntil,
};
