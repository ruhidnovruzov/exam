import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Send } from 'lucide-react';
import {
  answerStudentQuestion,
  finishStudentExam,
  getStudentExam,
  type StudentExamDetail,
  type StudentQuestion,
} from '../../services/studentExam';

type MatchingQuestion = {
  instruction: string;
  leftItems: Array<{ key: string; text: string }>;
  rightItems: Array<{ key: string; text: string }>;
};

// Müəllim matching sualını mətn sahəsinə yazanda (hətta sətirlər paste
// zamanı birləşsə belə) `1.` və `a.` hissələrini ayrı bloklar kimi tanıyırıq.
const parseMatchingQuestion = (source: string): MatchingQuestion | null => {
  const text = source
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // `1.`, `2.`, `a.`, `b.` markerlərini ayrıca oxuyuruq. Bu yanaşma
  // müəllimin mətni bir sətirdə paste etməsi halında da işləyir.
  const markers = [...text.matchAll(/(?:^|\s)(\d+|[a-z])\.\s*/g)];
  const items = markers.map((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = index < markers.length - 1 ? (markers[index + 1].index ?? text.length) : text.length;
    return { key: marker[1], text: text.slice(start, end).trim(), index: marker.index ?? 0 };
  });

  // Bəzi suallarda başlanğıcdakı `4.` ümumi sual nömrəsidir; matching
  // hissəsi isə `1.`-dən başlayır.
  const firstItemIndex = items.findIndex((item) => item.key === '1');
  const numbered = (firstItemIndex >= 0 ? items.slice(firstItemIndex) : items)
    .filter((item) => /^\d+$/.test(item.key));
  const lettered = items.filter((item) => /^[a-z]$/.test(item.key));

  if (numbered.length < 2 || lettered.length < 2) return null;

  const firstQuestionStart = numbered[0].index;
  const instruction = text.slice(0, firstQuestionStart).trim();
  const cleanText = (value: string) => value.trim();

  return {
    instruction,
    leftItems: numbered.map((item) => ({ key: item.key, text: cleanText(item.text) })),
    rightItems: lettered.map((item) => ({ key: item.key.toLowerCase(), text: cleanText(item.text) })),
  };
};

const MatchingQuestionDisplay = ({ matching }: { matching: MatchingQuestion }) => (
  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base leading-7 text-slate-900">
    {matching.instruction.replace(/^\d+\.\s*/, '')}
    {'\n'}
    {matching.leftItems.map((item) => `${item.key}. ${item.text}`).join('\n')}
    {'\n'}
    {matching.rightItems.map((item) => `${item.key}. ${item.text}`).join('\n')}
  </div>
);

