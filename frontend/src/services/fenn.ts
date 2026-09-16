import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Fenn {
  id: number;
  kafedraId: number;
  fennKodu: string;
  fennAdi: string;
  bolme: string;
  externalId?: string;
  source?: 'LOCAL' | 'ETS';
  elavEden: number;
  kafedra: {
    id: number;
    ad: string;
  };
  istifadeci: {
    id: number;
    ad: string;
    soyad: string;
  };
  _count?: {
    movzular: number;
    testBanki: number;
  };
}

export interface CreateFennPayload {
  kafedraId: number;
  fennKodu: string;
  fennAdi: string;
  bolme: string;
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

export const getFennler = async (kafedraId?: number, bolme?: string): Promise<Fenn[]> => {
  const params: Record<string, any> = {};
  if (kafedraId) params.kafedraId = kafedraId;
  if (bolme) params.bolme = bolme;

  const response = await apiClient.get('/fennler', { params });
  return response.data;
};

export const getFenn = async (id: number): Promise<Fenn> => {
  const response = await apiClient.get(`/fennler/${id}`);
  return response.data;
};

export const createFenn = async (data: CreateFennPayload): Promise<Fenn> => {
  const response = await apiClient.post('/fennler', data);
  return response.data;
};

export const updateFenn = async (id: number, data: Partial<CreateFennPayload>): Promise<Fenn> => {
  const response = await apiClient.put(`/fennler/${id}`, data);
  return response.data;
};

export const deleteFenn = async (id: number): Promise<void> => {
  await apiClient.delete(`/fennler/${id}`);
};
