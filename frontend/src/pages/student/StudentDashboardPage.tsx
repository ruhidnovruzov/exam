import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock, LogOut, PlayCircle } from 'lucide-react';
import { fetchStudentProfile, studentLogout, type StudentProfile } from '../../services/studentAuth';
import { getStudentExams, type StudentExamSummary } from '../../services/studentExam';

const formatDate = (value: string) =>
  new Date(value).toLocaleString('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const StudentDashboardPage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [exams, setExams] = useState<StudentExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [studentProfile, studentExams] = await Promise.all([fetchStudentProfile(), getStudentExams()]);
        setProfile(studentProfile);
        setExams(studentExams);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Məlumatlar yüklənmədi');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const logout = () => {
    studentLogout();
    navigate('/student/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">Tələbə paneli</p>
            <h1 className="mt-1 text-2xl font-bold">
              {profile ? `${profile.ad} ${profile.soyad}` : 'İmtahanlar'}
            </h1>
            {profile && <p className="mt-1 text-sm text-slate-500">{[profile.qrup, profile.ixtisas].filter(Boolean).join(' | ')}</p>}
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            Çıxış
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <Link to="/seviye-imtahani/student" className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:shadow">
            <PlayCircle className="h-5 w-5 text-cyan-600" />
            Səviyyə imtahanı
          </Link>
        </div>
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard icon={<BookOpen className="h-5 w-5" />} label="Təhkim olunmuş imtahan" value={exams.length} />
          <StatCard icon={<PlayCircle className="h-5 w-5" />} label="Aktiv başlana bilən" value={exams.filter((e) => e.canStart).length} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Yekunlaşmış" value={exams.filter((e) => e.finished).length} />
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Yüklənir...</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>
        ) : exams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Sizə təhkim olunmuş imtahan yoxdur.
          </div>
        ) : (
          <div className="space-y-4">
            {exams.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{item.imtahan.fenn.fennKodu}</span>
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.imtahan.status}</span>
                      {item.finished && <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Yekunlaşıb</span>}
                    </div>
                    <h2 className="text-lg font-bold">{item.imtahan.ad}</h2>
                    <p className="mt-1 text-sm text-slate-500">{item.imtahan.fenn.fennAdi}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {item.imtahan.muddet} dəq.</span>
                      <span>Başlama: {formatDate(item.imtahan.baslamaVaxti)}</span>
                      <span>Bitmə: {formatDate(item.imtahan.bitmeVaxti)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    {item.finished ? (
                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <span className="text-slate-500">Bal:</span> <b>{item.bal ?? 0}</b>
                        <span className="mx-2 text-slate-300">/</span>
                        <span className={item.kecdi ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                          {item.kecdi ? 'Keçdi' : 'Keçmədi'}
                        </span>
                      </div>
                    ) : (
                      <Link
                        to={`/student/exams/${item.imtahanId}`}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
                          item.canStart ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <PlayCircle className="h-5 w-5" />
                        {item.canStart ? 'İmtahana başla' : 'Hələ aktiv deyil'}
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">{icon}</div>
    <p className="text-3xl font-bold">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{label}</p>
  </div>
);

export default StudentDashboardPage;
