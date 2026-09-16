import { useEffect, useState, useMemo } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../../services/auth';
import {
  getKafedralar,
  createKafedra,
  updateKafedra,
  deleteKafedra,
  type Kafedra,
  type CreateKafedraPayload,
} from '../../services/kafedra';

const KafedralarPage = () => {
  const [kafedralar, setKafedralar] = useState<Kafedra[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtrasiya üçün state-lər
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'ETS' | 'MANUAL'>('ALL');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateKafedraPayload>({ ad: '', kod: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kafedralarData, userData] = await Promise.all([
        getKafedralar(),
        fetchCurrentUser(),
      ]);
      setKafedralar(kafedralarData);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.rol === 'ADMIN';

  // Filtrasiya məntiqi (useMemo ilə performans optimizasiyası)
  const filteredKafedralar = useMemo(() => {
    return kafedralar.filter((kafedra) => {
      const matchesSearch =
        kafedra.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kafedra.kod.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSource =
        sourceFilter === 'ALL' ||
        (sourceFilter === 'ETS' && kafedra.source === 'ETS') ||
        (sourceFilter === 'MANUAL' && kafedra.source !== 'ETS');

      return matchesSearch && matchesSource;
    });
  }, [kafedralar, searchTerm, sourceFilter]);

  // Statistika Hesablamaları
  const stats = useMemo(() => {
    return {
      total: kafedralar.length,
      etsCount: kafedralar.filter(k => k.source === 'ETS').length,
      manualCount: kafedralar.filter(k => k.source !== 'ETS').length,
      filteredCount: filteredKafedralar.length
    };
  }, [kafedralar, filteredKafedralar]);

  const handleCreateClick = () => {
    setFormMode('create');
    setFormData({ ad: '', kod: '' });
    setSelectedId(null);
    setShowForm(true);
  };

  const handleEditClick = (kafedra: Kafedra) => {
    setFormMode('edit');
    setFormData({ ad: kafedra.ad, kod: kafedra.kod });
    setSelectedId(kafedra.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (formMode === 'create') {
        await createKafedra(formData);
        setSuccess('Kafedra uğurla yaradıldı');
      } else if (selectedId) {
        await updateKafedra(selectedId, formData);
        setSuccess('Kafedra uğurla güncəlləndi');
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat uğursuz oldu');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Kafedranı silmək istədiyinizdən əminsiniz?')) return;

    try {
      await deleteKafedra(id);
      setSuccess('Kafedra silindi');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silmə uğursuz oldu');
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlıq Sahəsi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistem İdarəetməsi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Kafedralar</h1>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-sm hover:shadow active:scale-95"
          >
            + Yeni Kafedra
          </button>
        )}
      </div>

      {/* SAYĞACLAR / STATİSTİKA PANELLƏRİ */}
      {!loading && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ümumi Kafedralar</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">ETS Sistem</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{stats.etsCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Manual Yaradılan</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.manualCount}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            {formMode === 'create' ? '✨ Yeni Kafedra Yaradılması' : '📝 Kafedra Məlumatlarının Düzəldilməsi'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Kafedra Adı</label>
                <input
                  type="text"
                  value={formData.ad}
                  onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. İnformatika"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Kafedra Kodu</label>
                <input
                  type="text"
                  value={formData.kod}
                  onChange={(e) => setFormData({ ...formData, kod: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. INF01"
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Kafedra adı və ya koda görə axtar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:inline">Mənbə:</span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setSourceFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${sourceFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Hamısı
            </button>
            <button
              onClick={() => setSourceFilter('ETS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${sourceFilter === 'ETS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              ETS
            </button>
            <button
              onClick={() => setSourceFilter('MANUAL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${sourceFilter === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Əl ilə
            </button>
          </div>
        </div>
      </div>

      {/* Cədvəl Sahəsi */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm font-medium text-slate-500">Məlumatlar yüklənir...</div>
      ) : filteredKafedralar.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-medium text-slate-500">
          Axtarışa uyğun heç bir kafedra tapılmadı.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Kafedra Adı</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Kodu</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Fənlər</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">İstifadəçilər</th>
                  {isAdmin && <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Əməliyyatlar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKafedralar.map((kafedra) => (
                  <tr key={kafedra.id} className="transition hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">{kafedra.ad}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium font-mono text-slate-700">
                        {kafedra.kod}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 text-center font-medium">{kafedra._count?.fennler || 0}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600 text-center font-medium">{kafedra._count?.istifadeci || 0}</td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {kafedra.source === 'ETS' ? (
                          <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                            ETS Sistem
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(kafedra)}
                              className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 border border-slate-200"
                            >
                              Düzəlt
                            </button>
                            <button
                              onClick={() => handleDelete(kafedra.id)}
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

export default KafedralarPage;