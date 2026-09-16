import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Movzu {
  id: number;
  fennId: number;
  ad: string;
  yaradildi: string;
  yenilendi: string;
  fenn: {
    id: number;
    fennAdi: string;
    fennKodu: string;
  };
  _count?: {
    suallar: number;
  };
  source?: 'ETS' | 'LOCAL'; // Gələn mənbəni təyin etmək üçün
}

export interface CreateMovzuPayload {
  fennId: number;
  ad: string;
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

export const getMovzular = async (fennId?: number): Promise<Movzu[]> => {
  const params: Record<string, any> = {};
  if (fennId) params.fennId = fennId;

  const response = await apiClient.get('/movzular', { params });
  return response.data;
};

export const getMovzu = async (id: number): Promise<Movzu> => {
  const response = await apiClient.get(`/movzular/${id}`);
  return response.data;
};

export const createMovzu = async (data: CreateMovzuPayload): Promise<Movzu> => {
  const response = await apiClient.post('/movzular', data);
  return response.data;
};

export const updateMovzu = async (id: number, data: Partial<CreateMovzuPayload>): Promise<Movzu> => {
  const response = await apiClient.put(`/movzular/${id}`, data);
  return response.data;
};

export const deleteMovzu = async (id: number): Promise<void> => {
  await apiClient.delete(`/movzular/${id}`);
};