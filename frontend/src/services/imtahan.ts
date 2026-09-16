import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Tiplər ────────────────────────────────────────────────
export interface ImtahanTerkibItem {
  sualTipi: 'TEST' | 'NEZERI' | 'DUSTUR' | 'PRAKTIKI';
  sualSayi: number;
  balPerSual: number;
  yoxlamaMuddeti: number | null;
}

export interface Imtahan {
  id: number;
  ad: string;
  fennId: number;
  tedrisIlId: number;
  imtahanNovu: string;
  sualTipleri?: ('TEST' | 'NEZERI' | 'DUSTUR' | 'PRAKTIKI')[];
  tehsilNovu: string;
  muddet: number;
  kecidBali: number;
  imtahanSecimi: string;
  baslamaVaxti: string;
  bitmeVaxti: string;
  status: string;
  terkib: ImtahanTerkibItem[];
  testBankilar?: { testBankiId: number }[];
  movzular?: { movzuId: number }[];
  _count?: { telebeleri: number };
  yaradildi: string;
}

export interface CreateImtahanPayload {
  ad: string;
  fennId: number;
  tedrisIlId: number;
  imtahanNovu: string;
  sualTipleri?: ('TEST' | 'NEZERI' | 'DUSTUR' | 'PRAKTIKI')[];
  tehsilNovu: string;
  muddet: number;
  kecidBali: number;
  imtahanSecimi: string;
  baslamaVaxti: string;
  bitmeVaxti: string;
  testBankiIds: number[];
  movzuIds?: number[];
  terkib: ImtahanTerkibItem[];
  subjectGroupExternalId?: string | number;
  etsSubjectId?: string | number;
}

export interface UpdateImtahanPayload {
  ad?: string;
  muddet?: number;
  kecidBali?: number;
  baslamaVaxti?: string;
  bitmeVaxti?: string;
}

// ─── API çağırışları ───────────────────────────────────────
export const getImtahanlar = async (params?: { fennId?: number; tedrisIlId?: number; status?: string }): Promise<Imtahan[]> => {
  const { data } = await apiClient.get('/imtahanlar', { params });
  return data;
};

export const getImtahan = async (id: number): Promise<Imtahan> => {
  const { data } = await apiClient.get(`/imtahanlar/${id}`);
  return data;
};

export const createImtahan = async (payload: CreateImtahanPayload): Promise<Imtahan> => {
  const { data } = await apiClient.post('/imtahanlar', payload);
  return data;
};

export const updateImtahan = async (id: number, payload: UpdateImtahanPayload): Promise<Imtahan> => {
  const { data } = await apiClient.put(`/imtahanlar/${id}`, payload);
  return data;
};

export const deleteImtahan = async (id: number): Promise<void> => {
  await apiClient.delete(`/imtahanlar/${id}`);
};

export const getImtahanTelebeler = async (imtahanId: number): Promise<any[]> => {
  const { data } = await apiClient.get(`/imtahanlar/${imtahanId}/telebeler`);
  return data;
};

export const telebeElave = async (imtahanId: number, telebeIds: number[]): Promise<any> => {
  const { data } = await apiClient.post(`/imtahanlar/${imtahanId}/telebeler`, { telebeIds });
  return data;
};

export const getImtahanNeticeler = async (imtahanId: number): Promise<any[]> => {
  const { data } = await apiClient.get(`/imtahanlar/${imtahanId}/neticeler`);
  return data;
};

export interface ImtahanMuellimAssignment {
  id: number;
  imtahanId: number;
  muellimId: number;
  etsTeacherId: string;
  sualTipi: 'NEZERI' | 'DUSTUR' | 'PRAKTIKI';
  sualBaslangic: number;
  sualSon: number;
  muellim: {
    id: number;
    ad: string;
    soyad: string;
    username: string;
    etsId: string | null;
  };
}

export const getImtahanMuellimler = async (imtahanId: number): Promise<ImtahanMuellimAssignment[]> => {
  const { data } = await apiClient.get(`/imtahanlar/${imtahanId}/muellimler`);
  return data;
};

export const assignImtahanMuellimler = async (imtahanId: number, etsTeacherIds: number[]) => {
  const { data } = await apiClient.post(`/imtahanlar/${imtahanId}/muellimler`, { etsTeacherIds });
  return data;
};
