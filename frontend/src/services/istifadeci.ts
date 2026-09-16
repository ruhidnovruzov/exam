import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Istifadeci {
  id: number;
  ad: string;
  soyad: string;
  username: string;
  rol: string;
  aktiv: boolean;
  yaradildi: string;
  kafedra: { id: number; ad: string } | null;
  muellimFennler: Array<{ fenn: { id: number; fennAdi: string } }>;
}

export interface CreateIstifadeciPayload {
  ad: string;
  soyad: string;
  username: string;
  parol: string;
  rol: 'ADMIN' | 'KAFEDRA' | 'MUELLIM';
  kafedraId?: number;
  fennIds?: number[];
}

export interface UpdateIstifadeciPayload {
  ad?: string;
  soyad?: string;
  username?: string;
  parol?: string;
  kafedraId?: number | null;
  fennIds?: number[];
  aktiv?: boolean;
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

export const getIstifadeciler = async (): Promise<Istifadeci[]> => {
  const response = await apiClient.get('/istifadeciler');
  return response.data;
};

export const getIstifadeci = async (id: number): Promise<Istifadeci> => {
  const response = await apiClient.get(`/istifadeciler/${id}`);
  return response.data;
};

export const createIstifadeci = async (data: CreateIstifadeciPayload): Promise<Istifadeci> => {
  const response = await apiClient.post('/istifadeciler', data);
  return response.data;
};

export const updateIstifadeci = async (id: number, data: UpdateIstifadeciPayload): Promise<Istifadeci> => {
  const response = await apiClient.put(`/istifadeciler/${id}`, data);
  return response.data;
};

export const deleteIstifadeci = async (id: number): Promise<void> => {
  await apiClient.delete(`/istifadeciler/${id}`);
};
