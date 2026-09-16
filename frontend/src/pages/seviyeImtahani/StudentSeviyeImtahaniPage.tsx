import { useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const TOKEN_KEY = 'level_exam_token';
const client = axios.create({ baseURL: `${API_BASE_URL}/api/seviye-imtahani` });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type ExamUnit = {
  key: string;
  number: number;
  question: any;
  unitIndex: number;
  subQuestion?: any;
};

const parseAnswer = (value: string | null) => {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : value;
  } catch {
    return value;
  }
};

export default function StudentSeviyeImtahaniPage() {
  const [login, setLogin] = useState({ identifier: '', password: '' });
  const [exam, setExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const units = useMemo<ExamUnit[]>(() => {
    if (!Array.isArray(exam?.questions)) return [];
    return exam.questions.flatMap((question: any) => {
      const isStructured = ['READING', 'LISTENING'].includes(question.sualTipi)
        && Array.isArray(question.variantlar?.questions);
      if (!isStructured) {
        return [{ key: `${question.id}:0`, number: question.sira, question, unitIndex: 0 }];
      }
      return question.variantlar.questions.map((subQuestion: any, unitIndex: number) => ({
        key: `${question.id}:${unitIndex}`,
        number: question.sira + unitIndex,
        question,
        unitIndex,
        subQuestion,
      }));
    });
  }, [exam?.questions]);

  const load = async () => {
    try {
      const { data } = await client.get('/student/exam');
      setExam(data);
      setError('');
      if (!data.finished) {
        const restoredAnswers: Record<number, any> = {};
        const restoredLocked: Record<string, boolean> = {};
        for (const answer of data.answers || []) {
          restoredAnswers[answer.sualId] = parseAnswer(answer.cavab);
          const lockedUnits = Array.isArray(answer.kilidliVahidler)
            ? answer.kilidliVahidler
            : answer.kilidlendi ? [0] : [];
          for (const unitIndex of lockedUnits) restoredLocked[`${answer.sualId}:${unitIndex}`] = true;
        }
        setAnswers(restoredAnswers);
        setLocked(restoredLocked);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'İmtahan yüklənmədi.');
    }
  };

  useEffect(() => { if (localStorage.getItem(TOKEN_KEY)) void load(); }, []);

  useEffect(() => {
    if (!units.length) return;
    const firstUnlocked = units.findIndex((unit) => !locked[unit.key]);
    if (firstUnlocked >= 0) setCurrentIndex((current) => current === 0 ? firstUnlocked : current);
  }, [units.length]);

  useEffect(() => {
    if (!exam?.deadlineAt) return;
    const countdown = document.createElement('div');
    countdown.className = 'fixed right-4 top-4 z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg';
    document.body.appendChild(countdown);
    let finishing = false;
    const tick = async () => {
      const remaining = Math.max(0, new Date(exam.deadlineAt).getTime() - Date.now());
      const totalSeconds = Math.floor(remaining / 1000);
      countdown.textContent = `Qalan vaxt: ${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
      if (remaining === 0 && !finishing) {
        finishing = true;
        countdown.textContent = 'Vaxt bitdi. İmtahan yekunlaşdırılır...';
        try {
          await client.post('/student/finish');
          await load();
        } catch {
          setError('Vaxt bitdi. Nəticə server tərəfindən yekunlaşdırılır.');
        }
      }
    };
    void tick();
    const intervalId = window.setInterval(() => { void tick(); }, 1000);
    return () => { window.clearInterval(intervalId); countdown.remove(); };
  }, [exam?.deadlineAt]);

  const enter = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await client.post('/student/login', login);
      localStorage.setItem(TOKEN_KEY, data.token);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Giriş alınmadı.');
    } finally { setLoading(false); }
  };

  const currentUnit = units[currentIndex];
  const currentListeningUnits = currentUnit?.question.sualTipi === 'LISTENING'
    ? units.filter((unit) => unit.question.id === currentUnit.question.id)
    : [];
  const currentValue = currentUnit
    ? currentUnit.subQuestion
      ? (answers[currentUnit.question.id] || {})[currentUnit.unitIndex] || ''
      : answers[currentUnit.question.id] || ''
    : '';

  const setCurrentValue = (value: any) => {
    if (!currentUnit || locked[currentUnit.key]) return;
    const questionId = currentUnit.question.id;
    if (currentUnit.subQuestion) {
      setAnswers((previous) => ({
        ...previous,
        [questionId]: { ...(previous[questionId] || {}), [currentUnit.unitIndex]: value },
      }));
    } else {
      setAnswers((previous) => ({ ...previous, [questionId]: value }));
    }
  };

  const goNext = () => {
    if (currentIndex < units.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const valueForUnit = (unit: ExamUnit) => unit.subQuestion
    ? (answers[unit.question.id] || {})[unit.unitIndex] || ''
    : answers[unit.question.id] || '';

  const hasEnteredAnswer = (unit: ExamUnit) => {
    const value = valueForUnit(unit);
    if (unit.question.sualTipi === 'ESSAY') {
      return Boolean(String(value?.topic || '').trim() || String(value?.text || '').trim());
    }
    return Boolean(String(value || '').trim());
  };

  const clearCurrentDraft = () => {
    if (!currentUnit) return;
    const questionId = currentUnit.question.id;
    if (currentListeningUnits.length) {
      setAnswers((previous) => {
        const nextBlock = { ...(previous[questionId] || {}) };
        for (const unit of currentListeningUnits) {
          if (!locked[unit.key]) delete nextBlock[unit.unitIndex];
        }
        return { ...previous, [questionId]: nextBlock };
      });
    } else {
      setAnswers((previous) => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
    }
    setError('');
  };

  const saveAndNext = async () => {
    if (!currentUnit) return;
    if (currentListeningUnits.length) {
      const unsavedUnits = currentListeningUnits.filter((unit) => !locked[unit.key]);
      if (!unsavedUnits.length) {
        const lastIndex = units.findIndex((unit) => unit.key === currentListeningUnits[currentListeningUnits.length - 1].key);
        if (lastIndex < units.length - 1) setCurrentIndex(lastIndex + 1);
        return;
      }
      const listeningAnswers = answers[currentUnit.question.id] || {};
      const answeredUnsavedUnits = unsavedUnits.filter((unit) => Boolean(listeningAnswers[unit.unitIndex]));
      if (!answeredUnsavedUnits.length) {
        const lastIndex = units.findIndex((unit) => unit.key === currentListeningUnits[currentListeningUnits.length - 1].key);
        if (lastIndex < units.length - 1) setCurrentIndex(lastIndex + 1);
        return;
      }
      setLoading(true); setError('');
      try {
        for (const unit of answeredUnsavedUnits) {
          const response = await client.post(`/student/questions/${currentUnit.question.id}/answer`, {
            cavab: listeningAnswers[unit.unitIndex],
            vahidIndex: unit.unitIndex,
          });
          const savedAnswer = response.data;
          setAnswers((previous) => ({ ...previous, [savedAnswer.sualId]: parseAnswer(savedAnswer.cavab) }));
          setLocked((previous) => ({ ...previous, [unit.key]: true }));
        }
        const lastIndex = units.findIndex((unit) => unit.key === currentListeningUnits[currentListeningUnits.length - 1].key);
        if (lastIndex < units.length - 1) setCurrentIndex(lastIndex + 1);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Listening cavabları yadda saxlanmadı.');
      } finally { setLoading(false); }
      return;
    }
    if (locked[currentUnit.key]) { goNext(); return; }
    if (!hasEnteredAnswer(currentUnit)) { goNext(); return; }
    setLoading(true); setError('');
    try {
      const { data } = await client.post(`/student/questions/${currentUnit.question.id}/answer`, {
        cavab: currentValue,
        vahidIndex: currentUnit.unitIndex,
      });
      setAnswers((previous) => ({ ...previous, [data.sualId]: parseAnswer(data.cavab) }));
      setLocked((previous) => ({ ...previous, [currentUnit.key]: true }));
      goNext();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Cavab yadda saxlanmadı.');
    } finally { setLoading(false); }
  };

  const finish = async () => {
    const unsavedAnswered = units.filter((unit) => !locked[unit.key] && hasEnteredAnswer(unit));
    if (unsavedAnswered.length) {
      setError(`Qeyd etdiyiniz ${unsavedAnswered.length} cavab hələ yadda saxlanılmayıb. Əvvəl həmin cavabları yadda saxlayın.`);
      return;
    }
    const unanswered = units.filter((unit) => !locked[unit.key]).length;
    const confirmation = unanswered
      ? `${unanswered} sualı cavabsız buraxmısınız. İmtahanı yekunlaşdırmaq istəyirsiniz?`
      : 'İmtahanı yekunlaşdırmaq istəyirsiniz?';
    if (!window.confirm(confirmation)) return;
    setLoading(true); setError('');
    try {
      await client.post('/student/finish');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'İmtahan yekunlaşdırılmadı.');
    } finally { setLoading(false); }
  };

  const restart = async () => {
    if (!window.confirm('Cari test cəhdi və cavabları silinəcək. Yenidən başlamaq istəyirsiniz?')) return;
    await client.post('/student/restart');
    setAnswers({}); setLocked({}); setCurrentIndex(0);
    await load();
  };

  if (exam?.finished) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-900"><main className="mx-auto flex min-h-[80vh] max-w-xl items-center"><section className="w-full rounded-2xl border bg-white p-8 text-center shadow-sm"><p className="font-bold uppercase tracking-widest text-emerald-600">İmtahan yekunlaşıb</p><h1 className="mt-3 text-3xl font-bold">{exam.exam?.ad}</h1><div className="my-7 rounded-xl bg-emerald-50 p-5"><p className="text-sm text-slate-600">Cari nəticəniz</p><p className="mt-1 text-4xl font-bold text-emerald-700">{exam.result?.score ?? 0} bal</p></div><p className="text-slate-600">Cavablandırılmış sual sayı: <b>{exam.result?.answered ?? 0} / {exam.result?.total ?? 0}</b></p><p className="mt-4 text-sm leading-6 text-slate-500">Essay cavabı müəllim tərəfindən yoxlandıqdan sonra bal nəticəyə əlavə ediləcək.</p><div className="mt-6 flex justify-center gap-3">{exam.canRetry && <button onClick={() => void restart()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Yenidən test et</button>}<button onClick={() => { localStorage.removeItem(TOKEN_KEY); setExam(null); }} className="rounded-xl border px-5 py-3 font-bold text-slate-700">Çıxış</button></div></section></main></div>;
  }

  if (!exam) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto grid min-h-[80vh] max-w-5xl items-center gap-10 lg:grid-cols-2"><div><p className="font-bold uppercase tracking-widest text-blue-600">İngilis dili</p><h1 className="mt-3 text-4xl font-bold">Səviyyə imtahanı</h1><p className="mt-4 leading-7 text-slate-600">Bu imtahan yalnız ETS-də I kurs bakalavr tələbələri üçündür. ETS username/FİN və kabinetinizdəki günlük imtahan şifrəsi ilə daxil olun.</p></div><form onSubmit={enter} className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">İmtahana giriş</h2><input className="input" placeholder="FİN, username və ya email" value={login.identifier} onChange={(e) => setLogin({ ...login, identifier: e.target.value })} required /><input className="input" type="text" inputMode="numeric" maxLength={8} placeholder="ETS günlük imtahan şifrəsi" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value.replace(/\D/g, '') })} required />{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}<button disabled={loading} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">{loading ? 'Yoxlanılır...' : 'Daxil ol'}</button></form></div></div>;
  }

  if (!currentUnit) return <div className="p-8 text-center">İmtahanda sual yoxdur.</div>;

  const question = currentUnit.question;
  const isListeningBlock = currentListeningUnits.length > 0;
  const isLocked = isListeningBlock
    ? currentListeningUnits.every((unit) => locked[unit.key])
    : Boolean(locked[currentUnit.key]);
  const savedCount = units.filter((unit) => locked[unit.key]).length;
  const blockTitle = question.sualTipi === 'LISTENING'
    ? `Listening ${question.variantlar?.listeningNo || ''}`
    : question.sualTipi === 'READING'
      ? question.variantlar?.title || `Reading ${question.variantlar?.readingNo || ''}`
      : question.sualTipi;

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <main className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-2xl bg-blue-700 p-6 text-white">
          <h1 className="text-2xl font-bold">{exam.exam.ad}</h1>
          <p className="mt-2 text-blue-100">{units.length} sual · {savedCount} cavab yadda saxlanılıb</p>
        </header>

        {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-20">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Suallar</h2>
              <span className="text-xs text-slate-500">{savedCount}/{units.length}</span>
            </div>
            <div className="grid grid-cols-7 gap-2 lg:grid-cols-5">
              {units.map((unit, index) => {
                const active = unit.question.sualTipi === 'LISTENING'
                  ? unit.question.id === currentUnit.question.id
                  : index === currentIndex;
                const saved = Boolean(locked[unit.key]);
                return <button key={unit.key} type="button" onClick={() => { setCurrentIndex(index); setError(''); }} className={`aspect-square rounded-lg text-sm font-bold transition ${active ? 'bg-blue-700 text-white ring-2 ring-blue-200' : saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-blue-100'}`}>{unit.number}</button>;
              })}
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-500"><p><span className="mr-2 inline-block h-3 w-3 rounded bg-emerald-100" />Yadda saxlanılıb</p><p><span className="mr-2 inline-block h-3 w-3 rounded bg-slate-100" />Cavab gözləyir</p></div>
          </aside>

          <section className="rounded-2xl border bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold uppercase tracking-wider text-blue-600">{isListeningBlock ? `Suallar ${currentListeningUnits[0].number}–${currentListeningUnits[currentListeningUnits.length - 1].number}` : `Sual ${currentUnit.number}`} / {units.length}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isLocked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{isLocked ? 'Yadda saxlanılıb · dəyişdirilə bilməz' : 'Hələ yadda saxlanılmayıb'}</span>
            </div>
            <h2 className="mt-4 text-xl font-bold">{blockTitle}</h2>

            {question.sualTipi === 'READING' && <div className="mt-5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-5 leading-7">{question.metn}</div>}

            {isListeningBlock ? (
              <div className="mt-6 space-y-7">
                {currentListeningUnits.map((unit) => {
                  const unitLocked = Boolean(locked[unit.key]);
                  const unitValue = (answers[question.id] || {})[unit.unitIndex] || '';
                  return <div key={unit.key} className={`rounded-xl border p-5 ${unitLocked ? 'bg-slate-50' : 'bg-white'}`}><div className="flex items-start justify-between gap-3"><p className="text-lg font-semibold"><span className="mr-2 text-blue-600">{unit.number}.</span>{unit.subQuestion.question}</p>{unitLocked && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Yadda saxlanılıb</span>}</div><div className="mt-4 space-y-3">{unit.subQuestion.variants.map((variant: any) => <label key={variant.label} className={`flex gap-3 rounded-xl border p-4 ${unitLocked ? 'cursor-not-allowed bg-white' : 'cursor-pointer hover:border-blue-300'}`}><input disabled={unitLocked} type="radio" name={unit.key} checked={unitValue === variant.label} onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: { ...(previous[question.id] || {}), [unit.unitIndex]: variant.label } }))} /><span><b>{variant.label}.</b> {variant.text}</span></label>)}</div></div>;
                })}
              </div>
            ) : currentUnit.subQuestion ? (
              <div className="mt-6">
                <p className="text-lg font-semibold">{currentUnit.subQuestion.question}</p>
                <div className="mt-4 space-y-3">{currentUnit.subQuestion.variants.map((variant: any) => <label key={variant.label} className={`flex gap-3 rounded-xl border p-4 ${isLocked ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-blue-300'}`}><input disabled={isLocked} type="radio" name={currentUnit.key} checked={currentValue === variant.label} onChange={() => setCurrentValue(variant.label)} /><span><b>{variant.label}.</b> {variant.text}</span></label>)}</div>
              </div>
            ) : question.sualTipi === 'ESSAY' ? (
              <div className="mt-6"><p className="mb-3 font-semibold">Bir mövzu seçin və həmin mövzu üzrə essenizi yazın.</p><div className="space-y-2">{(question.variantlar?.essayTopics || []).map((topic: string) => <label key={topic} className={`flex gap-3 rounded-xl border p-3 ${isLocked ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}><input disabled={isLocked} type="radio" name={`essay-${question.id}`} checked={(currentValue || {}).topic === topic} onChange={() => setCurrentValue({ ...(currentValue || {}), topic })} /><span>{topic}</span></label>)}</div><textarea disabled={isLocked} className="input mt-4 min-h-48 disabled:bg-slate-50" placeholder="Essenizi yazın" value={(currentValue || {}).text || ''} onChange={(e) => setCurrentValue({ ...(currentValue || {}), text: e.target.value })} /></div>
            ) : (
              <div className="mt-6"><p className="text-lg font-semibold whitespace-pre-wrap">{question.metn}</p><div className="mt-4 space-y-3">{(question.variantlar || []).map((variant: any) => <label key={variant.label} className={`flex gap-3 rounded-xl border p-4 ${isLocked ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-blue-300'}`}><input disabled={isLocked} type="radio" name={`q-${question.id}`} checked={currentValue === variant.label} onChange={() => setCurrentValue(variant.label)} /><span><b>{variant.label}.</b> {variant.text}</span></label>)}</div></div>
            )}

            <div className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-6">
              <div className="flex flex-wrap gap-3"><button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)} className="rounded-xl border px-5 py-3 font-bold text-slate-700 disabled:opacity-40">Əvvəlki</button>{!isLocked && (isListeningBlock ? currentListeningUnits.some(hasEnteredAnswer) : hasEnteredAnswer(currentUnit)) && <button type="button" onClick={clearCurrentDraft} className="rounded-xl border border-rose-200 px-4 py-3 font-bold text-rose-600 hover:bg-rose-50">Cavabı təmizlə</button>}</div>
              {currentIndex < units.length - 1 ? <button type="button" disabled={loading} onClick={() => void saveAndNext()} className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Yadda saxlanılır...' : isLocked ? 'Növbəti' : isListeningBlock ? `${blockTitle} cavablarını yadda saxla və növbəti` : 'Yadda saxla və növbəti'}</button> : <div className="flex gap-3">{!isLocked && <button type="button" disabled={loading} onClick={() => void saveAndNext()} className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Yadda saxlanılır...' : 'Yadda saxla'}</button>}<button type="button" disabled={loading} onClick={() => void finish()} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">İmtahanı yekunlaşdır</button></div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
