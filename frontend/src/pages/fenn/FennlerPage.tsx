import { useEffect, useState, useMemo } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../../services/auth';
import { getKafedralar, type Kafedra } from '../../services/kafedra';
import {
  getFennler,
  createFenn,
  updateFenn,
  deleteFenn,
  type Fenn,
  type CreateFennPayload,
} from '../../services/fenn';

const FennlerPage = () => {
  const [fennler, setFennler] = useState<Fenn[]>([]);
  const [kafedralar, setKafedralar] = useState<Kafedra[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtrasiya üçün state-lər
  const [searchTerm, setSearchTerm] = useState('');
  const [langFilter, setLangFilter] = useState<'ALL' | 'AZ' | 'RU' | 'EN'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'ETS' | 'MANUAL'>('ALL');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateFennPayload>({
    kafedraId: 0,
    fennKodu: '',
    fennAdi: '',
    bolme: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fennlerData, kafedralarData, userData] = await Promise.all([
        getFennler(),
        getKafedralar(),
        fetchCurrentUser(),
      ]);
      setFennler(fennlerData);
      setKafedralar(kafedralarData);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.rol === 'ADMIN';

  // Dinamik Filtrasiya Məntiqi (useMemo ilə optimizasiya olunub)
  const filteredFennler = useMemo(() => {
    return fennler.filter((fenn) => {
      const matchesSearch =
        fenn.fennAdi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fenn.fennKodu.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLang = langFilter === 'ALL' || fenn.bolme === langFilter;

      const matchesSource =
        sourceFilter === 'ALL' ||
        (sourceFilter === 'ETS' && fenn.source === 'ETS') ||
        (sourceFilter === 'MANUAL' && fenn.source !== 'ETS');

      return matchesSearch && matchesLang && matchesSource;
    });
  }, [fennler, searchTerm, langFilter, sourceFilter]);

  // Statistika Hesablamaları
  const stats = useMemo(() => {
    return {
      total: fennler.length,
      azCount: fennler.filter((f) => f.bolme === 'AZ').length,
      ruCount: fennler.filter((f) => f.bolme === 'RU').length,
      enCount: fennler.filter((f) => f.bolme === 'EN').length,
      filteredCount: filteredFennler.length,
    };
  }, [fennler, filteredFennler]);

  const handleCreateClick = () => {
    setFormMode('create');
    setFormData({
      kafedraId: 0,
      fennKodu: '',
      fennAdi: '',
      bolme: '',
    });
    setSelectedId(null);
    setShowForm(true);
  };

  const handleEditClick = (fenn: Fenn) => {
    setFormMode('edit');
    setFormData({
      kafedraId: fenn.kafedraId,
      fennKodu: fenn.fennKodu,
      fennAdi: fenn.fennAdi,
      bolme: fenn.bolme,
    });
    setSelectedId(fenn.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.kafedraId || !formData.fennKodu || !formData.fennAdi || !formData.bolme) {
      setError('Bütün sahələr tələb olunur');
      return;
    }

    try {
      if (formMode === 'create') {
        await createFenn(formData);
        setSuccess('Fənn uğurla yaradıldı');
      } else if (selectedId) {
        await updateFenn(selectedId, formData);
        setSuccess('Fənn uğurla güncəlləndi');
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat uğursuz oldu');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Fənni silmək istədiyinizdən əminsiniz?')) return;

    try {
      await deleteFenn(id);
      setSuccess('Fənn silindi');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silmə uğursuz oldu');
    }
  };

  // Dillər üçün rəng nişanları (badge) funksiyası
  const getLangBadge = (lang: string) => {
    switch (lang) {
      case 'AZ':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RU':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'EN':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlıq Sahəsi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistem İdarəetməsi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Fənlər</h1>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-sm hover:shadow active:scale-95"
          >
            + Yeni Fənn
          </button>
        )}
      </div>

      {/* SAYĞACLAR / STATİSTİKA PANELLƏRİ */}
      {!loading && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ümumi Fənlər</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Azərbaycan bölməsi</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{stats.azCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">Rus bölməsi</p>
            <p className="mt-2 text-3xl font-bold text-purple-600">{stats.ruCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">İngilis bölməsi</p>
            <p className="mt-2 text-3xl font-bold text-indigo-600">{stats.enCount}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Tapılan Nəticə</p>
            <p className="mt-2 text-3xl font-bold text-blue-800">{stats.filteredCount}</p>
          </div>
        </div>
      )}

      {/* Bildirişlər */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm">{success}</div>}

      {/* Forma Kartı */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-3xl">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            {formMode === 'create' ? '✨ Yeni Fənn Əlavə Edilməsi' : '📝 Fənn Məlumatlarının Düzəldilməsi'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Kafedra</label>
                <select
                  value={formData.kafedraId}
                  onChange={(e) => setFormData({ ...formData, kafedraId: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  required
                >
                  <option value={0}>Kafedra seçin</option>
                  {kafedralar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Bölmə (Dil)</label>
                <select
                  value={formData.bolme}
                  onChange={(e) => setFormData({ ...formData, bolme: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  required
                >
                  <option value="">Bölmə seçin</option>
                  <option value="AZ">Azərbaycanca</option>
                  <option value="RU">Rusça</option>
                  <option value="EN">İngiliscə</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Fənn Adı</label>
                <input
                  type="text"
                  value={formData.fennAdi}
                  onChange={(e) => setFormData({ ...formData, fennAdi: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. Diferensial Tənliklər"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Fənn Kodu</label>
                <input
                  type="text"
                  value={formData.fennKodu}
                  onChange={(e) => setFormData({ ...formData, fennKodu: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. MATH201"
                  required
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95">
                {formMode === 'create' ? 'Yarat' : 'Güncəllə'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95">
                Ləğv et
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FİLTR VƏ AXTARIŞ PANELİ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Fənn adı və ya koda görə axtar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Dil Bölməsi Filtri */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bölmə:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(['ALL', 'AZ', 'RU', 'EN'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLangFilter(lang)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${langFilter === lang ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {lang === 'ALL' ? 'Hamısı' : lang}
                </button>
              ))}
            </div>
          </div>

          {/* Mənbə Filtri */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mənbə:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setSourceFilter('ALL')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${sourceFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hamısı
              </button>
              <button
                onClick={() => setSourceFilter('ETS')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${sourceFilter === 'ETS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ETS
              </button>
              <button
                onClick={() => setSourceFilter('MANUAL')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${sourceFilter === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Əl ilə
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cədvəl Sahəsi */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm font-medium text-slate-500">Məlumatlar yüklənir...</div>
      ) : filteredFennler.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-medium text-slate-500">
          Axtarış meyarlarına uyğun fənn tapılmadı.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Fənn Adı</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Kodu</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Kafedra</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Bölmə</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Əlavə Edən</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Mövzular</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Test Bankları</th>
                  {isAdmin && <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Əməliyyatlar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFennler.map((fenn) => (
                  <tr key={fenn.id} className="transition hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{fenn.fennAdi}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium font-mono text-slate-700">
                        {fenn.fennKodu}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{fenn.kafedra.ad}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-center">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${getLangBadge(fenn.bolme)}`}>
                        {fenn.bolme}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {fenn.istifadeci.ad} {fenn.istifadeci.soyad}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 text-center font-medium">{fenn._count?.movzular || 0}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 text-center font-medium">{fenn._count?.testBanki || 0}</td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {fenn.source === 'ETS' ? (
                          <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                            ETS Sistem
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(fenn)}
                              className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 border border-slate-200"
                            >
                              Düzəlt
                            </button>
                            <button
                              onClick={() => handleDelete(fenn.id)}
                              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 border border-red-100"
                            >
                              Sil
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FennlerPage;