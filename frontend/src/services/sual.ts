import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Cavab {
  id: number;
  sualId: number;
  metn: string;
  sekil: string | null;
  duzgundur: boolean;
  sira: number;
  yaradildi: string;
}

export interface Movzu {
  id: number;
  ad: string;
}

export interface Sual {
  id: number;
  testBankiId: number;
  movzuId: number;
  sualTipi: 'TEST' | 'NEZERI' | 'DUSTUR' | 'PRAKTIKI';
  chetinlik: 'ASAN' | 'ORTA' | 'CETTIN';
  metn: string;
  sekil: string | null;
  yaradildi: string;
  yenilendi: string;
  movzu?: Movzu;
  cavablar?: Cavab[];
  _count?: {
    cavablar: number;
  };
}

export interface CreateSualPayload {
  testBankiId: number;
  movzuId: number;
  sualTipi: 'TEST' | 'NEZERI' | 'DUSTUR' | 'PRAKTIKI';
  chetinlik: 'ASAN' | 'ORTA' | 'CETTIN';
  metn: string;
  sekil: string | null;
  cavablar?: Array<{
    metn: string;
    duzgundur: boolean;
    sira: number;
  }>;
}

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

export const getSuallar = async (filters?: {
  testBankiId?: number;
  movzuId?: number;
  sualTipi?: string;
  chetinlik?: string;
}): Promise<Sual[]> => {
  const params: Record<string, any> = {};
  if (filters?.testBankiId) params.testBankiId = filters.testBankiId;
  if (filters?.movzuId) params.movzuId = filters.movzuId;
  if (filters?.sualTipi) params.sualTipi = filters.sualTipi;
  if (filters?.chetinlik) params.chetinlik = filters.chetinlik;

  const response = await apiClient.get('/suallar', { params });
  return response.data;
};

export const getSual = async (id: number): Promise<Sual> => {
  const response = await apiClient.get(`/suallar/${id}`);
  return response.data;
};

export const createSual = async (data: CreateSualPayload): Promise<Sual> => {
  const response = await apiClient.post('/suallar', data);
  return response.data;
};

export const updateSual = async (id: number, data: Partial<CreateSualPayload>): Promise<Sual> => {
  const response = await apiClient.put(`/suallar/${id}`, data);
  return response.data;
};

export const deleteSual = async (id: number): Promise<void> => {
  await apiClient.delete(`/suallar/${id}`);
};
