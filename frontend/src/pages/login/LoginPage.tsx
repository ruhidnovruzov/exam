import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Loader2, GraduationCap } from 'lucide-react';
import { login } from '../../services/auth';

const LoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [parol, setParol] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('remembered_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }

      const payload = await login({ username, parol });
      navigate(payload.istifadeci?.rol === 'MUELLIM' ? '/yoxlama' : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl"></div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md relative">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-black/50">
          {/* Logo / Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Xoş gəldiniz</h1>
            <p className="text-slate-400 text-sm">
              Admin və kafedra üçün lokal hesab, müəllimlər üçün ETS username və parol ilə daxil olun
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Username field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                İstifadəçi adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white/10"
                  placeholder="istifadəçi@email.com"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Parol
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={parol}
                  onChange={(e) => setParol(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white/10"
                  placeholder="Parolunuzu daxil edin"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  Yadda saxla
                </span>
              </label>
              <button
                type="button"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Parolunu unutdun?
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !username || !parol}
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-600 hover:to-cyan-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-cyan-500 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Yoxlanılır...
                </>
              ) : (
                'Daxil ol'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-slate-500">
              İmtahan Sistemi | Bütün hüquqlar qorunur
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600">
            Hesabınız yoxdur?{' '}
            <button className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
              Qeydiyyatdan keçin
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
