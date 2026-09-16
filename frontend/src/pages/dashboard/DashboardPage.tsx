import { useEffect, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { clearToken } from '../../services/auth';
import { getDashboardStats, type DashboardStats } from '../../services/dashboard';

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-medium text-slate-950">{value.toLocaleString()}</p>
  </div>
);

const LoadingDots = () => (
  <div className="flex items-center gap-1.5 py-2">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300"
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dashboard məlumatı alınmadı');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const statItems = stats
    ? [
        { label: 'Kafedralar', value: stats.kafedralar },
        { label: 'Fənnlər', value: stats.fennler },
        { label: 'Test Bankları', value: stats.testBankilar },
        { label: 'Mövzular', value: stats.movzular },
        { label: 'Suallar', value: stats.suallar },
        { label: 'İmtahanlar', value: stats.imtahanlar },
        { label: 'Tələbələr', value: stats.telebeler },
        { label: 'İstifadəçilər', value: stats.istifadeciler },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen flex-col gap-4 px-4 py-8">

        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sky-500">
              İmtahan Portalı
            </p>
            <h1 className="mt-2 text-[22px] font-medium text-slate-950">
              Xoş gəlmisiniz, Admin
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              İmtahanları, test banklarını və istifadəçiləri idarə edin
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Çıxış
          </button>
        </header>

        {/* Stats */}
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-950">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Ümumi statistika
          </h2>

          <div className="mt-4">
            {loading ? (
              <LoadingDots />
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {statItems.map((item) => (
                  <StatCard key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Məlumat mövcud deyil</p>
            )}
          </div>
        </section>

        {/* Quick links */}
        <div>
          <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
            Sürətli keçidlər
          </p>
          <div className="grid gap-4 sm:grid-cols-2">

            <button
              className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:bg-slate-50 active:scale-[0.99]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-950">İmtahanlar</p>
                <p className="mt-1 text-sm text-slate-500">
                  Yeni imtahanlar əlavə edin və mövcud imtahanları redaktə edin.
                </p>
              </div>
              <svg className="mt-auto h-4 w-4 text-slate-300 transition group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <NavLink
              to="/test-banklari"
              className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 active:scale-[0.99]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-950">Test Bankları</p>
                <p className="mt-1 text-sm text-slate-500">
                  Test suallarını və mövzuları idarə etmək üçün keçid.
                </p>
              </div>
              <svg className="mt-auto h-4 w-4 text-slate-300 transition group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </NavLink>

          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;