import { useEffect, useState, useMemo } from 'react';
import { getMuellimler, type Muellim } from '../../services/muellim';

const Teachers = () => {
  const [muellimler, setMuellimler] = useState<Muellim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtrasiya üçün state-lər
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | number>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const muellimlerData = await getMuellimler();
      setMuellimler(muellimlerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Məlumatlar yüklənərkən xəta');
    } finally {
      setLoading(false);
    }
  };

  // Unikal kafedralar siyahısı
  const uniqueDepartments = useMemo(() => {
    const depts = new Map<number, { id: number; name: string }>();
    muellimler.forEach((m) => {
      if (m.department && m.departmentId) {
        depts.set(m.departmentId, { id: m.departmentId, name: m.department.name });
      }
    });
    return Array.from(depts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [muellimler]);

  // Dinamik Filtrasiya Məntiqi
  const filteredMuellimler = useMemo(() => {
    return muellimler.filter((muellim) => {
      const matchesSearch =
        muellim.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        muellim.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        muellim.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        muellim.pin.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || muellim.status === statusFilter;

      const matchesDepartment =
        departmentFilter === 'ALL' || muellim.departmentId === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [muellimler, searchTerm, statusFilter, departmentFilter]);

  // Statistika
  const stats = useMemo(() => {
    return {
      total: muellimler.length,
      active: muellimler.filter((m) => m.status === 'ACTIVE').length,
      inactive: muellimler.filter((m) => m.status === 'INACTIVE').length,
      filtered: filteredMuellimler.length,
    };
  }, [muellimler, filteredMuellimler]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlıq Sahəsi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistem İdarəetməsi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Müəllimlər</h1>
        </div>
      </div>

      {/* ERROR/SUCCESS Mesajları */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* SAYĞACLAR / STATİSTİKA PANELLƏRİ */}
      {!loading && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ümumi Müəllimlər</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aktiv</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pasiv</p>
            <p className="mt-2 text-3xl font-bold text-red-600">{stats.inactive}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nəticə</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{stats.filtered}</p>
          </div>
        </div>
      )}

      {/* FİLTRLƏR */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Axtarış */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Axtarış</label>
            <input
              type="text"
              placeholder="Ad, soyad, email, PIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filtri */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Hamısı</option>
              <option value="ACTIVE">Aktiv</option>
              <option value="INACTIVE">Pasiv</option>
            </select>
          </div>

          {/* Kafedra Filtri */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kafedra</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Hamısı</option>
              {uniqueDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MUƏLLIMLƏRIN CƏDVƏLI */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">Ad / Soyad</th>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">Email</th>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">Telefon</th>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">PIN</th>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">Vəzifə</th>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">Kafedra</th>
                <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredMuellimler.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Nəticə tapılmadı
                  </td>
                </tr>
              ) : (
                filteredMuellimler.map((muellim) => (
                  <tr
                    key={muellim.id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 font-medium text-slate-900">
                      {muellim.lastName} {muellim.firstName}
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-slate-600">{muellim.email}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-slate-600">{muellim.mobile || '-'}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 font-mono text-slate-600">{muellim.pin}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600 text-slate-600">{muellim.position}</td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600">
                      {muellim.department ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {muellim.department.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border border-gray-300 dark:border-gray-600">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          muellim.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {muellim.status === 'ACTIVE' ? 'Aktiv' : 'Pasiv'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cədvəl altında bilgi */}
      {!loading && (
        <div className="text-xs text-slate-500 text-center">
          {stats.filtered} / {stats.total} müəllim göstərilir
        </div>
      )}
    </div>
  );
};

export default Teachers;
