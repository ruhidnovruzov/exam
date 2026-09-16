require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { finalizeExpiredAssignments } = require('./controllers/studentExam.controller');
const { finalizeExpiredLevelAttempts } = require('./controllers/seviyeImtahani.controller');

const validateRuntimeConfig = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET təyin edilməyib');
  if (!process.env.EXAM_DAILY_PASSWORD_SECRET) throw new Error('EXAM_DAILY_PASSWORD_SECRET təyin edilməyib');
};

validateRuntimeConfig();

const app = express();

// ── Middleware ──────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins, credentials: true } : undefined));
app.use(express.json({ limit: '10mb' })); // şəkillər base64 ola bilər
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/kafedralar',   require('./routes/kafedra.routes'));
app.use('/api/fennler',      require('./routes/fenn.routes'));
app.use('/api/movzular',     require('./routes/movzu.routes'));
app.use('/api/test-bankilar',require('./routes/testBanki.routes'));
app.use('/api/suallar',      require('./routes/sual.routes'));
app.use('/api/imtahanlar',   require('./routes/imtahan.routes'));
app.use('/api/telebeler',    require('./routes/telebe.routes'));
app.use('/api/student',      require('./routes/studentExam.routes'));
app.use('/api/istifadeciler',require('./routes/istifadeci.routes'));
app.use('/api/muellimler',   require('./routes/muellim.routes'));
app.use('/api/muellim/yoxlama', require('./routes/muellimYoxlama.routes'));
app.use('/api/muellim/seviye-yoxlama', require('./routes/seviyeYoxlama.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/tedris-iller', require('./routes/tedrisIl.routes'));
app.use('/api/ets',           require('./routes/ets.routes'));
app.use('/api/seviye-imtahani', require('./routes/seviyeImtahani.routes'));

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', zaman: new Date() }));

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Endpoint tapılmadı' }));

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Gözlənilməz server xətası' });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`EXAM server ${PORT} portunda işləyir`);
  // Vaxtı bitmiş sessiyalar brauzer bağlı olsa belə avtomatik yekunlaşır.
  finalizeExpiredAssignments().catch((error) => console.error('Expired exam finalization error:', error));
  finalizeExpiredLevelAttempts().catch((error) => console.error('Expired level exam finalization error:', error));
  setInterval(() => {
    finalizeExpiredAssignments().catch((error) => console.error('Expired exam finalization error:', error));
    finalizeExpiredLevelAttempts().catch((error) => console.error('Expired level exam finalization error:', error));
  }, 10_000).unref();
});
