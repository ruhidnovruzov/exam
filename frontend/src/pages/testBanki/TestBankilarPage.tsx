import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../../services/auth';
import { getKafedralar, type Kafedra } from '../../services/kafedra';
import { getFennler, type Fenn } from '../../services/fenn';
import { getMovzular, type Movzu } from '../../services/movzu';
import {
  getTestBankilar,
  createTestBanki,
  updateTestBanki,
  deleteTestBanki,
  tesdiqle,
  tesdiqdenQaldir,
  redakyeyeGonder,
  blokToggle,
  umumiBaxis,
  cavabsizBaxis,
  dogruCavabsizBaxis,
  type TestBanki,
  type CreateTestBankiPayload,
} from '../../services/testBanki';
import {
  getSuallar,
  createSual,
  deleteSual,
  type Sual,
  type CreateSualPayload,
} from '../../services/sual';

// ─── Tiplər ────────────────────────────────────────────────
type BaxisRejimi = 'umumi' | 'cavabsiz' | 'dogru_cavabsiz' | null;

const SUAL_TIPLERI = [
  { value: 'TEST', label: 'Test' },
  { value: 'NEZERI', label: 'Nəzəri' },
  { value: 'DUSTUR', label: 'Düstur' },
  { value: 'PRAKTIKI', label: 'Praktiki' },
];

const CHETINLIK = [
  { value: 'ASAN', label: 'Asan' },
  { value: 'ORTA', label: 'Orta' },
  { value: 'CETTIN', label: 'Çətin' },
];

const DEFAULT_SUAL: CreateSualPayload = {
  testBankiId: 0,
  movzuId: 0,
  sualTipi: 'TEST',
  chetinlik: 'ORTA',
  metn: '',
  sekil: null,
  cavablar: [
    { metn: '', duzgundur: false, sira: 0 },
    { metn: '', duzgundur: false, sira: 1 },
    { metn: '', duzgundur: false, sira: 2 },
    { metn: '', duzgundur: false, sira: 3 },
  ],
};

// ─── Köməkçi funksiyalar ───────────────────────────────────
const statusLabel = (s: string) =>
  ({ GOZLEYIR: 'Gözləyir', TESDIQLENDI: 'Təsdiqlənib', REDAKTEYE_GONDERILIB: 'Redaktəyə göndərilib', LEGV_EDILDI: 'Ləğv edildi' }[s] ?? s);

const statusColor = (s: string) =>
  ({
    GOZLEYIR: 'bg-amber-50 text-amber-800 border border-amber-200',
    TESDIQLENDI: 'bg-green-50 text-green-800 border border-green-200',
    REDAKTEYE_GONDERILIB: 'bg-blue-50 text-blue-800 border border-blue-200',
    LEGV_EDILDI: 'bg-red-50 text-red-800 border border-red-200',
  }[s] ?? 'bg-slate-50 text-slate-700 border border-slate-200');

const blokColor = (b: string) =>
  b === 'ACIQDIR'
    ? 'bg-green-50 text-green-800 border border-green-200'
    : 'bg-slate-100 text-slate-700 border border-slate-200';

// ─── Dropdown menyusu ──────────────────────────────────────
interface ActionMenuProps {
  bank: TestBanki;
  isAdmin: boolean;
  isKafedra: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTesdiqle: () => void;
  onTesdiqdenQaldir: () => void;
  onRedakteye: () => void;
  onBlokToggle: () => void;
  onSuallar: () => void;
  onUmumiBaxis: () => void;
  onCavabsizBaxis: () => void;
  onDogruCavabsizBaxis: () => void;
}

