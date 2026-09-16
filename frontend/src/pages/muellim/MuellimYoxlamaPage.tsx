import { useEffect, useState } from 'react';
import {
  getMyGradingExams,
  getGradingQueue,
  gradeQuestion,
  type GradingQueueItem,
  type TeacherAssignment,
} from '../../services/muellimYoxlama';

const SUAL_TIP_LABELS: Record<string, string> = {
  NEZERI: 'Nəzəri',
  DUSTUR: 'Düstur',
  PRAKTIKI: 'Praktiki',
};

const MuellimYoxlamaPage = () => {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [queue, setQueue] = useState<GradingQueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, graded: 0 });
  const [activeItem, setActiveItem] = useState<GradingQueueItem | null>(null);
  const [bal, setBal] = useState('');
  const [qeyd, setQeyd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await getMyGradingExams();
      setAssignments(data);
      if (data.length && !selectedExamId) {
        setSelectedExamId(data[0].imtahan.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükləmə xətası');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async (imtahanId: number) => {
    try {
      const data = await getGradingQueue(imtahanId);
      setQueue(data.queue);
      setStats(data.stats);
      const firstPending = data.queue.find((q) => !q.yoxlanilib) || data.queue[0] || null;
      setActiveItem(firstPending);
      if (firstPending) {
        setBal(firstPending.bal !== null ? String(firstPending.bal) : '');
        setQeyd(firstPending.qeyd || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Növbə yüklənmədi');
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, []);

  useEffect(() => {
    if (selectedExamId) void loadQueue(selectedExamId);
  }, [selectedExamId]);

  const selectItem = (item: GradingQueueItem) => {
    setActiveItem(item);
    setBal(item.bal !== null ? String(item.bal) : '');
    setQeyd(item.qeyd || '');
    setError('');
  };

  const handleGrade = async () => {
    if (!selectedExamId || !activeItem) return;
    setSaving(true);
    setError('');
    try {
      await gradeQuestion(selectedExamId, activeItem.id, {
        bal: Number(bal),
        qeyd: qeyd.trim() || undefined,
      });
      await loadQueue(selectedExamId);
      const next = queue.find((q) => q.id !== activeItem.id && !q.yoxlanilib);
      if (next) selectItem(next);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : 'Qiymət yazılmadı';
      setError(message || 'Qiymət yazılmadı');
    } finally {
      setSaving(false);
    }
  };

  const selectedAssignment = assignments.find((a) => a.imtahan.id === selectedExamId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Müəllim paneli</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">İmtahan yoxlaması</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tələbə şəxsiyyəti göstərilmir — yalnız anonim yoxlama kodu ilə işləyin.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Yüklənir...</div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Sizə təhkim olunmuş imtahan tapılmadı.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-3">
            {assignments.map((item) => (
              <button
                key={item.imtahan.id}
                type="button"
                onClick={() => setSelectedExamId(item.imtahan.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedExamId === item.imtahan.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-semibold text-slate-900">{item.imtahan.ad}</p>
                <p className="mt-1 text-xs text-slate-500">{item.imtahan.fenn?.fennAdi}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.scopes.map((scope) => (
                    <span
                      key={`${scope.sualTipi}-${scope.sualBaslangic}`}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                    >
                      {SUAL_TIP_LABELS[scope.sualTipi]} {scope.sualBaslangic}-{scope.sualSon}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </aside>

          <section className="space-y-4">
            {selectedAssignment && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <div className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Yoxlanıb: {stats.graded}
                </div>
                <div className="rounded-xl bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Gözləyir: {stats.pending}
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Cəmi: {stats.total}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {queue.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition ${
                      activeItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700">{item.yoxlamaKodu}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.yoxlanilib ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.yoxlanilib ? 'Yoxlanıb' : 'Gözləyir'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {SUAL_TIP_LABELS[item.sualTipi]} · Sual {item.tipSira}
                    </p>
                  </button>
                ))}
              </div>

              {activeItem ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Anonim kod</p>
                      <p className="font-mono text-2xl font-bold text-slate-900">{activeItem.yoxlamaKodu}</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <p>{SUAL_TIP_LABELS[activeItem.sualTipi]} sualı #{activeItem.tipSira}</p>
                      <p>Maksimum bal: {activeItem.maxBal}</p>
                    </div>
                  </div>

                  <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sual</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{activeItem.sualMetn}</p>
                    {activeItem.movzu && (
                      <p className="mt-2 text-xs text-slate-500">Mövzu: {activeItem.movzu}</p>
                    )}
                  </div>

                  <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tələbə cavabı</p>
                    {activeItem.yaziliCavab ? (
                      /<img\s|data:image\//.test(activeItem.yaziliCavab) ? (
                        <div className="prose prose-slate mt-2 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: activeItem.yaziliCavab }} />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{activeItem.yaziliCavab}</p>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-slate-800">—</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-semibold text-slate-700">Verilən bal</span>
                      <input
                        type="number"
                        min={0}
                        max={activeItem.maxBal}
                        step="0.5"
                        value={bal}
                        onChange={(e) => setBal(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block font-semibold text-slate-700">Qeyd (opsional)</span>
                      <textarea
                        value={qeyd}
                        onChange={(e) => setQeyd(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="Müəllim qeydi..."
                      />
                    </label>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={saving || bal === ''}
                    onClick={handleGrade}
                    className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    {saving ? 'Saxlanılır...' : 'Qiyməti yadda saxla'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                  Yoxlanacaq sual yoxdur.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <p className="text-xs text-slate-400">
        ETS hesabınızla daxil olmusunuz. Test sualları sistem tərəfindən avtomatik yoxlanılır.
      </p>
    </div>
  );
};

export default MuellimYoxlamaPage;
