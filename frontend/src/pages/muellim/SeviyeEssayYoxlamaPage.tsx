import { useEffect, useMemo, useState } from 'react';
import { getLevelEssayQueue, getMyLevelGradingExams, gradeLevelEssay } from '../../services/seviyeYoxlama';

export default function SeviyeEssayYoxlamaPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, graded: 0 });
  const [active, setActive] = useState<any>(null);
  const [bal, setBal] = useState('');
  const [qeyd, setQeyd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const formatDate = (value: string) => new Date(value).toLocaleDateString('az-AZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const rank = (item: any) => item.stats.pending > 0 ? 0 : 1;
  const sortedExams = useMemo(() => [...exams].sort((a, b) =>
    rank(a) - rank(b) || new Date(b.exam.bitmeVaxti).getTime() - new Date(a.exam.bitmeVaxti).getTime()
  ), [exams]);

  const loadQueue = async (id: number) => {
    const data = await getLevelEssayQueue(id);
    setQueue(data.queue);
    setStats(data.stats);
    const item = data.queue.find((row: any) => !row.yoxlanilib) || data.queue[0] || null;
    setActive(item);
    setBal(item?.bal ?? '');
    setQeyd(item?.qeyd || '');
  };

  useEffect(() => {
    void getMyLevelGradingExams().then((data) => {
      setExams(data);
      const priority = [...data].sort((a: any, b: any) =>
        rank(a) - rank(b) || new Date(b.exam.bitmeVaxti).getTime() - new Date(a.exam.bitmeVaxti).getTime()
      )[0];
      if (priority) setExamId(priority.exam.id);
    }).catch(() => setError('Yoxlama imtahanları yüklənmədi.'));
  }, []);

  useEffect(() => {
    if (examId) void loadQueue(examId).catch(() => setError('Esse növbəsi yüklənmədi.'));
  }, [examId]);

  const choose = (item: any) => {
    setActive(item);
    setBal(item.bal ?? '');
    setQeyd(item.qeyd || '');
  };
  const save = async () => {
    if (!active || bal === '' || !examId) return;
    try {
      setError('');
      await gradeLevelEssay(active.id, { bal: Number(bal), qeyd: qeyd || undefined });
      setSuccess(`${active.yoxlamaKodu} üçün qiymət yadda saxlanıldı.`);
      await loadQueue(examId);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Qiymət yadda saxlanılmadı.');
    }
  };
  const selectedExam = exams.find((item) => item.exam.id === examId);

  return <div className="space-y-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Müəllim paneli</p>
      <h1 className="mt-2 text-3xl font-bold">Səviyyə imtahanı — essay yoxlaması</h1>
      <p className="mt-2 text-sm text-slate-500">Yoxlanılmamış esselər əvvəl göstərilir. Tələbənin adı, soyadı və FİN-i göstərilmir.</p>
    </div>
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}
    {exams.length ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sortedExams.map((item) => <button key={item.exam.id} onClick={() => setExamId(item.exam.id)} className={`cursor-pointer rounded-xl border p-4 text-left transition ${item.stats.pending === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'} ${examId === item.exam.id ? 'ring-2 ring-violet-500 ring-offset-2' : ''}`}>
          <span className="block text-sm font-bold">Gün {item.exam.sessiyaNo || 1} · {formatDate(item.exam.baslamaVaxti)}</span>
          <span className="mt-2 block text-sm font-bold">{item.stats.pending === 0 ? 'Bütün esselər yoxlanıb' : 'Yoxlama açıqdır'}</span>
          <span className="mt-1 block text-xs">Gözləyir: {item.stats.pending} · Yoxlanıb: {item.stats.graded}</span>
        </button>)}
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
        <span className="block text-base">Gün {selectedExam?.exam.sessiyaNo || 1} · {selectedExam ? formatDate(selectedExam.exam.baslamaVaxti) : ''}</span>
        <span className="mt-1 block">Essay qiymətləndirməsi müddətsiz açıqdır.</span>
      </div>
      <div className="flex gap-3 text-sm">
        <span className="rounded bg-slate-100 px-3 py-1">Cəmi: {stats.total}</span>
        <span className="rounded bg-amber-50 px-3 py-1 text-amber-700">Gözləyir: {stats.pending}</span>
        <span className="rounded bg-emerald-50 px-3 py-1 text-emerald-700">Yoxlanıb: {stats.graded}</span>
      </div>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="max-h-[65vh] overflow-auto rounded-2xl border bg-white">
          {queue.map((item) => <button key={item.id} onClick={() => choose(item)} className={`block w-full cursor-pointer border-b p-4 text-left ${active?.id === item.id ? 'bg-violet-50' : ''}`}>
            <b className="font-mono">{item.yoxlamaKodu}</b>
            <span className="float-right text-xs">{item.yoxlanilib ? 'Yoxlanıb' : 'Gözləyir'}</span>
            <p className="mt-1 text-xs text-slate-500">{item.topic || 'Mövzu seçilməyib'}</p>
          </button>)}
        </aside>
        {active ? <section className="rounded-2xl border bg-white p-6">
          <p className="font-mono text-xl font-bold">{active.yoxlamaKodu}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Gün {selectedExam?.exam.sessiyaNo || 1} · {selectedExam ? formatDate(selectedExam.exam.baslamaVaxti) : ''}</p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">MÖVZU</p><p className="mt-1 font-medium">{active.topic}</p></div>
          <div className="mt-4 rounded-xl border p-4"><p className="whitespace-pre-wrap leading-7">{active.text}</p></div>
          <label className="mt-5 block text-sm font-semibold">Bal (maksimum {active.maxBal})<input className="input mt-1" type="number" min="0" max={active.maxBal} step="0.5" value={bal} onChange={(e) => setBal(e.target.value)} /></label>
          <label className="mt-4 block text-sm font-semibold">Qeyd (opsional)<textarea className="input mt-1" rows={3} value={qeyd} onChange={(e) => setQeyd(e.target.value)} /></label>
          <button onClick={() => void save()} className="mt-5 cursor-pointer rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">Qiyməti yadda saxla</button>
        </section> : <section className="rounded-2xl border bg-white p-8 text-slate-500">Yoxlama üçün esse yoxdur.</section>}
      </div>
    </> : <div className="rounded-2xl border bg-white p-8 text-slate-500">Sizə esse yoxlaması təhkim edilməyib.</div>}
    {error && <p className="text-rose-600">{error}</p>}
  </div>;
}
