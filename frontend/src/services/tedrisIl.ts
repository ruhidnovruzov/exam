import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface TedrisIl {
  id: number;
  il: number;
  fesil: 'YAZ' | 'PAYIZ';
  label: string;
  aktiv: boolean;
  yaradildi: string;
}

export interface CreateTedrisIlPayload {
  il: number;
  fesil: 'YAZ' | 'PAYIZ';
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

export const getTedrisIller = async (): Promise<TedrisIl[]> => {
  const { data } = await apiClient.get('/tedris-iller');
  return data;
};

export const createTedrisIl = async (payload: CreateTedrisIlPayload): Promise<TedrisIl> => {
  const { data } = await apiClient.post('/tedris-iller', payload);
  return data;
};

export const aktivEtTedrisIl = async (id: number): Promise<TedrisIl> => {
  const { data } = await apiClient.put(`/tedris-iller/${id}/aktiv`);
  return data;
};
