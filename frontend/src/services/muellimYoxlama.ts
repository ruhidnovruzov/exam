import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type GradingScope = {
  sualTipi: 'NEZERI' | 'DUSTUR' | 'PRAKTIKI';
  sualBaslangic: number;
  sualSon: number;
};

export type TeacherAssignment = {
  imtahan: {
    id: number;
    ad: string;
    fenn: { fennAdi: string };
    status: string;
    baslamaVaxti: string;
    bitmeVaxti: string;
    _count?: { telebeleri: number };
  };
  scopes: GradingScope[];
};

export type GradingQueueItem = {
  id: number;
  yoxlamaKodu: string;
  sualTipi: string;
  tipSira: number;
  sualMetn: string;
  sualSekil?: string | null;
  movzu?: string | null;
  yaziliCavab: string;
  maxBal: number;
  bal: number | null;
  qeyd?: string | null;
  yoxlanilib: boolean;
};

export const getMyGradingExams = async (): Promise<TeacherAssignment[]> => {
  const { data } = await apiClient.get('/muellim/yoxlama/imtahanlar');
  return data;
};

export const getGradingQueue = async (imtahanId: number) => {
  const { data } = await apiClient.get(`/muellim/yoxlama/imtahanlar/${imtahanId}/nobet`);
  return data as {
    imtahan: { id: number; ad: string; fenn: { fennAdi: string }; status: string };
    stats: { total: number; pending: number; graded: number };
    queue: GradingQueueItem[];
  };
};

export const gradeQuestion = async (
  imtahanId: number,
  sualId: number,
  payload: { bal: number; qeyd?: string }
) => {
  const { data } = await apiClient.post(
    `/muellim/yoxlama/imtahanlar/${imtahanId}/suallar/${sualId}/qiymet`,
    payload
  );
  return data;
};