const ActionMenu = ({
  bank, isAdmin, isKafedra,
  onEdit, onDelete, onTesdiqle, onTesdiqdenQaldir, onRedakteye,
  onBlokToggle, onSuallar, onUmumiBaxis, onCavabsizBaxis, onDogruCavabsizBaxis,
}: ActionMenuProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const belowSpace = window.innerHeight - rect.bottom - 12;
    const aboveSpace = rect.top - 12;
    const openAbove = belowSpace < 200 && aboveSpace > belowSpace;

    setMenuStyle({
      position: 'fixed',
      right,
      width: 224,
      maxHeight: 'calc(100vh - 5rem)',
      overflowY: 'auto',
      top: openAbove ? undefined : rect.bottom + 6,
      bottom: openAbove ? window.innerHeight - rect.top + 6 : undefined,
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      updateMenuPosition();
      window.addEventListener('resize', updateMenuPosition);
      window.addEventListener('scroll', updateMenuPosition, true);
      return () => {
        window.removeEventListener('resize', updateMenuPosition);
        window.removeEventListener('scroll', updateMenuPosition, true);
      };
    }
  }, [open]);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => { onClick(); setOpen(false); }}
      className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  const divider = <div className="my-1 border-t border-slate-200" />;

  return (
    <div className="relative overflow-visible" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 bg-white"
      >
        Əməliyyatlar ▾
      </button>
      {open && (
        <div
          style={menuStyle ?? undefined}
          className="z-50 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {/* Baxış */}
          {item('Suallar', onSuallar)}
          {item('Ümumi baxış', onUmumiBaxis)}
          {item('Cavabsız ümumi baxış', onCavabsizBaxis)}
          {item('Doğru cavabsız ümumi baxış', onDogruCavabsizBaxis)}

          {divider}

          {/* Redaktə */}
          {(isAdmin || isKafedra) && item('Dəyiş', onEdit)}
          {(isAdmin || isKafedra) && item('Sil', onDelete, true)}

          {/* Admin əməliyyatları */}
          {isAdmin && divider}
          {isAdmin && bank.status !== 'TESDIQLENDI' && item('Təsdiqlə', onTesdiqle)}
          {isAdmin && bank.status === 'TESDIQLENDI' && item('Təsdiqden qaldır', onTesdiqdenQaldir)}
          {isAdmin && item('Redaktəyə göndər', onRedakteye)}
          {isAdmin && item(bank.blok === 'ACIQDIR' ? 'Bağla' : 'Aç', onBlokToggle)}
        </div>
      )}
    </div>
  );
};

// ─── Sual baxış paneli ─────────────────────────────────────
interface SualBaxisProps {
  suallar: Sual[];
  rejim: BaxisRejimi;
  bankAd: string;
  onClose: () => void;
}

