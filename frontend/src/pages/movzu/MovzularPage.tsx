import { useEffect, useState, useMemo } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../../services/auth';
import { getFennler, type Fenn } from '../../services/fenn';
import {
  getMovzular,
  createMovzu,
  updateMovzu,
  deleteMovzu,
  type Movzu,
  type CreateMovzuPayload,
} from '../../services/movzu';

const MovzularPage = () => {
  const [movzular, setMovzular] = useState<Movzu[]>([]);
  const [fennler, setFennler] = useState<Fenn[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Axtarış və Filtrasiya state-ləri
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFennId, setFilterFennId] = useState<number>(0);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateMovzuPayload>({
    fennId: 0,
    ad: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadMovzular();
  }, [filterFennId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fennlerData, userData] = await Promise.all([
        getFennler(),
        fetchCurrentUser(),
      ]);

      setFennler(fennlerData);
      setUser(userData);
      await loadMovzular();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  const loadMovzular = async () => {
    try {
      const data = await getMovzular(filterFennId || undefined);
      setMovzular(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mövzular yüklənərkən xəta');
    }
  };

  const isAdmin = user?.rol === 'ADMIN';

  // Real-time Mətn Axtarışı (Fənn adına, koduna və mövzu adına görə)
  const filteredMovzular = useMemo(() => {
    return movzular.filter((movzu) => {
      const query = searchTerm.toLowerCase();
      return (
        movzu.ad.toLowerCase().includes(query) ||
        movzu.fenn.fennAdi.toLowerCase().includes(query) ||
        movzu.fenn.fennKodu.toLowerCase().includes(query)
      );
    });
  }, [movzular, searchTerm]);

  // Statistika Hesablamaları
  const stats = useMemo(() => {
    return {
      totalMovzu: movzular.length,
      filteredCount: filteredMovzular.length,
      totalSuallar: movzular.reduce((sum, item) => sum + (item._count?.suallar || 0), 0),
    };
  }, [movzular, filteredMovzular]);

  const handleCreateClick = () => {
    setFormMode('create');
    setFormData({
      fennId: fennler.filter((f) => f.source !== 'ETS')[0]?.id ?? fennler[0]?.id ?? 0,
      ad: '',
    });
    setSelectedId(null);
    setShowForm(true);
  };

  const handleEditClick = (movzu: Movzu) => {
    setFormMode('edit');
    setFormData({
      fennId: movzu.fennId,
      ad: movzu.ad,
    });
    setSelectedId(movzu.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.fennId || !formData.ad.trim()) {
      setError('Fənn və ad tələb olunur');
      return;
    }

    try {
      if (formMode === 'create') {
        await createMovzu(formData);
        setSuccess('Mövzu uğurla yaradıldı');
      } else if (selectedId) {
        await updateMovzu(selectedId, formData);
        setSuccess('Mövzu uğurla güncəlləndi');
      }
      setShowForm(false);
      await loadMovzular();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat uğursuz oldu');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Mövzunu silmək istədiyinizdən əminsiniz?')) return;

    try {
      await deleteMovzu(id);
      setSuccess('Mövzu silindi');
      await loadMovzular();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silmə uğursuz oldu');
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlıq paneli */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistem İdarəetməsi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Mövzular</h1>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-sm hover:shadow active:scale-95"
          >
            + Yeni Mövzu
          </button>
        )}
      </div>

      {/* STATİSTİKA VƏ SAYĞACLAR */}
      {!loading && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cəmi Mövzular</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalMovzu}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ümumi Sual Sayı</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalSuallar}</p>
          </div>
        </div>
      )}

      {/* Bildiriş Mesajları */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm">{success}</div>}

      {/* Forma Kartı */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            {formMode === 'create' ? '✨ Yeni Mövzu Əlavə Edilməsi' : '📝 Mövzu Məlumatlarının Düzəldilməsi'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Fənn</label>
              <select
                value={formData.fennId}
                onChange={(e) => setFormData({ ...formData, fennId: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                required
              >
                <option value={0}>Fənn seçin</option>
                {fennler
                  .filter((f) => f.source !== 'ETS')
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fennAdi} ({f.fennKodu})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Mövzu Adı</label>
              <input
                type="text"
                value={formData.ad}
                onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                placeholder="Məs. Matrislər və onlar üzərində əməllər"
                required
              />
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Mövzu, fənn adı və ya koda görə axtar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs font-semibold text-slate-400 uppercase tracking-wider">Fənn Süzgəci:</span>
          <select
            value={filterFennId}
            onChange={(e) => setFilterFennId(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 min-w-[200px]"
          >
            <option value={0}>Bütün Fənlər</option>
            {fennler.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fennAdi} ({f.fennKodu})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Siyahı Cədvəli */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm font-medium text-slate-500">Məlumatlar yüklənir...</div>
      ) : filteredMovzular.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-medium text-slate-500">
          Uğun gələn hər hansı bir mövzu tapılmadı.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Mövzu Adı</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Fənn</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Fənn Kodu</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Suallar</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Yaradılma Tarixi</th>
                  {isAdmin && <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Əməliyyatlar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovzular.map((movzu) => (
                  <tr key={movzu.id} className="transition hover:bg-slate-50/50">
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm font-semibold text-slate-900">{movzu.ad}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{movzu.fenn.fennAdi}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium font-mono text-slate-700">
                        {movzu.fenn.fennKodu}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-center font-semibold text-slate-700">
                      {movzu._count?.suallar || 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-center text-slate-500">
                      {isNaN(Date.parse(movzu.yaradildi)) ? '---' : new Date(movzu.yaradildi).toLocaleDateString('az-AZ')}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {movzu.source === 'ETS' ? (
                          <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                            ETS Sistem
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(movzu)}
                              className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 border border-slate-200"
                            >
                              Düzəlt
                            </button>
                            <button
                              onClick={() => handleDelete(movzu.id)}
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

export default MovzularPage;