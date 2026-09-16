import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Telebe {
  id: number;
  etsId: string;
  ad: string;
  soyad: string;
  ata?: string | null;
  qrup?: string | null;
  ixtisas?: string | null;
  kurs?: number | null;
  email?: string | null;
  yaradildi: string;
  yenilendi: string;
}

export interface TelebeQueryParams {
  qrup?: string;
  ixtisas?: string;
  kurs?: number;
}

export interface BulkUpsertTelebeItem {
  etsId: string;
  ad: string;
  soyad: string;
  ata?: string;
  qrup?: string;
  ixtisas?: string;
  kurs?: number;
  email?: string;
}

export interface BulkUpsertTelebePayload {
  telebeler: BulkUpsertTelebeItem[];
}

export interface UpdateTelebePayload {
  ad?: string;
  soyad?: string;
  ata?: string | null;
  qrup?: string | null;
  ixtisas?: string | null;
  kurs?: number | null;
  email?: string | null;
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

export const getTelebeler = async (params?: TelebeQueryParams): Promise<Telebe[]> => {
  const { data } = await apiClient.get('/telebeler', { params });
  return data;
};

export const getTelebe = async (id: number): Promise<Telebe> => {
  const { data } = await apiClient.get(`/telebeler/${id}`);
  return data;
};

export const bulkUpsertTelebeler = async (payload: BulkUpsertTelebePayload): Promise<{ idxal: number; mesaj: string }> => {
  const { data } = await apiClient.post('/telebeler/bulk-upsert', payload);
  return data;
};

export const updateTelebe = async (id: number, payload: UpdateTelebePayload): Promise<Telebe> => {
  const { data } = await apiClient.put(`/telebeler/${id}`, payload);
  return data;
};
