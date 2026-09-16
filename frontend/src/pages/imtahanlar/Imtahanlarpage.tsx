import { useEffect, useState, useMemo } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../../services/auth';
import { getFennler, type Fenn } from '../../services/fenn';
import { getMovzular, type Movzu } from '../../services/movzu';
import { getTestBankilar, type TestBanki } from '../../services/testBanki';
import { getSubjectGroups, type EtsSubjectGroup } from '../../services/ets';
import { getTedrisIller, type TedrisIl } from '../../services/tedrisIl';
import { getTelebeler, type Telebe } from '../../services/telebe';
import {
  getImtahanlar,
  createImtahan,
  updateImtahan,
  deleteImtahan,
  getImtahanTelebeler,
  telebeElave,
  getImtahanNeticeler,
  getImtahanMuellimler,
  assignImtahanMuellimler,
  type Imtahan,
  type CreateImtahanPayload,
  type ImtahanTerkibItem,
  type ImtahanMuellimAssignment,
} from '../../services/imtahan';
import { getMuellimler, type Muellim } from '../../services/muellim';

// ─── Sabitlər ──────────────────────────────────────────────
const SUAL_TIPLERI = [
  { value: 'TEST',     label: 'Test' },
  { value: 'NEZERI',  label: 'Nəzəri' },
  { value: 'DUSTUR',  label: 'Düstur' },
  { value: 'PRAKTIKI',label: 'Praktiki' },
] as const;

type SualTipi = typeof SUAL_TIPLERI[number]['value'];

