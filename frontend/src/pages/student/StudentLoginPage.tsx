import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, Lock, User } from 'lucide-react';
import { studentLogin } from '../../services/studentAuth';

const StudentLoginPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await studentLogin({ identifier, password });
      navigate('/student');
    } catch (err) {
      const message = axiosMessage(err) || 'Giriş alınmadı';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <section className="space-y-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-md">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">Tələbə girişi</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-normal text-slate-900 md:text-5xl">
                İmtahana ETS kabinetindən götürdüyün şifrə ilə daxil ol
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
                ETS kabinetindəki profil səhifəsində bugünkü 8 rəqəmli imtahan şifrəsini tapın. Bu şifrə hər gün avtomatik dəyişir.
              </p>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white p-6 text-slate-900 shadow-xl shadow-slate-200/50">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">İmtahan girişi</h2>
              <p className="mt-1 text-sm text-slate-500">FİN, username və ya email ilə daxil olun.</p>
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">Login</label>
            <div className="relative mb-4">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                placeholder="FİN, username və ya email"
                required
              />
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">Günlük imtahan şifrəsi</label>
            <div className="relative mb-5">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{8}"
                maxLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-mono tracking-[0.2em] outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                placeholder="8 rəqəmli şifrə"
                required
              />
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              disabled={loading || !identifier || password.length !== 8}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-md shadow-cyan-600/10"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              Daxil ol
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const axiosMessage = (err: unknown) => {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message;
  }
  return err instanceof Error ? err.message : '';
};

export default StudentLoginPage;
