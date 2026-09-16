const http = require('http');
const https = require('https');
const { URL } = require('url');

const ETS_API_BASE_URL = process.env.ETS_API_BASE_URL || 'http://localhost:5001/api';
const ETS_API_KEY = process.env.ETS_API_KEY || '';
const configuredTimeout = Number(process.env.ETS_TIMEOUT_MS || 8000);
const ETS_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 8000;

const accessTokenFromCookies = (setCookieHeaders) => {
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders].filter(Boolean);
  for (const header of headers) {
    const match = String(header).match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
};

const requestJson = (path, { method = 'GET', body, token, includeAuthToken = false } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(`${ETS_API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`);
    const client = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const headers = {
      Accept: 'application/json',
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!token && ETS_API_KEY ? { 'x-api-key': ETS_API_KEY } : {}),
    };

    const req = client.request(url, { method, headers }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = { message: raw };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(includeAuthToken
            ? { data, authToken: accessTokenFromCookies(res.headers['set-cookie']) }
            : data);
          return;
        }

        const message = data?.message || `ETS sorğusu uğursuz oldu (${res.statusCode})`;
        reject(new Error(message));
      });
    });

    req.setTimeout(ETS_TIMEOUT_MS, () => {
      req.destroy(new Error('ETS sorğusunun gözləmə vaxtı bitdi'));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

const resolveStudent = async (identifier) => {
  const payload = await requestJson(`/students/resolve/${encodeURIComponent(identifier)}`);
  if (!payload?.studentId) {
    throw new Error('Tələbə tapılmadı');
  }

  return {
    studentId: String(payload.studentId),
    profile: payload,
  };
};

const loginTeacher = async ({ identifier, password }) => {
  const loginResponse = await requestJson('/auth/login', {
    method: 'POST',
    body: { identifier, username: identifier, email: identifier, password },
    includeAuthToken: true,
  });

  // ETS browser login keeps the JWT in an HttpOnly cookie. Service-to-service
  // login reads that same cookie from Set-Cookie and uses it as a Bearer token
  // only for the subsequent profile request.
  const etsToken = loginResponse?.authToken || loginResponse?.data?.token || loginResponse?.data?.accessToken;
  if (!etsToken) {
    throw new Error('ETS giriş sessiyası yaradılmadı');
  }

  const profilePayload = await requestJson('/auth/profile', { token: etsToken });
  const profile = profilePayload?.userData || profilePayload?.user || profilePayload;
  const roles = profile?.roles || [profile?.role].filter(Boolean);
  const isTeacher =
    roles.includes('TEACHER') || profile?.role === 'TEACHER' || Boolean(profile?.teacherId);

  if (!isTeacher || !profile?.teacherId) {
    throw new Error('Bu giriş müəllim hesabına aid deyil');
  }

  return {
    etsToken,
    profile,
    teacherId: String(profile.teacherId),
  };
};

module.exports = { requestJson, resolveStudent, loginTeacher };