const IMTAHAN_NOVLERI   = [{ value: 'TEST', label: 'Test' }, { value: 'YAZILI', label: 'Yazılı' }];
const TEHSIL_NOVLERI    = [{ value: 'EYANI', label: 'Əyani' }, { value: 'QIYABI', label: 'Qiyabi' }];
const IMTAHAN_SECIMI    = [
  { value: 'YENI',       label: 'Yeni' },
  { value: 'TEKRAR',     label: 'Təkrar' },
  { value: 'YENI_TEKRAR',label: 'Yeni Təkrar' },
];
const IMTAHAN_STATUSLARI = [
  { value: 'PLANLANIB',  label: 'Planlanıb',  color: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300' },
  { value: 'AKTIV',      label: 'Aktiv',      color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  { value: 'BITMIS',     label: 'Bitmiş',     color: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  { value: 'LEGV_EDILDI',label: 'Ləğv edildi',color: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
];

const DEFAULT_TERKIB: ImtahanTerkibItem[] = SUAL_TIPLERI.map((t) => ({
  sualTipi: t.value,
  sualSayi: 0,
  balPerSual: 0,
  yoxlamaMuddeti: null,
}));

const DEFAULT_TERKIB_MAP: Record<string, { sualSayi: number; balPerSual: number; yoxlamaMuddeti: number | null }> = {
  TEST: { sualSayi: 0, balPerSual: 0, yoxlamaMuddeti: null },
  NEZERI: { sualSayi: 0, balPerSual: 0, yoxlamaMuddeti: 0 },
  DUSTUR: { sualSayi: 0, balPerSual: 0, yoxlamaMuddeti: 0 },
  PRAKTIKI: { sualSayi: 0, balPerSual: 0, yoxlamaMuddeti: 0 },
};

// ETS sorğularında istifadə olunur — UI-da göstərilmir
const ETS_YEAR = '2026-2027';
const ETS_SEMESTER = 'SEMESTER_1';

const getLatestTedrisIlId = (iller: TedrisIl[]) =>
  iller.length ? iller[iller.length - 1].id : 0;

// ─── Köməkçilər ─────────────────────────────────────────────
const statusInfo = (s: string) =>
  IMTAHAN_STATUSLARI.find((x) => x.value === s) ?? { label: s, color: 'bg-slate-100 text-slate-700' };

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ═══════════════════════════════════════════════════════════
// STEP 1 — Əsas məlumatlar
// ═══════════════════════════════════════════════════════════
interface Step1Props {
  form: CreateImtahanPayload;
  setForm: React.Dispatch<React.SetStateAction<CreateImtahanPayload>>;
  fennler: Fenn[];
  tedrisIller: TedrisIl[];
  testBankilar: TestBanki[];
  movzular: Movzu[];
  filteredBankilar: TestBanki[];
  filteredMovzular: Movzu[];
  // allow updating terkib indirectly via form.sualTipleri in parent
}

const Step1Esas = ({ form, setForm, fennler, tedrisIller, filteredBankilar, filteredMovzular }: Step1Props) => {
  const [etsGroups, setEtsGroups] = useState<EtsSubjectGroup[]>([]);
  const [loadingEtsGroups, setLoadingEtsGroups] = useState(false);
  const [etsLoadError, setEtsLoadError] = useState<string | null>(null);

  const loadEtsGroups = async (fennExternalId?: string | number) => {
    setLoadingEtsGroups(true);
    setEtsLoadError(null);
    try {
      const list = await getSubjectGroups(ETS_YEAR, ETS_SEMESTER, 'ACTIVE', fennExternalId);
      setEtsGroups(list);
    } catch (err) {
      setEtsGroups([]);
      setEtsLoadError(err instanceof Error ? err.message : 'ETS qrupları yüklənərkən xəta');
    } finally {
      setLoadingEtsGroups(false);
    }
  };

  useEffect(() => {
    if (!form.fennId) {
      setEtsGroups([]);
      setEtsLoadError(null);
      return;
    }
    const f = fennler.find((x) => x.id === form.fennId);

    if (f?.externalId) {
      loadEtsGroups(f.externalId);
    } else {
      setEtsGroups([]);
    }
  }, [form.fennId, fennler]);
  const toggleTestBanki = (id: number) => {
    setForm((p) => ({
      ...p,
      testBankiIds: p.testBankiIds.includes(id)
        ? p.testBankiIds.filter((x) => x !== id)
        : [...p.testBankiIds, id],
    }));
  };

  const toggleMovzu = (id: number) => {
    setForm((p) => ({
      ...p,
      movzuIds: (p.movzuIds ?? []).includes(id)
        ? (p.movzuIds ?? []).filter((x) => x !== id)
        : [...(p.movzuIds ?? []), id],
    }));
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 focus:border-sky-500 focus:outline-none';
  const labelCls = 'mb-1.5 block text-xs font-medium text-slate-600';

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="space-y-6">
      {/* Sıra 1: Tədris ili */}
      <div>
        <label className={labelCls}>Tədris ili <span className="text-rose-400">*</span></label>
        <select
          value={form.tedrisIlId}
          onChange={() => {}}
          className={`${inputCls} cursor-not-allowed opacity-80`}
          disabled
        >
          {tedrisIller.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Sıra 2: Fənn */}
      <div>
        <label className={labelCls}>Fənn <span className="text-rose-400">*</span></label>
        <select
          value={form.fennId || ''}
          onChange={(e) => {
            setForm((p) => ({
              ...p,
              fennId: Number(e.target.value),
              etsSubjectId: undefined,
              testBankiIds: [],
              movzuIds: [],
              subjectGroupExternalId: undefined,
            }));
          }}
          className={inputCls}
        >
          <option value="">Fənn seçin</option>
          {fennler.map((f) => (
            <option key={f.id} value={f.id}>
              {f.fennAdi} ({f.fennKodu}){f.source === 'ETS' ? ' [ETS]' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Sıra 3: Fənn üzrə qrup (ETS) */}
      <div>
        <label className={labelCls}>Fənn üzrə qrup <span className="text-rose-400">*</span></label>
        {!form.fennId ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-700">
            Əvvəlcə fənn seçin
          </div>
        ) : loadingEtsGroups ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Qruplar yüklənir...
          </div>
        ) : etsLoadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {etsLoadError}
          </div>
        ) : etsGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-700">
            Aktiv qrup tapılmadı
          </div>
        ) : (
          <select
            value={form.subjectGroupExternalId ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, subjectGroupExternalId: e.target.value || undefined }))}
            className={inputCls}
            required
          >
            <option value="">Qrup seçin</option>
            {etsGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.subject ? ` — ${g.subject.subjectTitle ?? g.subject.subjectCode}` : ''}
                {' '}({g._count?.enrollments ?? 0} tələbə)
              </option>
            ))}
          </select>
        )}
        <p className="mt-2 text-xs text-slate-700">
          Seçilmiş qrupun tələbələri imtahana əlavə olunacaq.
        </p>
      </div>

      {/* Sıra 4: İmtahan adı */}
      <div>
        <label className={labelCls}>İmtahan adı <span className="text-rose-400">*</span></label>
        <input
          type="text"
          value={form.ad}
          onChange={(e) => setForm((p) => ({ ...p, ad: e.target.value }))}
          className={inputCls}
          placeholder="İmtahan adını daxil edin"
        />
      </div>

      {/* Sıra 3: İmtahan növü + Təhsil növü + İmtahan seçimi */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>İmtahan tipləri <span className="text-rose-400">*</span></label>
          <div className="flex flex-wrap gap-2">
            {SUAL_TIPLERI.map((t) => {
              const checked = (form as any).sualTipleri?.includes(t.value);
              return (
                <label key={t.value} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${checked ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-100/40 text-slate-600'}`}>
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={() => {
                      setForm((p) => {
                        const cur: string[] = (p as any).sualTipleri ?? ['TEST'];
                        const next = cur.includes(t.value) ? cur.filter((x) => x !== t.value) : [...cur, t.value];
                        return { ...p, sualTipleri: next } as CreateImtahanPayload;
                      });
                    }}
                  />
                  <span>{t.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <label className={labelCls}>Təhsil növü <span className="text-rose-400">*</span></label>
          <select value={form.tehsilNovu} onChange={(e) => setForm((p) => ({ ...p, tehsilNovu: e.target.value }))} className={inputCls}>
            {TEHSIL_NOVLERI.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>İmtahan <span className="text-rose-400">*</span></label>
          <select value={form.imtahanSecimi} onChange={(e) => setForm((p) => ({ ...p, imtahanSecimi: e.target.value }))} className={inputCls}>
            {IMTAHAN_SECIMI.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
      </div>

      {/* Sıra 4: Müddət + Keçid balı */}
        <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Müddət (dəqiqə) <span className="text-rose-400">*</span></label>
          <input
            type="number" min={1}
            value={form.muddet || ''}
            onChange={(e) => {
              const val = Number(e.target.value || 0);
              setForm((p) => {
                const next = { ...p, muddet: val } as CreateImtahanPayload;
                if (p.baslamaVaxti && val > 0) {
                  const start = new Date(p.baslamaVaxti);
                  if (!isNaN(start.getTime())) {
                    const end = new Date(start.getTime() + val * 60000);
                    next.bitmeVaxti = toLocalInput(end);
                  }
                }
                return next;
              });
            }}
            className={inputCls}
            placeholder="90"
          />
        </div>
        <div>
          <label className={labelCls}>Keçid balı <span className="text-rose-400">*</span></label>
          <input
            type="number" min={0}
            value={form.kecidBali || ''}
            onChange={(e) => setForm((p) => ({ ...p, kecidBali: Number(e.target.value) }))}
            className={inputCls}
            placeholder="17"
          />
        </div>
      </div>

      {/* Sıra 5: Başlama + Bitmə vaxtı */}
        <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Başlama vaxtı <span className="text-rose-400">*</span></label>
          <input
            type="datetime-local"
            value={form.baslamaVaxti}
            onFocus={(e) => (e.target as any).showPicker?.()}
            onChange={(e) => {
              const val = e.target.value;
              setForm((p) => {
                const next = { ...p, baslamaVaxti: val } as CreateImtahanPayload;
                if (p.muddet && Number(p.muddet) > 0 && val) {
                  const start = new Date(val);
                  if (!isNaN(start.getTime())) {
                    const end = new Date(start.getTime() + Number(p.muddet) * 60000);
                    next.bitmeVaxti = toLocalInput(end);
                  }
                }
                return next;
              });
            }}
            className={inputCls}
            placeholder="dd.mm.yyyy, --:--"
          />
          <p className="mt-1 text-xs text-slate-700">Format: dd.mm.yyyy, --:-- · Klikləyib təqvim açın</p>
        </div>
        <div>
          <label className={labelCls}>Bitmə vaxtı <span className="text-rose-400">*</span></label>
          <input
            type="datetime-local"
            value={form.bitmeVaxti}
            onFocus={(e) => (e.target as any).showPicker?.()}
            onChange={(e) => setForm((p) => ({ ...p, bitmeVaxti: e.target.value }))}
            className={inputCls}
            placeholder="dd.mm.yyyy, --:--"
          />
          <p className="mt-1 text-xs text-slate-700">Format: dd.mm.yyyy, --:-- · Klikləyib təqvim açın</p>
        </div>
      </div>

      {/* Test bankları — seçilmiş fənnə görə filter */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
  {/* Sol tərəf: Test bankları */}
  <div>
    <label className={labelCls}>
      Test bankları <span className="text-rose-400">*</span>
      <span className="ml-2 text-slate-600">(yalnız təsdiqlənmiş banklar)</span>
    </label>
    {!form.fennId ? (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-700">
        Əvvəlcə fənn seçin
      </div>
    ) : filteredBankilar.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-700">
        Bu fənn üçün təsdiqlənmiş test bankı yoxdur
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {filteredBankilar.map((b) => {
          const selected = form.testBankiIds.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleTestBanki(b.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                selected
                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-slate-100/40 text-slate-600 hover:border-slate-600'
              }`}
            >
              <span className={`h-4 w-4 shrink-0 rounded border ${selected ? 'border-sky-500 bg-sky-500' : 'border-slate-600'} flex items-center justify-center`}>
                {selected && <span className="text-[10px] text-white font-bold">✓</span>}
              </span>
              <span className="flex-1 truncate">{b.ad}</span>
              <span className="shrink-0 text-xs text-slate-700">{b._count?.suallar ?? 0} sual</span>
            </button>
          );
        })}
      </div>
    )}
  </div>

  {/* Sağ tərəf: Mövzular */}
  <div>
    <label className={labelCls}>
      Ancaq bu mövzular
      <span className="ml-2 text-slate-600">(opsional)</span>
    </label>
    {!form.fennId ? (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-700">
        Əvvəlcə fənn seçin
      </div>
    ) : filteredMovzular.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-700">
        Bu fənn üçün mövzu yoxdur
      </div>
    ) : (
      <div className="flex flex-wrap gap-2">
        {filteredMovzular.map((m) => {
          const selected = (form.movzuIds ?? []).includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMovzu(m.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-slate-100/40 text-slate-600 hover:border-slate-500'
              }`}
            >
              {m.ad}
            </button>
          );
        })}
      </div>
    )}
  </div>
</div>

      {/* Mövzular — opsional */}
  
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// STEP 2 — İmtahan tərkibi
// ═══════════════════════════════════════════════════════════
interface Step2Props {
  terkib: ImtahanTerkibItem[];
  setTerkib: React.Dispatch<React.SetStateAction<ImtahanTerkibItem[]>>;
}

const Step2Terkib = ({ terkib, setTerkib }: Step2Props) => {
  const update = (tipi: SualTipi, field: keyof ImtahanTerkibItem, val: number | null) => {
    setTerkib((prev) =>
      prev.map((t) => (t.sualTipi === tipi ? { ...t, [field]: val } : t))
    );
  };

  const cepte = terkib.filter((t) => t.sualSayi > 0);
  const umumiBal = cepte.reduce((sum, t) => sum + t.sualSayi * t.balPerSual, 0);
  const umumiSual = cepte.reduce((sum, t) => sum + t.sualSayi, 0);

  const isCavabsiz = (tipi: string) => ['NEZERI', 'DUSTUR', 'PRAKTIKI'].includes(tipi);

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 focus:border-sky-500 focus:outline-none text-center';

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        İmtahanda iştirak edəcək sual tipləri üzrə say və bal müəyyən edin.
        Çətinlik dərəcəsi bərabər nisbətdə (asan / orta / çətin) avtomatik bölünür.
      </p>

      {/* Cədvəl */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/60">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-100/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Sual tipi</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Sual sayı</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Bal / sual</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Cəmi bal</th>
              {/* Yalnız nəzəri/düstur/praktiki üçün */}
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Yoxlama müddəti (gün)</th>
            </tr>
          </thead>
          <tbody>
            {terkib.map((t) => {
              const cavabsiz = isCavabsiz(t.sualTipi);
              const aktiv = t.sualSayi > 0;
              return (
                <tr
                  key={t.sualTipi}
                  className={`border-b border-slate-200/40 last:border-0 transition-colors ${aktiv ? 'bg-sky-500/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-2 font-medium ${aktiv ? 'text-sky-700' : 'text-slate-700'}`}>
                      <span className={`h-2 w-2 rounded-full ${aktiv ? 'bg-sky-400' : 'bg-slate-600'}`} />
                      {SUAL_TIPLERI.find((x) => x.value === t.sualTipi)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <input
                      type="number" min={0}
                      value={t.sualSayi || ''}
                      onChange={(e) => update(t.sualTipi as SualTipi, 'sualSayi', Number(e.target.value))}
                      className={inputCls}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 w-32">
                    <input
                      type="number" min={0} step={0.5}
                      value={t.balPerSual || ''}
                      onChange={(e) => update(t.sualTipi as SualTipi, 'balPerSual', Number(e.target.value))}
                      className={inputCls}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">
                    {(t.sualSayi * t.balPerSual).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 w-44">
                    {cavabsiz ? (
                      <input
                        type="number" min={0}
                        value={t.yoxlamaMuddeti ?? ''}
                        onChange={(e) => update(t.sualTipi as SualTipi, 'yoxlamaMuddeti', e.target.value ? Number(e.target.value) : null)}
                        className={inputCls}
                        placeholder="0"
                      />
                    ) : (
                      <span className="block text-center text-xs text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-100/40">
              <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Cəmi</td>
              <td className="px-4 py-3 text-center font-bold text-slate-950">{umumiSual}</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-center font-bold text-slate-950">{umumiBal.toFixed(1)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Çətinlik bölgüsü izahı */}
      {umumiSual > 0 && (
        <div className="rounded-xl border border-slate-200/60 bg-slate-100/30 px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Çətinlik dərəcəsinə görə bölgü</p>
          <div className="flex gap-6">
            {terkib.filter((t) => t.sualSayi > 0).map((t) => {
              const asan = Math.floor(t.sualSayi / 3);
              const cettin = Math.floor(t.sualSayi / 3);
              const orta = t.sualSayi - asan - cettin;
              return (
                <div key={t.sualTipi} className="flex-1">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    {SUAL_TIPLERI.find((x) => x.value === t.sualTipi)?.label}
                  </p>
                  <div className="space-y-1">
                    {[['Asan', asan, 'bg-emerald-500'], ['Orta', orta, 'bg-amber-500'], ['Çətin', cettin, 'bg-rose-500']].map(
                      ([ad, say, color]) => (
                        <div key={ad as string} className="flex items-center gap-2">
                          <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${(Number(say) / t.sualSayi) * 100}%`, minWidth: 4 }} />
                          <span className="text-xs text-slate-600">{ad}: {say}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TƏLƏBƏ TƏHKİM PANELİ
// ═══════════════════════════════════════════════════════════
interface TelebePanelProps {
  imtahan: Imtahan;
  telebeler: Telebe[];
  onClose: () => void;
  onRefresh: () => void;
}

const TelebePanel = ({ imtahan, telebeler, onClose, onRefresh }: TelebePanelProps) => {
  const [tehkimOlunmus, setTehkimOlunmus] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'elave' | 'neticeler'>('elave');
  const [neticeler, setNeticeler] = useState<any[]>([]);
  const [loadingNeticeler, setLoadingNeticeler] = useState(false);

  useEffect(() => {
    loadTehkimler();
  }, []);

  const loadTehkimler = async () => {
    setLoading(true);
    try {
      const data = await getImtahanTelebeler(imtahan.id);
      setTehkimOlunmus(data.map((t: any) => t.telebeId));
    } finally {
      setLoading(false);
    }
  };

  const loadNeticeler = async () => {
    setLoadingNeticeler(true);
    try {
      const data = await getImtahanNeticeler(imtahan.id);
      setNeticeler(data);
    } finally {
      setLoadingNeticeler(false);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'neticeler' && neticeler.length === 0) loadNeticeler();
  };

  const filtered = telebeler.filter((t) => {
    const s = search.toLowerCase();
    return (
      t.ad.toLowerCase().includes(s) ||
      t.soyad.toLowerCase().includes(s) ||
      t.qrup?.toLowerCase().includes(s) ||
      t.etsId?.toLowerCase().includes(s)
    );
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const yeniIds = filtered.filter((t) => !tehkimOlunmus.includes(t.id)).map((t) => t.id);
    if (yeniIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(yeniIds));
    }
  };

  const handleTehkim = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      await telebeElave(imtahan.id, Array.from(selected));
      setSelected(new Set());
      await loadTehkimler();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const yeniTelebeler = filtered.filter((t) => !tehkimOlunmus.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200/80 bg-slate-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200/80 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-700">İmtahan</p>
              <h3 className="text-lg font-semibold text-slate-950">{imtahan.ad}</h3>
              <p className="text-xs text-slate-600">{tehkimOlunmus.length} tələbə təhkim olunub</p>
            </div>
            <button onClick={onClose} className="text-slate-600 transition hover:text-slate-950">✕</button>
          </div>
          {/* Tab */}
          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {[
              { key: 'elave', label: 'Tələbə əlavə et' },
              { key: 'neticeler', label: 'Nəticələr' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key as any)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? 'bg-slate-200 text-slate-950'
                    : 'text-slate-600 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tələbə əlavə et tabı */}
        {activeTab === 'elave' && (
          <>
            <div className="border-b border-slate-200/60 px-6 py-3 border border-gray-300 dark:border-gray-600">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ad, soyad, qrup və ya ETS ID ilə axtar..."
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-950 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              {yeniTelebeler.length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-700">
                    {yeniTelebeler.length} tələbə mövcuddur · {selected.size} seçilib
                  </span>
                  <button onClick={toggleAll} className="text-xs font-semibold text-sky-700 hover:text-sky-900">
                    {yeniTelebeler.every((t) => selected.has(t.id)) ? 'Seçimi sıfırla' : 'Hamısını seç'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mx-6 mt-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-3 border border-gray-300 dark:border-gray-600">
              {loading ? (
                <p className="text-center text-slate-600">Yüklənir...</p>
              ) : (
                <div className="space-y-2">
                  {/* Artıq təhkim olunmuşlar */}
                  {tehkimOlunmus.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Artıq təhkim olunub ({tehkimOlunmus.length})
                      </p>
                      {telebeler
                        .filter((t) => tehkimOlunmus.includes(t.id))
                        .filter((t) => {
                          const s = search.toLowerCase();
                          return !s || t.ad.toLowerCase().includes(s) || t.soyad.toLowerCase().includes(s) || t.qrup?.toLowerCase().includes(s);
                        })
                        .map((t) => (
                          <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-50">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[10px] text-emerald-700 ring-1 ring-emerald-200">✓</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-600">{t.soyad} {t.ad}</p>
                              <p className="text-xs text-slate-700">{t.qrup}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Yeni tələbələr */}
                  {yeniTelebeler.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-700">Əlavə olunacaq tələbə yoxdur</p>
                  ) : (
                    <>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Əlavə edilə bilər ({yeniTelebeler.length})
                      </p>
                      {yeniTelebeler.map((t) => {
                        const sel = selected.has(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggleSelect(t.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                              sel
                                ? 'border-sky-500/40 bg-sky-500/10'
                                : 'border-transparent hover:bg-slate-100/60'
                            }`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition ${
                              sel ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-600'
                            }`}>
                              {sel && '✓'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700">{t.soyad} {t.ad} {t.ata}</p>
                              <p className="text-xs text-slate-700">{t.qrup} · {t.ixtisas}</p>
                            </div>
                            <span className="shrink-0 text-xs text-slate-700">ETS: {t.etsId}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {selected.size > 0 && (
              <div className="border-t border-slate-200/60 px-6 py-4">
                <button
                  onClick={handleTehkim}
                  disabled={saving}
                  className="w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
                >
                  {saving ? 'Təhkim edilir...' : `${selected.size} tələbəni təhkim et`}
                </button>
              </div>
            )}
          </>
        )}

        {/* Nəticələr tabı */}
        {activeTab === 'neticeler' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingNeticeler ? (
              <p className="text-center text-slate-600">Yüklənir...</p>
            ) : neticeler.length === 0 ? (
              <p className="py-8 text-center text-slate-700">Hələ nəticə yoxdur</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/60 bg-slate-100/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Tələbə</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Qrup</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Bal</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Nəticə</th>
                    </tr>
                  </thead>
                  <tbody>
                    {neticeler.map((n, i) => (
                      <tr key={n.id} className="border-b border-slate-200/40 last:border-0">
                        <td className="px-4 py-3 text-slate-700">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-700">{n.telebe.soyad} {n.telebe.ad}</td>
                        <td className="px-4 py-3 text-slate-600">{n.telebe.qrup ?? '—'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{n.bal ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {n.kecdi === null ? (
                            <span className="text-xs text-slate-700">Gözləyir</span>
                          ) : n.kecdi ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Keçdi</span>
                          ) : (
                            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">Kəsildi</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Müəllim təhkim modalı
// ═══════════════════════════════════════════════════════════
const MuellimTehkimModal = ({
  imtahan,
  onClose,
  onSaved,
}: {
  imtahan: Imtahan;
  onClose: () => void;
  onSaved: (message: string) => void;
}) => {
  const [muellimler, setMuellimler] = useState<Muellim[]>([]);
  const [assignments, setAssignments] = useState<ImtahanMuellimAssignment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allMuellimler, current] = await Promise.all([
          getMuellimler(),
          getImtahanMuellimler(imtahan.id),
        ]);
        setMuellimler(allMuellimler);
        setAssignments(current);
        const ids = new Set<number>();
        current.forEach((row) => {
          const etsId = Number(row.etsTeacherId);
          if (!Number.isNaN(etsId)) ids.add(etsId);
        });
        setSelected(ids);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Yükləmə xətası');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [imtahan.id]);

  const terkibInfo = (imtahan.terkib || []).filter(
    (t) => ['NEZERI', 'DUSTUR', 'PRAKTIKI'].includes(t.sualTipi) && t.sualSayi > 0
  );

  const departments = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    muellimler.forEach((m) => {
      if (m.department && typeof m.department.id === 'number') {
        map.set(m.department.id, { id: m.department.id, name: m.department.name });
      }
    });
    return Array.from(map.values());
  }, [muellimler]);

  const filtered = muellimler.filter((m) => {
    if (departmentFilter && m.department?.id !== departmentFilter) return false;
    const q = search.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.pin.toLowerCase().includes(q)
    );
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selected.size) {
      setError('Ən azı bir müəllim seçin');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await assignImtahanMuellimler(imtahan.id, Array.from(selected));
      setAssignments(result.assignments || []);
      onSaved(result.message || 'Müəllimlər təhkim olundu');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Təhkim alınmadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Müəllim təhkimi</h2>
            <p className="text-sm text-slate-500">{imtahan.ad}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-5 space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Test sualları sistem tərəfindən avtomatik yoxlanılır. Seçilmiş müəllimlər arasında
            Nəzəri/Düstur/Praktiki sualları bərabər paylanır.
            {terkibInfo.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {terkibInfo.map((t) => (
                  <li key={t.sualTipi}>
                    {SUAL_TIPLERI.find((s) => s.value === t.sualTipi)?.label}: {t.sualSayi} sual
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-amber-700">Bu imtahanda müəllim yoxlaması tələb edən sual yoxdur.</p>
            )}
          </div>

          {assignments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cari təhkim</p>
              <div className="space-y-2 text-sm">
                {assignments.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">
                      {row.muellim.ad} {row.muellim.soyad}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                      {SUAL_TIPLERI.find((s) => s.value === row.sualTipi)?.label} {row.sualBaslangic}-{row.sualSon}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-sky-500 bg-white"
            >
              <option value="">Bütün kafedralar</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Müəllim axtar..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
            />
          </div>

          {loading ? (
            <p className="text-center text-sm text-slate-500 py-8">Yüklənir...</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              {filtered.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {m.lastName} {m.firstName}
                    </p>
                    <p className="text-xs text-slate-500">{m.email} · {m.pin}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Bağla
          </button>
          <button
            type="button"
            disabled={saving || !terkibInfo.length}
            onClick={handleSave}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
          >
            {saving ? 'Saxlanılır...' : `Təhkim et (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ANA KOMPONENT — ImtahanlarPage
// ═══════════════════════════════════════════════════════════
const DEFAULT_FORM: CreateImtahanPayload = {
  ad: '',
  fennId: 0,
  tedrisIlId: 0,
  imtahanNovu: 'TEST',
  sualTipleri: ['TEST'],
  tehsilNovu: 'EYANI',
  muddet: 90,
  kecidBali: 17,
  imtahanSecimi: 'YENI',
  baslamaVaxti: '',
  bitmeVaxti: '',
  testBankiIds: [],
  movzuIds: [],
  terkib: [],
  subjectGroupExternalId: undefined,
  etsSubjectId: undefined,
};

const ImtahanlarPage = () => {
  // Data
  const [imtahanlar, setImtahanlar] = useState<Imtahan[]>([]);
  const [fennler, setFennler] = useState<Fenn[]>([]);
  const [tedrisIller, setTedrisIller] = useState<TedrisIl[]>([]);
  const [testBankilar, setTestBankilar] = useState<TestBanki[]>([]);
  const [movzular, setMovzular] = useState<Movzu[]>([]);
  const [telebeler, setTelebeler] = useState<Telebe[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [savingImtahan, setSavingImtahan] = useState(false);

  // Wizard form
  const [form, setForm] = useState<CreateImtahanPayload>(DEFAULT_FORM);
  const [terkib, setTerkib] = useState<ImtahanTerkibItem[]>(DEFAULT_TERKIB);

  // Panel
  const [telebePanel, setTelebePanel] = useState<Imtahan | null>(null);
  const [muellimPanel, setMuellimPanel] = useState<Imtahan | null>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFenn, setFilterFenn] = useState('');

  useEffect(() => { loadData(); }, []);

  // Auto-fill terkib when selected sual tipleri change
  useEffect(() => {
    const selected: string[] = (form as any).sualTipleri ?? [];
    if (!selected.length) {
      setTerkib(DEFAULT_TERKIB);
      return;
    }
    const filled = DEFAULT_TERKIB
      .filter((d) => selected.includes(d.sualTipi))
      .map((d) => ({
        ...d,
        sualSayi: DEFAULT_TERKIB_MAP[d.sualTipi].sualSayi,
        balPerSual: DEFAULT_TERKIB_MAP[d.sualTipi].balPerSual,
        yoxlamaMuddeti: DEFAULT_TERKIB_MAP[d.sualTipi].yoxlamaMuddeti,
      }));
    setTerkib(filled);
  }, [form.sualTipleri]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); }
  }, [success]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [imtData, fennData, ilData, bankData, movData, telData, userData] = await Promise.all([
        getImtahanlar(),
        getFennler(),
        getTedrisIller(),
        getTestBankilar(undefined, 'TESDIQLENDI'),
        getMovzular(),
        getTelebeler(),
        fetchCurrentUser(),
      ]);
      setImtahanlar(imtData);
      setFennler(fennData);
      setTedrisIller(ilData);
      setTestBankilar(bankData);
      setMovzular(movData);
      setTelebeler(telData);
      setUser(userData);
      if (ilData?.length) {
        setForm((p) => ({ ...p, tedrisIlId: getLatestTedrisIlId(ilData) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  const filteredBankilar = testBankilar.filter((b) => b.fennId === form.fennId && b.status === 'TESDIQLENDI');
  const filteredMovzular = movzular.filter((m) => m.fennId === form.fennId);

  const filteredImtahanlar = imtahanlar.filter((im) => {
    if (filterStatus && im.status !== filterStatus) return false;
    if (filterFenn && im.fennId !== Number(filterFenn)) return false;
    return true;
  });

  // Wizard açmaq
  const openCreate = () => {
    setEditId(null);
    setForm({ ...DEFAULT_FORM, tedrisIlId: getLatestTedrisIlId(tedrisIller), sualTipleri: ['TEST'] });
    setTerkib(DEFAULT_TERKIB);
    setShowWizard(true);
    setError(null);
  };

  const openEdit = (im: Imtahan) => {
    setEditId(im.id);
    setForm({
      ad: im.ad,
      fennId: im.fennId,
      tedrisIlId: im.tedrisIlId,
      imtahanNovu: im.imtahanNovu,
      sualTipleri: im.sualTipleri ?? (im.terkib?.map((t:any) => t.sualTipi) ?? []),
      tehsilNovu: im.tehsilNovu,
      muddet: im.muddet,
      kecidBali: im.kecidBali,
      imtahanSecimi: im.imtahanSecimi,
      baslamaVaxti: im.baslamaVaxti?.slice(0, 16) ?? '',
      bitmeVaxti: im.bitmeVaxti?.slice(0, 16) ?? '',
      testBankiIds: im.testBankilar?.map((t: any) => t.testBankiId) ?? [],
      movzuIds: im.movzular?.map((m: any) => m.movzuId) ?? [],
      terkib: [],
    });
    setTerkib(
      im.terkib?.length
        ? DEFAULT_TERKIB.map((def) => im.terkib.find((t: any) => t.sualTipi === def.sualTipi) ?? def)
        : DEFAULT_TERKIB
    );
    setShowWizard(true);
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!form.tedrisIlId) return 'Tədris ili seçilməlidir';
    if (!form.fennId) return 'Fənn seçilməlidir';
    if (!form.subjectGroupExternalId) return 'Fənn üzrə qrup seçilməlidir';
    if (!form.ad.trim()) return 'İmtahan adı tələb olunur';
    if (!form.muddet) return 'Müddət tələb olunur';
    if (form.kecidBali === undefined || form.kecidBali === null) return 'Keçid balı tələb olunur';
    if (!form.baslamaVaxti) return 'Başlama vaxtı tələb olunur';
    if (!form.bitmeVaxti) return 'Bitmə vaxtı tələb olunur';
    if (!form.testBankiIds.length) return 'Ən az bir test bankı seçilməlidir';
    const aktivTerkib = terkib.filter((t) => t.sualSayi > 0);
    if (aktivTerkib.length === 0) return 'Ən az bir sual tipi üçün say daxil edilməlidir';
    for (const t of aktivTerkib) {
      if (t.balPerSual <= 0) return `${SUAL_TIPLERI.find((x) => x.value === t.sualTipi)?.label} üçün bal daxil edilməlidir`;
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSavingImtahan(true);
    setError(null);
    try {
      const payload: CreateImtahanPayload = {
        ...form,
        terkib: terkib.filter((t) => t.sualSayi > 0),
      };
      if (editId) {
        await updateImtahan(editId, { ad: form.ad, muddet: form.muddet, kecidBali: form.kecidBali, baslamaVaxti: form.baslamaVaxti, bitmeVaxti: form.bitmeVaxti });
        setSuccess('İmtahan yeniləndi');
      } else {
        await createImtahan(payload);
        setSuccess('İmtahan yaradıldı');
      }
      setShowWizard(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi');
    } finally {
      setSavingImtahan(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('İmtahanı silmək istəyirsiniz?')) return;
    try {
      await deleteImtahan(id);
      setSuccess('İmtahan silindi');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta');
    }
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="p-6">

      {/* ── Başlıq ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-700">Sistem</p>
          <h1 className="mt-1.5 text-3xl font-semibold text-slate-950">İmtahanlar</h1>
        </div>
        {user?.rol === 'ADMIN' && !showWizard && (
          <button
            onClick={openCreate}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            + Yeni İmtahan
          </button>
        )}
      </div>

      {/* ── Bildirişlər ── */}
      {error && !showWizard && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-rose-600 hover:text-rose-800">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* ── Wizard formu ── */}
      {showWizard && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100/30">

          {/* Wizard başlıq + addım göstəricisi */}
          <div className="border-b border-slate-200/60 bg-slate-100/50 px-6 py-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">
                {editId ? 'İmtahanı düzəlt' : 'Yeni İmtahan yarat'}
              </h2>
              <button onClick={() => setShowWizard(false)} className="text-slate-600 transition hover:text-slate-950">✕</button>
            </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 font-bold text-white">1</div>
                  <div className="text-sm font-medium text-slate-950">Əsas məlumatlar</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 font-bold text-white">2</div>
                  <div className="text-sm font-medium text-slate-950">İmtahan tərkibi</div>
                </div>
              </div>
          </div>

          {/* Wizard məzmun */}
          <div className="px-6 py-6">
            {error && (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
                <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">✕</button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <h3 className="mb-4 text-sm font-semibold text-slate-950">1. Əsas məlumatlar</h3>
                <Step1Esas
                  form={form} setForm={setForm}
                  fennler={fennler} tedrisIller={tedrisIller}
                  testBankilar={testBankilar} movzular={movzular}
                  filteredBankilar={filteredBankilar}
                  filteredMovzular={filteredMovzular}
                />
              </div>
              <div>
                <h3 className="mb-4 text-sm font-semibold text-slate-950">2. İmtahan tərkibi</h3>
                <Step2Terkib terkib={terkib} setTerkib={setTerkib} />
              </div>
            </div>
          </div>

          {/* Wizard footer */}
          <div className="flex items-center justify-between border-t border-slate-200/60 bg-slate-100/30 px-6 py-4">
            <button
              onClick={() => setShowWizard(false)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Ləğv et
            </button>
            <button
              onClick={handleSave}
              disabled={savingImtahan}
              className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {savingImtahan ? 'Saxlanılır...' : editId ? 'Yadda saxla' : 'İmtahanı yarat ✓'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filterlər ── */}
      {!showWizard && (
        <div className="mb-5 flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-100/60 px-4 py-2 text-sm text-slate-600 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Bütün statuslar</option>
            {IMTAHAN_STATUSLARI.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={filterFenn}
            onChange={(e) => setFilterFenn(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-100/60 px-4 py-2 text-sm text-slate-600 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Bütün fənnlər</option>
            {fennler.map((f) => (
              <option key={f.id} value={f.id}>{f.fennAdi}</option>
            ))}
          </select>
          {(filterStatus || filterFenn) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterFenn(''); }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:text-slate-950"
            >
              Sıfırla
            </button>
          )}
          <span className="ml-auto self-center text-sm text-slate-700">{filteredImtahanlar.length} imtahan</span>
        </div>
      )}

      {/* ── Cədvəl ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-600">Yüklənir...</div>
      ) : filteredImtahanlar.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg text-slate-600">İmtahan tapılmadı</p>
          <p className="mt-1 text-sm text-slate-700">
            {filterStatus || filterFenn ? 'Filtrləri dəyişin' : 'Yeni imtahan yaratmaq üçün düyməni basın'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-slate-100/20">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-100/40">
                {['#','Ad','Fənn','Tədris ili','Növ','Müddət','Keçid balı','Başlama','Bitmə','Status','Tələbə','Əməliyyatlar'].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 first:pl-5 last:text-right last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredImtahanlar.map((im, idx) => {
                const si = statusInfo(im.status);
                const fenn = fennler.find((f) => f.id === im.fennId);
                const tedrisIl = tedrisIller.find((t) => t.id === im.tedrisIlId);
                return (
                  <tr key={im.id} className="border-b border-slate-200/40 transition-colors last:border-0 hover:bg-slate-100/30">
                    <td className="pl-5 pr-4 py-4 text-sm text-slate-700">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-slate-950">{im.ad}</p>
                      <p className="text-xs text-slate-700">
                        {IMTAHAN_SECIMI.find((x) => x.value === im.imtahanSecimi)?.label} ·{' '}
                        {TEHSIL_NOVLERI.find((x) => x.value === im.tehsilNovu)?.label}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{fenn?.fennAdi ?? '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{tedrisIl?.label ?? '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {(im.sualTipleri && im.sualTipleri.length)
                        ? im.sualTipleri.map((v) => SUAL_TIPLERI.find((s) => s.value === v)?.label ?? v).join(' + ')
                        : IMTAHAN_NOVLERI.find((x) => x.value === im.imtahanNovu)?.label}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{im.muddet} dəq</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-950">{im.kecidBali}</td>
                    <td className="px-4 py-4 text-xs text-slate-600">{fmtDate(im.baslamaVaxti)}</td>
                    <td className="px-4 py-4 text-xs text-slate-600">{fmtDate(im.bitmeVaxti)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${si.color}`}>
                        {si.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setTelebePanel(im)}
                        className="rounded-lg bg-slate-200/60 px-2.5 py-1 text-sm font-semibold text-slate-950 transition hover:bg-sky-50 hover:text-sky-700"
                      >
                        {im._count?.telebeleri ?? 0}
                      </button>
                    </td>
                    <td className="py-4 pr-5 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user?.rol === 'ADMIN' && im.status === 'PLANLANIB' && (
                          <button
                            onClick={() => openEdit(im)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-500 hover:bg-slate-200/50"
                          >
                            Düzəlt
                          </button>
                        )}
                        <button
                          onClick={() => setTelebePanel(im)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-500 hover:bg-slate-200/50"
                        >
                          Tələbələr
                        </button>
                        {user?.rol === 'ADMIN' && (
                          <button
                            onClick={() => setMuellimPanel(im)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                          >
                            Müəllimlər
                          </button>
                        )}
                        {user?.rol === 'ADMIN' && im.status !== 'AKTIV' && (
                          <button
                            onClick={() => handleDelete(im.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10"
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tələbə paneli ── */}
      {telebePanel && (
        <TelebePanel
          imtahan={telebePanel}
          telebeler={telebeler}
          onClose={() => setTelebePanel(null)}
          onRefresh={loadData}
        />
      )}

      {muellimPanel && (
        <MuellimTehkimModal
          imtahan={muellimPanel}
          onClose={() => setMuellimPanel(null)}
          onSaved={(message) => {
            setSuccess(message);
            void loadData();
          }}
        />
      )}
    </div>
  );
};

export default ImtahanlarPage;
