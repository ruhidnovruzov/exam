import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { fetchCurrentUser, logout as authLogout, type CurrentUser } from '../services/auth';

interface LayoutProps {
  children: ReactNode;
}

const ADMIN_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/kafedralar', label: 'Kafedralar' },
  { to: '/fennler', label: 'Fənnlər' },
  { to: '/movzular', label: 'Mövzular' },
  { to: '/test-banklari', label: 'Test Bankları' },
  { to: '/imtahanlar', label: 'İmtahanlar' },
  { to: '/seviye-imtahani', label: 'Səviyyə imtahanı' },
  { to: '/muellimler', label: 'Müəllimlər' },
];

const MUELLIM_LINKS = [{ to: '/yoxlama', label: 'İmtahan yoxlaması' }, { to: '/seviye-yoxlama', label: 'Səviyyə essay yoxlaması' }];

const Layout = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
        if (currentUser.rol === 'MUELLIM' && window.location.pathname === '/') {
          navigate('/yoxlama', { replace: true });
        }
      } catch {
        authLogout();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, [navigate]);

  const handleLogout = () => {
    authLogout();
    navigate('/login');
  };

  const navLinks = user?.rol === 'MUELLIM' ? MUELLIM_LINKS : ADMIN_LINKS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="hidden w-full shrink-0 md:block md:w-72 bg-blue-600 p-6 text-blue-100 shadow-xl shadow-blue-600/10">
          <div className="mb-10 border-b border-blue-500/40 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
              {user?.rol === 'MUELLIM' ? 'Müəllim paneli' : 'ETS Admin'}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">İmtahan Paneli</h2>
          </div>

          <nav className="space-y-1.5 text-sm font-medium">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `block rounded-xl px-4 py-3 transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-md shadow-blue-800/20 font-semibold'
                      : 'text-blue-100 hover:bg-blue-500/50 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}

            {user?.rol === 'ADMIN' && (
              <NavLink
                to="/istifadeciler"
                className={({ isActive }) =>
                  `block rounded-xl px-4 py-3 transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-md shadow-blue-800/20 font-semibold'
                      : 'text-blue-100 hover:bg-blue-500/50 hover:text-white'
                  }`
                }
              >
                İstifadəçilər
              </NavLink>
            )}
          </nav>

          <div className="mt-10 rounded-2xl bg-blue-700/40 border border-blue-400/20 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wider text-blue-200/80">Giriş edən</p>
            <p className="mt-1 text-base font-semibold text-white truncate">
              {user ? `${user.ad} ${user.soyad}` : 'Yüklənir...'}
            </p>
            <span className="mt-1.5 inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs text-white font-medium">
              {user ? user.rol : '...'}
            </span>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="border-b border-slate-200 bg-white px-8 py-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Xoş gəlmisiniz</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  {user ? `${user.ad} ${user.soyad}` : 'İdarəetmə Paneli'}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
                  {loading ? 'Yüklənir...' : user ? `@${user.username}` : 'Anonim'}
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-600 hover:shadow-md hover:shadow-rose-500/10 active:scale-95"
                >
                  Çıxış
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-8 bg-slate-50">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
