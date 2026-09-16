import { useEffect, useState, useMemo } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../../services/auth';
import { getKafedralar, type Kafedra } from '../../services/kafedra';
import { getFennler, type Fenn } from '../../services/fenn';
import {
  getIstifadeciler,
  createIstifadeci,
  updateIstifadeci,
  deleteIstifadeci,
  type Istifadeci,
  type CreateIstifadeciPayload,
  type UpdateIstifadeciPayload,
} from '../../services/istifadeci';

const ROLLAR = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'KAFEDRA', label: 'Kafedra' },
  { value: 'MUELLIM', label: 'Müəllim' },
] as const;

const IstifadecilerPage = () => {
  const [istifadeciler, setIstifadeciler] = useState<Istifadeci[]>([]);
  const [kafedralar, setKafedralar] = useState<Kafedra[]>([]);
  const [fennler, setFennler] = useState<Fenn[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtrasiya üçün state-lər
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'KAFEDRA' | 'MUELLIM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AKTIV' | 'DEAKTIV'>('ALL');

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateIstifadeciPayload>({
    ad: '',
    soyad: '',
    username: '',
    parol: '',
    rol: 'ADMIN',
    kafedraId: undefined,
    fennIds: [],
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      if (currentUser.rol !== 'ADMIN') return;
      const [usersData, kafedralarData, fennlerData] = await Promise.all([
        getIstifadeciler(),
        getKafedralar(),
        getFennler(),
      ]);
      setIstifadeciler(usersData);
      setKafedralar(kafedralarData);
      setFennler(fennlerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.rol === 'ADMIN';

  // Dinamik Filtrasiya Məntiqi (useMemo optimizasiyası ilə)
  const filteredIstifadeciler = useMemo(() => {
    return istifadeciler.filter((ist) => {
      const searchString = `${ist.ad} ${ist.soyad} ${ist.username}`.toLowerCase();
      const matchesSearch = searchString.includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'ALL' || ist.rol === roleFilter;
      
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'AKTIV' && ist.aktiv) ||
        (statusFilter === 'DEAKTIV' && !ist.aktiv);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [istifadeciler, searchTerm, roleFilter, statusFilter]);

  // Sayğaclar / Statistika Hesablamaları
  const stats = useMemo(() => {
    return {
      total: istifadeciler.length,
      admins: istifadeciler.filter((i) => i.rol === 'ADMIN').length,
      kafedra: istifadeciler.filter((i) => i.rol === 'KAFEDRA').length,
      muellim: istifadeciler.filter((i) => i.rol === 'MUELLIM').length,
      aktiv: istifadeciler.filter((i) => i.aktiv).length,
    };
  }, [istifadeciler]);

  const handleCreateClick = () => {
    setFormMode('create');
    setFormData({ ad: '', soyad: '', username: '', parol: '', rol: 'ADMIN', kafedraId: undefined, fennIds: [] });
    setSelectedId(null);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleEditClick = (ist: Istifadeci) => {
    setFormMode('edit');
    setFormData({
      ad: ist.ad,
      soyad: ist.soyad,
      username: ist.username,
      parol: '',
      rol: ist.rol as CreateIstifadeciPayload['rol'],
      kafedraId: ist.kafedra?.id ?? undefined,
      fennIds: ist.muellimFennler?.map((item) => item.fenn.id) ?? [],
    });
    setSelectedId(ist.id);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.ad.trim() || !formData.soyad.trim() || !formData.username.trim() || (formMode === 'create' && !formData.parol)) {
      setError('Ad, soyad, istifadəçi adı (username) və parol tələb olunur');
      return;
    }

    if ((formData.rol === 'KAFEDRA' || formData.rol === 'MUELLIM') && !formData.kafedraId) {
      setError('Zəhmət olmasa, əlaqəli kafedranı seçin');
      return;
    }

    try {
      if (formMode === 'create') {
        await createIstifadeci(formData);
        setSuccess('İstifadəçi uğurla yaradıldı');
      } else if (selectedId) {
        const updateData: UpdateIstifadeciPayload = {
          ad: formData.ad,
          soyad: formData.soyad,
          username: formData.username,
          ...(formData.parol ? { parol: formData.parol } : {}),
          kafedraId: formData.kafedraId ?? null,
          fennIds: formData.rol === 'MUELLIM' ? formData.fennIds : [],
        };
        await updateIstifadeci(selectedId, updateData);
        setSuccess('İstifadəçi məlumatları yeniləndi');
      }
      setShowForm(false);
      await loadUserData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat uğursuz oldu');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('İstifadəçini deaktiv etmək istədiyinizdən əminsiniz?')) return;
    try {
      await deleteIstifadeci(id);
      setSuccess('İstifadəçi statusu deaktiv edildi');
      await loadUserData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Əməliyyat uğursuz oldu');
    }
  };

  // Rol nişanları (badge) üçün üslub funksiyası
  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case 'ADMIN':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'KAFEDRA':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'MUELLIM':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm font-medium text-slate-500">Məlumatlar yüklənir...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Giriş Məhdudiyyəti</h1>
        <p className="mt-2 text-sm text-slate-500">Bu səhifədəki tənzimləmələr və siyahılar yalnız sistem idarəçiləri (ADMIN) üçün əlçatandır.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlıq və Əməliyyat Düyməsi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistem İdarəetməsi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">İstifadəçilər</h1>
        </div>
        {!showForm && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 shadow-sm hover:shadow active:scale-95"
          >
            + Yeni İstifadəçi
          </button>
        )}
      </div>

      {/* STATİSTİKA PANERLƏRİ */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cəmi Hesablar</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Admin</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{stats.admins}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Kafedra</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{stats.kafedra}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-teal-600 uppercase tracking-wider">Müəllim</p>
          <p className="mt-2 text-3xl font-bold text-teal-600">{stats.muellim}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Aktiv Səlahiyyətli</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.aktiv}</p>
        </div>
      </div>

      {/* Bildirişlər */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm">{success}</div>}

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-4xl">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            {formMode === 'create' ? '✨ Yeni İstifadəçi Profilinin Qurulması' : '📝 Səlahiyyət və Hesab Düzəlişləri'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Ad</label>
                <input
                  type="text"
                  value={formData.ad}
                  onChange={(e) => setFormData({ ...formData, ad: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. Elnur"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Soyad</label>
                <input
                  type="text"
                  value={formData.soyad}
                  onChange={(e) => setFormData({ ...formData, soyad: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. Məmmədov"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">İstifadəçi Adı (Username)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="Məs. elnur_m"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Parol {formMode === 'edit' ? <span className="text-xs font-normal text-slate-400">(Yalnız dəyişmək istədikdə yazın)</span> : ''}
                </label>
                <input
                  type="password"
                  value={formData.parol}
                  onChange={(e) => setFormData({ ...formData, parol: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  placeholder="••••••••"
                  {... (formMode === 'create' ? { required: true } : {})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Rol Səlahiyyəti</label>
                <select
                  value={formData.rol}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rol: e.target.value as CreateIstifadeciPayload['rol'],
                      fennIds: e.target.value === 'MUELLIM' ? formData.fennIds : [],
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                >
                  {ROLLAR.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              {(formData.rol === 'KAFEDRA' || formData.rol === 'MUELLIM') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Aid Olduğu Kafedra</label>
                  <select
                    value={formData.kafedraId ?? ''}
                    onChange={(e) => setFormData({ ...formData, kafedraId: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    required
                  >
                    <option value="">Kafedra seçin</option>
                    {kafedralar.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {formData.rol === 'MUELLIM' && (
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Təhkim Olunmuş Fənlər <span className="text-xs font-normal text-slate-400">(Birdən çox seçim üçün Ctrl və ya Cmd düyməsini sıxıb saxlayın)</span></label>
                <select
                  multiple
                  value={(formData.fennIds ?? []).map(String)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fennIds: Array.from(e.target.selectedOptions, (option) => Number(option.value)),
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  size={Math.min(6, fennler.length || 4)}
                >
                  {fennler.map((f) => (
                    <option key={f.id} value={f.id} className="p-1.5 rounded-lg my-0.5">
                      {f.fennAdi} ({f.fennKodu})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95">
                {formMode === 'create' ? 'Yarat' : 'Yadda Saxla'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95">
                Ləğv et
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FİLTR VƏ AXTARIŞ PANELİ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Ad, soyad və ya istifadəçi adına görə axtar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Rol Filtri */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${roleFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hamısı
              </button>
              <button
                onClick={() => setRoleFilter('ADMIN')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${roleFilter === 'ADMIN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Admin
              </button>
              <button
                onClick={() => setRoleFilter('KAFEDRA')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${roleFilter === 'KAFEDRA' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Kafedra
              </button>
              <button
                onClick={() => setRoleFilter('MUELLIM')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${roleFilter === 'MUELLIM' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Müəllim
              </button>
            </div>
          </div>

          {/* Status Filtri */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${statusFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hamısı
              </button>
              <button
                onClick={() => setStatusFilter('AKTIV')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${statusFilter === 'AKTIV' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Aktiv
              </button>
              <button
                onClick={() => setStatusFilter('DEAKTIV')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${statusFilter === 'DEAKTIV' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Deaktiv
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Siyahı Cədvəli */}
      {filteredIstifadeciler.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-medium text-slate-500">
          Axtarış meyarlarına uyğun hər hansı bir istifadəçi profili tapılmadı.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">İstifadəçi</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Username</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Səlahiyyət (Rol)</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Kafedra</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500">Təhkim Olunan Fənlər</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Status</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Yaradılma</th>
                  <th className="px-6 py-3 border border-gray-300 dark:border-gray-600.5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIstifadeciler.map((ist) => (
                  <tr key={ist.id} className="transition hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                      {ist.ad} {ist.soyad}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-slate-600">
                      @{ist.username}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${getRoleBadge(ist.rol)}`}>
                        {ist.rol}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {ist.kafedra?.ad ?? <span className="text-slate-400 font-light">-</span>}
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-sm text-slate-600 max-w-xs truncate" title={ist.muellimFennler.map((item) => item.fenn.fennAdi).join(', ')}>
                      {ist.muellimFennler.map((item) => item.fenn.fennAdi).join(', ') || <span className="text-slate-400 font-light">-</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ist.aktiv ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {ist.aktiv ? 'Aktiv' : 'Deaktiv'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-center text-slate-500">
                      {new Date(ist.yaradildi).toLocaleDateString('az-AZ')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleEditClick(ist)}
                          className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 border border-slate-200"
                        >
                          Düzəlt
                        </button>
                        {ist.aktiv && (
                          <button
                            onClick={() => handleDelete(ist.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 border border-red-100"
                          >
                            Deaktiv et
                          </button>
                        )}
                      </div>
                    </td>
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

export default IstifadecilerPage;