const StudentExamPage = () => {
  const { id } = useParams();
  const imtahanId = Number(id);
  const [exam, setExam] = useState<StudentExamDetail | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  type WrittenAnswer = { text: string; images: string[] };
  const [answers, setAnswers] = useState<Record<number, string | number | WrittenAnswer>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [error, setError] = useState('');
  const autoSubmittedRef = useRef(false);

  const parseWrittenAnswer = (value: string | null | undefined): WrittenAnswer | string => {
    if (!value) return '';
    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
    const images: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(value)) !== null) {
      images.push(match[1]);
    }
    const text = value
      .replace(/<img\s+[^>]*>/gi, '')
      .replace(/<br\s*\/?>(\s*)/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    return images.length ? { text, images } : text;
  };

  const serializeWrittenAnswer = (value: string | WrittenAnswer) => {
    if (typeof value === 'string') {
      return value;
    }
    const textHtml = (value.text || '').replace(/\n/g, '<br/>');
    const imageHtml = value.images.map((src) => `<img src="${src}" alt="sekil" class="max-w-full" />`).join('');
    return `${textHtml}${imageHtml}`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getStudentExam(imtahanId);
        setExam(data);
        const savedIndex = Number(sessionStorage.getItem(`student-exam-${imtahanId}-active-index`));
        if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < data.questions.length) {
          setActiveIndex(savedIndex);
        }
        setAnswers(
          Object.fromEntries(
            data.questions
              .map((q) => [
                q.id,
                q.sualTipi === 'TEST' ? q.secilenCavabId : parseWrittenAnswer(q.yaziliCavab),
              ])
              .filter(([, value]) => value !== null && value !== undefined)
          ) as Record<number, string | number | WrittenAnswer>
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'İmtahan yüklənmədi');
      }
    };

    if (imtahanId) load();
  }, [imtahanId]);

  useEffect(() => {
    sessionStorage.setItem(`student-exam-${imtahanId}-active-index`, String(activeIndex));
  }, [activeIndex, imtahanId]);

  const question = exam?.questions[activeIndex];
  const answeredCount = useMemo(
    () => exam?.questions.filter((q) => answers[q.id] !== undefined && String(answers[q.id]).trim() !== '').length ?? 0,
    [answers, exam]
  );

  const finish = useCallback(async (auto = false) => {
    if (auto && autoSubmittedRef.current) return;
    if (!auto && !window.confirm('İmtahanı yekunlaşdırmaq istəyirsiniz?')) return;
    if (auto) autoSubmittedRef.current = true;
    setFinishing(true);
    try {
      const result = await finishStudentExam(imtahanId);
      setExam(result as StudentExamDetail);
      sessionStorage.removeItem(`student-exam-${imtahanId}-active-index`);
    } finally {
      setFinishing(false);
    }
  }, [imtahanId]);

  useEffect(() => {
    if (!exam?.deadlineAt) return;

    const deadline = new Date(exam.deadlineAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        finish(true);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [exam?.deadlineAt, finish]);

  const saveAnswer = async (q: StudentQuestion, value: string | number | WrittenAnswer) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    setSavingId(q.id);
    try {
      await answerStudentQuestion(
        imtahanId,
        q.id,
        q.sualTipi === 'TEST'
          ? { secilenCavabId: Number(value) }
          : { yaziliCavab: serializeWrittenAnswer(value as string | WrittenAnswer) }
      );
    } finally {
      setSavingId(null);
    }
  };

  const handlePasteIntoAnswer = async (e: ClipboardEvent<HTMLTextAreaElement>, q: StudentQuestion) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const current = answers[q.id];
        const existing =
          typeof current === 'object' && current !== null && 'text' in current
            ? current
            : { text: typeof current === 'string' ? current : '', images: [] };
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const next: WrittenAnswer = {
            text: existing.text,
            images: [...existing.images, dataUrl],
          };
          setAnswers((prev) => ({ ...prev, [q.id]: next }));
          setSavingId(q.id);
          try {
            await answerStudentQuestion(imtahanId, q.id, { yaziliCavab: serializeWrittenAnswer(next) });
          } finally {
            setSavingId(null);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>
      </div>
    );
  }

  if (!exam || !question) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Yüklənir...</div>;
  }

  if (exam.finished) {
    const testResult = exam.result?.test;
    const essayResult = exam.result?.essay;
    return (
      <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
        <main className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-center text-2xl font-bold">İmtahan yekunlaşıb</h1>
          <p className="mt-2 text-center text-sm text-slate-500">Avtomatik yoxlanan test suallarının nəticəsi aşağıdadır.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ResultCard label="Düzgün" value={`${testResult?.correct ?? 0}/${testResult?.total ?? 0}`} color="text-emerald-600" />
            <ResultCard label="Səhv" value={testResult?.incorrect ?? 0} color="text-rose-600" />
            <ResultCard label="Test balı" value={testResult?.score ?? 0} color="text-cyan-700" />
          </div>
          {(essayResult?.total ?? 0) > 0 && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {essayResult?.answered ?? 0}/{essayResult?.total ?? 0} yazılı cavab göndərilib. Yazılı/essay sualları müəllim tərəfindən ayrıca yoxlanılacaq.
            </p>
          )}
          <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm">
            Ümumi bal: <b>{exam.bal ?? 0}</b> · <span className={exam.kecdi ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{exam.kecdi ? 'Keçdi' : 'Keçmədi'}</span>
          </div>
          <Link to="/student" className="mt-6 block rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white hover:bg-slate-800">Panelə qayıt</Link>
        </main>
      </div>
    );
  }

  // Matching sualı test kimi də yaradıla bilər: cavab variantları A/B/C
  // olaraq qalır, yalnız sualın mətni iki sütunda göstərilir.
  const matchingQuestion = parseMatchingQuestion(question.metn);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/student" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              İmtahanlara qayıt
            </Link>
            <h1 className="text-xl font-bold">{exam.imtahan.ad}</h1>
            <p className="mt-1 text-sm text-slate-500">{exam.imtahan.fenn.fennAdi}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
              (timeLeftMs ?? 0) <= 5 * 60 * 1000 ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200'
            }`}>
              <Clock className="h-4 w-4" />
              {formatTimeLeft(timeLeftMs)}
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold">
              Cavablandı: {answeredCount}/{exam.questions.length}
            </div>
            <button
              onClick={() => finish()}
              disabled={finishing}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Yekunlaşdır
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-bold text-slate-700">Suallar</p>
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-4">
            {exam.questions.map((q, index) => {
              const active = index === activeIndex;
              const answered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveIndex(index)}
                  className={`h-11 rounded-lg text-sm font-bold transition ${
                    active
                      ? 'bg-cyan-500 text-slate-950'
                      : answered
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cyan-700">Sual {activeIndex + 1}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{question.sualTipi}</p>
            </div>
            {savingId === question.id && <span className="text-sm font-semibold text-slate-500">Yadda saxlanılır...</span>}
          </div>

          {matchingQuestion ? (
            <MatchingQuestionDisplay matching={matchingQuestion} />
          ) : (
            <div className="prose prose-slate max-w-none text-base leading-7" dangerouslySetInnerHTML={{ __html: question.metn }} />
          )}
          {question.sekil && <img src={question.sekil} alt="Sual şəkli" className="mt-4 max-h-80 rounded-xl border border-slate-200 object-contain" />}

          <div className="mt-8">
            {question.sualTipi === 'TEST' ? (
              <div className="space-y-3">
                {question.cavablar.map((answer) => (
                  <label
                    key={answer.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      Number(answers[question.id]) === answer.id
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={Number(answers[question.id]) === answer.id}
                      onChange={() => saveAnswer(question, answer.id)}
                      className="mt-1 h-4 w-4 text-cyan-600"
                    />
                    <span className="text-sm leading-6 text-slate-800">{answer.metn}</span>
                  </label>
                ))}
              </div>
            ) : (
              <>
                <textarea
                  value={(() => {
                    const current = answers[question.id];
                    return typeof current === 'object' && current !== null && 'text' in current
                      ? current.text
                      : String(current ?? '');
                  })()}
                  onChange={(e) => {
                    setAnswers((prev) => {
                      const current = prev[question.id];
                      if (typeof current === 'object' && current !== null && 'text' in current) {
                        return { ...prev, [question.id]: { ...current, text: e.target.value } };
                      }
                      return { ...prev, [question.id]: e.target.value };
                    });
                  }}
                  onBlur={() => saveAnswer(question, answers[question.id] ?? '')}
                  onPaste={(e) => handlePasteIntoAnswer(e, question)}
                  rows={10}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                  placeholder={matchingQuestion ? 'Cavabları yazın: 1-c, 2-a, 3-e...' : 'Cavabınızı yazın'}
                />
                {(() => {
                  const current = answers[question.id];
                  if (typeof current === 'object' && current !== null && current.images?.length) {
                    return (
                      <div className="mt-4 grid gap-3">
                        {current.images.map((src, index) => (
                          <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <img src={src} alt={`Cavab şəkil ${index + 1}`} className="max-h-72 w-full object-contain rounded-xl" />
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
            <button
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              disabled={activeIndex === 0}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Əvvəlki
            </button>
            {activeIndex === exam.questions.length - 1 ? (
              <button onClick={() => finish()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                Bitir
              </button>
            ) : (
              <button
                onClick={() => setActiveIndex((i) => Math.min(exam.questions.length - 1, i + 1))}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                Növbəti
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const formatTimeLeft = (value: number | null) => {
  if (value === null) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

const ResultCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

export default StudentExamPage;
