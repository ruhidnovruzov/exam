import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface TestBanki {
  id: number;
  ad: string;
  fennId: number;
  kafedraId: number;
  elavEdenId: number;
  status: 'GOZLEYIR' | 'TESDIQLENDI' | 'REDAKTEYE_GONDERILIB' | 'LEGV_EDILDI';
  blok: 'ACIQDIR' | 'BAGLIDIR';
  yaradildi: string;
  yenilendi: string;
  fenn: {
    id: number;
    fennAdi: string;
    fennKodu: string;
  };
  kafedra: {
    id: number;
    ad: string;
  };
  elavEden: {
    id: number;
    ad: string;
    soyad: string;
  };
  _count?: {
    suallar: number;
  };
}

export interface CreateTestBankiPayload {
  ad: string;
  fennId?: number;
  kafedraId?: number;
  fennExternalId?: string | number;
  kafedraExternalId?: string | number;
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

export const getTestBankilar = async (fennId?: number, status?: string, blok?: string): Promise<TestBanki[]> => {
  const params: Record<string, any> = {};
  if (fennId) params.fennId = fennId;
  if (status) params.status = status;
  if (blok) params.blok = blok;

  const response = await apiClient.get('/test-bankilar', { params });
  return response.data;
};

export const getTestBanki = async (id: number): Promise<TestBanki> => {
  const response = await apiClient.get(`/test-bankilar/${id}`);
  return response.data;
};

export const createTestBanki = async (data: CreateTestBankiPayload): Promise<TestBanki> => {
  const response = await apiClient.post('/test-bankilar', data);
  return response.data;
};

export const updateTestBanki = async (id: number, data: Partial<CreateTestBankiPayload>): Promise<TestBanki> => {
  const response = await apiClient.put(`/test-bankilar/${id}`, data);
  return response.data;
};

export const deleteTestBanki = async (id: number): Promise<void> => {
  await apiClient.delete(`/test-bankilar/${id}`);
};

export const tesdiqle = async (id: number): Promise<TestBanki> => {
  const response = await apiClient.post(`/test-bankilar/${id}/tesdiqle`);
  return response.data;
};

export const tesdiqdenQaldir = async (id: number): Promise<TestBanki> => {
  const response = await apiClient.post(`/test-bankilar/${id}/tesdiqden-qaldir`);
  return response.data;
};

export const redakyeyeGonder = async (id: number, qeyd?: string): Promise<any> => {
  const response = await apiClient.post(`/test-bankilar/${id}/redakteye-gonder`, { qeyd });
  return response.data;
};

export const blokToggle = async (id: number): Promise<TestBanki> => {
  const response = await apiClient.post(`/test-bankilar/${id}/blok-toggle`);
  return response.data;
};

export const umumiBaxis = async (id: number): Promise<any[]> => {
  const response = await apiClient.get(`/test-bankilar/${id}/umumi-baxis`);
  return response.data;
};

export const cavabsizBaxis = async (id: number): Promise<any[]> => {
  const response = await apiClient.get(`/test-bankilar/${id}/cavabsiz-baxis`);
  return response.data;
};

export const dogruCavabsizBaxis = async (id: number): Promise<any[]> => {
  const response = await apiClient.get(`/test-bankilar/${id}/dogru-cavabsiz-baxis`);
  return response.data;
};