const SualBaxisPanel = ({ suallar, rejim, bankAd, onClose }: SualBaxisProps) => {
  const title = {
    umumi: 'Ümumi baxış',
    cavabsiz: 'Cavabsız ümumi baxış',
    dogru_cavabsiz: 'Doğru cavabsız baxış',
  }[rejim!];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{bankAd}</p>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-600 transition hover:text-slate-900">✕</button>
        </div>
        {/* Suallar content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {suallar.length === 0 ? (
            <p className="text-center text-sm font-medium text-slate-500">Sual yoxdur</p>
          ) : (
            <div className="space-y-3">
              {suallar.map((s, i) => (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-2 flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="mb-1 flex flex-wrap gap-2">
                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                          {SUAL_TIPLERI.find((t) => t.value === s.sualTipi)?.label}
                        </span>
                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {CHETINLIK.find((c) => c.value === s.chetinlik)?.label}
                        </span>
                        <span className="rounded px-2 py-0.5 text-xs text-slate-600">{s.movzu?.ad}</span>
                      </div>
                      <p className="text-sm text-slate-900">{s.metn}</p>
                      {s.sekil && (
                        <img src={s.sekil} alt="sual şəkli" className="mt-2 max-h-48 rounded-lg object-contain border border-slate-200" />
                      )}
                    </div>
                  </div>
                  {/* Cavablar */}
                  {s.cavablar && s.cavablar.length > 0 && (
                    <div className="ml-8 mt-3 space-y-1.5">
                      {s.cavablar.map((c, ci) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            rejim === 'umumi' && c.duzgundur
                              ? 'bg-green-50 text-green-800 border border-green-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span className="shrink-0 font-semibold">
                            {String.fromCharCode(65 + ci)})
                          </span>
                          {c.metn}
                          {rejim === 'umumi' && c.duzgundur && (
                            <span className="ml-auto text-xs font-semibold">✓ Düzgün</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sual əlavə etmə paneli ────────────────────────────────
interface SualElavePanelProps {
  bank: TestBanki;
  movzular: Movzu[];
  onClose: () => void;
  onRefresh: () => void;
}

const SualElavePaneli = ({ bank, movzular, onClose, onRefresh }: SualElavePanelProps) => {
  const [suallar, setSuallar] = useState<Sual[]>([]);
  const [loadingSuallar, setLoadingSuallar] = useState(true);
  const [showSualForm, setShowSualForm] = useState(false);
  const [sualForm, setSualForm] = useState<CreateSualPayload>({ ...DEFAULT_SUAL, testBankiId: bank.id });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bankMovzular = movzular.filter((m) => m.fennId === bank.fennId);

  useEffect(() => {
    loadSuallar();
  }, []);

  const loadSuallar = async () => {
    setLoadingSuallar(true);
    try {
      const data = await getSuallar({ testBankiId: bank.id });
      setSuallar(data);
    } finally {
      setLoadingSuallar(false);
    }
  };

  const isCavabsizTip = ['NEZERI', 'DUSTUR', 'PRAKTIKI'].includes(sualForm.sualTipi);

  const handleTipChange = (tip: string) => {
    setSualForm((prev) => ({
      ...prev,
      sualTipi: tip as CreateSualPayload['sualTipi'],
      cavablar: ['NEZERI', 'DUSTUR', 'PRAKTIKI'].includes(tip)
        ? []
        : [
            { metn: '', duzgundur: false, sira: 0 },
            { metn: '', duzgundur: false, sira: 1 },
            { metn: '', duzgundur: false, sira: 2 },
            { metn: '', duzgundur: false, sira: 3 },
          ],
    }));
  };

  const handleSekil = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSualForm((prev) => ({ ...prev, sekil: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => setSualForm((prev) => ({ ...prev, sekil: reader.result as string }));
        reader.readAsDataURL(file);
      }
    }
  };

  const setCavabMetn = (i: number, metn: string) => {
    setSualForm((prev) => {
      const cavablar = [...(prev.cavablar ?? [])];
      cavablar[i] = { ...cavablar[i], metn };
      return { ...prev, cavablar };
    });
  };

  const setDuzgunCavab = (i: number) => {
    setSualForm((prev) => {
      const cavablar = (prev.cavablar ?? []).map((c, ci) => ({ ...c, duzgundur: ci === i }));
      return { ...prev, cavablar };
    });
  };

  const handleSualSave = async () => {
    setError(null);
    if (!sualForm.movzuId) return setError('Mövzu seçilməlidir');
    if (!sualForm.metn.trim()) return setError('Sual mətni tələb olunur');
    if (!isCavabsizTip) {
      const doldurulanlar = sualForm.cavablar?.filter((c) => c.metn.trim()) ?? [];
      if (doldurulanlar.length < 2) return setError('Ən az 2 cavab variantı daxil edilməlidir');
      if (!sualForm.cavablar?.some((c) => c.duzgundur)) return setError('Düzgün cavab seçilməlidir');
    }
    setSaving(true);
    try {
      await createSual({
        ...sualForm,
        cavablar: isCavabsizTip ? [] : sualForm.cavablar?.filter((c) => c.metn.trim()),
      });
      setSualForm({ ...DEFAULT_SUAL, testBankiId: bank.id });
      setShowSualForm(false);
      await loadSuallar();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSual = async (id: number) => {
    if (!window.confirm('Sualı silmək istəyirsiniz?')) return;
    await deleteSual(id);
    await loadSuallar();
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Test Bankı</p>
            <h3 className="text-lg font-bold text-slate-900">{bank.ad}</h3>
            <p className="text-xs text-slate-600">{bank.fenn.fennAdi} · {suallar.length} sual</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSualForm(true); setError(null); }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
            >
              + Sual əlavə et
            </button>
            <button onClick={onClose} className="text-slate-600 transition hover:text-slate-900">✕</button>
          </div>
        </div>

        {/* Sual əlavə formu */}
        {showSualForm && (
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
            <h4 className="mb-4 font-bold text-slate-900">Yeni Sual</h4>
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 border border-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* Mövzu */}
              <div className="col-span-3">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Mövzu</label>
                <select
                  value={sualForm.movzuId}
                  onChange={(e) => setSualForm((p) => ({ ...p, movzuId: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value={0}>Mövzu seçin</option>
                  {bankMovzular.map((m) => (
                    <option key={m.id} value={m.id}>{m.ad}</option>
                  ))}
                </select>
              </div>

              {/* Sual tipi */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Sual tipi</label>
                <select
                  value={sualForm.sualTipi}
                  onChange={(e) => handleTipChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                >
                  {SUAL_TIPLERI.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Çətinlik */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Çətinlik dərəcəsi</label>
                <select
                  value={sualForm.chetinlik}
                  onChange={(e) => setSualForm((p) => ({ ...p, chetinlik: e.target.value as CreateSualPayload['chetinlik'] }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                >
                  {CHETINLIK.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sual mətni — ctrl+v ilə şəkil dəstəyi */}
            <div className="mb-3">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Sual mətni <span className="text-slate-600 font-medium">(Ctrl+V ilə şəkil yapışdıra bilərsiniz)</span>
              </label>
              <textarea
                value={sualForm.metn}
                onChange={(e) => setSualForm((p) => ({ ...p, metn: e.target.value }))}
                onPaste={handlePaste}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 resize-none"
                placeholder="Sual mətnini daxil edin..."
              />
              {/* Şəkil önbaxış */}
              {sualForm.sekil && (
                <div className="relative mt-2 inline-block">
                  <img src={sualForm.sekil} alt="şəkil" className="max-h-40 rounded-lg border border-slate-200" />
                  <button
                    onClick={() => setSualForm((p) => ({ ...p, sekil: null }))}
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 p-0.5 text-xs text-white hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 text-xs font-medium text-blue-600 underline hover:text-blue-700"
              >
                Fayldan şəkil seç
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSekil} />
            </div>

            {/* Cavab variantları — yalnız TEST tipi */}
            {!isCavabsizTip && (
              <div className="mb-3">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Cavab variantları <span className="text-slate-600 font-medium">(düzgün cavabı seçin)</span>
                </label>
                <div className="space-y-2">
                  {(sualForm.cavablar ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDuzgunCavab(i)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                          c.duzgundur
                            ? 'bg-green-600 text-white'
                            : 'border border-slate-300 text-slate-700 hover:border-blue-500 hover:bg-blue-50'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                      <input
                        type="text"
                        value={c.metn}
                        onChange={(e) => setCavabMetn(i, e.target.value)}
                        placeholder={`${String.fromCharCode(65 + i)} variantı`}
                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isCavabsizTip && (
              <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 border border-blue-200">
                Bu sual tipinin cavab variantları olmur. Yalnız sual mətni daxil edilir.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSualSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 active:scale-95"
              >
                {saving ? 'Saxlanılır...' : 'Saxla'}
              </button>
              <button
                onClick={() => { setShowSualForm(false); setError(null); }}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                Ləğv et
              </button>
            </div>
          </div>
        )}

        {/* Mövcud suallar siyahısı */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingSuallar ? (
            <p className="text-center text-slate-600">Yüklənir...</p>
          ) : suallar.length === 0 ? (
            <p className="text-center text-slate-700">Hələ sual əlavə edilməyib</p>
          ) : (
            <div className="space-y-3">
              {suallar.map((s, i) => (
                <div key={s.id} className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                          {SUAL_TIPLERI.find((t) => t.value === s.sualTipi)?.label}
                        </span>
                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {CHETINLIK.find((c) => c.value === s.chetinlik)?.label}
                        </span>
                        <span className="text-xs text-slate-600">{s.movzu?.ad}</span>
                      </div>
                      <p className="text-sm text-slate-900 line-clamp-2">{s.metn}</p>
                      {s.sekil && (
                        <img src={s.sekil} alt="şəkil" className="mt-2 max-h-24 rounded-lg object-contain" />
                      )}
                      {s.cavablar && s.cavablar.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {s.cavablar.map((c, ci) => (
                            <span
                              key={c.id}
                              className={`rounded px-2 py-0.5 text-xs ${
                                c.duzgundur
                                  ? 'bg-green-50 text-green-800 border border-green-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {String.fromCharCode(65 + ci)}) {c.metn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSual(s.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-600 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ANA KOMPONENT
// ═══════════════════════════════════════════════════════════
const TestBankilarPage = () => {
  const [testBankilar, setTestBankilar] = useState<TestBanki[]>([]);
  const [fennler, setFennler] = useState<Fenn[]>([]);
  const [kafedralar, setKafedralar] = useState<Kafedra[]>([]);
  const [movzular, setMovzular] = useState<Movzu[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateTestBankiPayload>({
    ad: '',
    fennId: 0,
    kafedraId: 0,
    fennExternalId: '',
    kafedraExternalId: '',
  });

  // Panel state
  const [suallarPanel, setSuallarPanel] = useState<TestBanki | null>(null);
  const [baxisPanel, setBaxisPanel] = useState<{ bank: TestBanki; suallar: Sual[]; rejim: BaxisRejimi } | null>(null);

  // Redaktəyə göndər modal
  const [redakteModal, setRedakteModal] = useState<{ bankId: number } | null>(null);
  const [redakteQeyd, setRedakteQeyd] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Uğurlu mesajı 3 saniyə sonra gizlət
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bankilarData, fennlerData, kafedralarData, movzularData, userData] = await Promise.all([
        getTestBankilar(),
        getFennler(),
        getKafedralar(),
        getMovzular(),
        fetchCurrentUser(),
      ]);
      setTestBankilar(bankilarData);
      setFennler(fennlerData);
      setKafedralar(kafedralarData);
      setMovzular(movzularData);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.rol === 'ADMIN';
  const isKafedra = user?.rol === 'KAFEDRA';

  const handleCreateClick = () => {
    setFormMode('create');
    setFormData({
      ad: '',
      fennId: 0,
      kafedraId: isKafedra ? (user?.kafedra?.id ?? 0) : 0,
      fennExternalId: '',
      kafedraExternalId: '',
    });
    setSelectedId(null);
    setShowForm(true);
    setError(null);
  };

  const handleEditClick = (bank: TestBanki) => {
    setFormMode('edit');
    setFormData({
      ad: bank.ad,
      fennId: bank.fennId,
      kafedraId: bank.kafedraId,
      fennExternalId: '',
      kafedraExternalId: '',
    });
    setSelectedId(bank.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.ad || !formData.fennId) return setError('Ad və Fənn tələb olunur');
    if (isAdmin && !formData.kafedraId && !formData.kafedraExternalId) return setError('Kafedra seçilməlidir');
    try {
      if (formMode === 'create') {
        await createTestBanki({
          ...formData,
          fennId: formData.fennId || undefined,
          kafedraId: formData.kafedraId || undefined,
        });
        setSuccess('Test Bankı yaradıldı');
      } else if (selectedId) {
        await updateTestBanki(selectedId, {
          ...formData,
          fennId: formData.fennId || undefined,
          kafedraId: formData.kafedraId || undefined,
        });
        setSuccess('Test Bankı yeniləndi');
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat uğursuz oldu');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Test Bankını silmək istədiniz?')) return;
    try {
      await deleteTestBanki(id);
      setSuccess('Test Bankı silindi');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silmə uğursuz oldu');
    }
  };

  const handleTesdiqle = async (id: number) => {
    try { await tesdiqle(id); setSuccess('Test bankı təsdiqləndi'); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Xəta'); }
  };

  const handleTesdiqdenQaldir = async (id: number) => {
    try { await tesdiqdenQaldir(id); setSuccess('Təsdiq qaldırıldı'); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Xəta'); }
  };

  const handleRedakteSubmit = async () => {
    if (!redakteModal) return;
    try {
      await redakyeyeGonder(redakteModal.bankId, redakteQeyd);
      setSuccess('Redaktəyə göndərildi');
      setRedakteModal(null);
      setRedakteQeyd('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta');
    }
  };

  const handleBlokToggle = async (id: number) => {
    try { await blokToggle(id); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Xəta'); }
  };

  const handleBaxis = async (bank: TestBanki, rejim: BaxisRejimi) => {
    try {
      let suallar: Sual[] = [];
      if (rejim === 'umumi') suallar = await umumiBaxis(bank.id);
      else if (rejim === 'cavabsiz') suallar = await cavabsizBaxis(bank.id);
      else if (rejim === 'dogru_cavabsiz') suallar = await dogruCavabsizBaxis(bank.id);
      setBaxisPanel({ bank, suallar, rejim });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Başlıq */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistem İdarəetməsi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Test Bankları</h1>
        </div>
        {(isAdmin || isKafedra) && !showForm && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-sm hover:shadow active:scale-95"
          >
            + Yeni Test Bankı
          </button>
        )}
      </div>

      {/* Bildirişlər */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm">
          {success}
        </div>
      )}

      {/* Yaratma/redaktə formu */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            {formMode === 'create' ? '✨ Yeni Test Bankı' : '📝 Test Bankını Düzəlt'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Test Bankı Adı</label>
              <input
                type="text"
                value={formData.ad}
                onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                placeholder="Test bankının adını daxil edin"
                required
              />
            </div>
            <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fənn</label>
                <select
                  value={formData.fennId || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, fennId: Number(e.target.value), fennExternalId: '' });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">Fənn seçin</option>
                  {fennler.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fennAdi} ({f.fennKodu}){f.source === 'ETS' ? ' [ETS]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Kafedra</label>
                  <select
                    value={formData.kafedraId || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, kafedraId: Number(e.target.value), kafedraExternalId: '' });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="">Kafedra seçin</option>
                    {kafedralar.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ad}{k.source === 'ETS' ? ' [ETS]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                {formMode === 'create' ? 'Yarat' : 'Güncəllə'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                Ləğv et
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cədvəl */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm font-medium text-slate-500">Məlumatlar yüklənir...</div>
      ) : testBankilar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-medium text-slate-500">
          Hələ test bankı əlavə edilməyib. Yeni test bankı yaratmaq üçün yuxarıdakı düyməni basın.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">#</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Ad</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Fənn</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Kafedra</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Əlavə edən</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Sual sayı</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Blok</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {testBankilar.map((bank, idx) => (
                  <tr
                    key={bank.id}
                    className="transition hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm font-semibold text-slate-900">{idx + 1}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm font-semibold text-slate-900">{bank.ad}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm text-slate-600">
                      <span>{bank.fenn.fennAdi}</span>
                      <span className="ml-1.5 text-xs text-slate-500">({bank.fenn.fennKodu})</span>
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm text-slate-600">{bank.kafedra.ad}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm text-slate-600">
                      {bank.elavEden.ad} {bank.elavEden.soyad}
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm text-center">
                      <button
                        onClick={() => setSuallarPanel(bank)}
                        className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 hover:text-blue-600 border border-slate-200"
                      >
                        {bank._count?.suallar ?? 0}
                      </button>
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColor(bank.status)}`}>
                        {statusLabel(bank.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${blokColor(bank.blok)}`}>
                        {bank.blok === 'ACIQDIR' ? 'Açıqdır' : 'Bağlıdır'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-right">
                    <ActionMenu
                      bank={bank}
                      isAdmin={isAdmin}
                      isKafedra={isKafedra}
                      onEdit={() => handleEditClick(bank)}
                      onDelete={() => handleDelete(bank.id)}
                      onTesdiqle={() => handleTesdiqle(bank.id)}
                      onTesdiqdenQaldir={() => handleTesdiqdenQaldir(bank.id)}
                      onRedakteye={() => { setRedakteModal({ bankId: bank.id }); setRedakteQeyd(''); }}
                      onBlokToggle={() => handleBlokToggle(bank.id)}
                      onSuallar={() => setSuallarPanel(bank)}
                      onUmumiBaxis={() => handleBaxis(bank, 'umumi')}
                      onCavabsizBaxis={() => handleBaxis(bank, 'cavabsiz')}
                      onDogruCavabsizBaxis={() => handleBaxis(bank, 'dogru_cavabsiz')}
                    />
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suallar paneli (əlavə etmə + siyahı) */}
      {suallarPanel && (
        <SualElavePaneli
          bank={suallarPanel}
          movzular={movzular}
          onClose={() => setSuallarPanel(null)}
          onRefresh={loadData}
        />
      )}

      {/* Baxış paneli */}
      {baxisPanel && (
        <SualBaxisPanel
          suallar={baxisPanel.suallar}
          rejim={baxisPanel.rejim}
          bankAd={baxisPanel.bank.ad}
          onClose={() => setBaxisPanel(null)}
        />
      )}

      {/* Redaktəyə göndər modalı */}
      {redakteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Redaktəyə göndər</h3>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Qeyd (opsional)</label>
            <textarea
              value={redakteQeyd}
              onChange={(e) => setRedakteQeyd(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 resize-none"
              placeholder="Redaktə üçün qeyd əlavə edin..."
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleRedakteSubmit}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                Göndər
              </button>
              <button
                onClick={() => setRedakteModal(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                Ləğv et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestBankilarPage;