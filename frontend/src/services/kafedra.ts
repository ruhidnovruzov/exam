import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Kafedra {
  id: number;
  ad: string;
  kod: string;
  externalId?: string;
  source?: 'LOCAL' | 'ETS';
  _count?: {
    fennler: number;
    istifadeci: number;
  };
}

export interface CreateKafedraPayload {
  ad: string;
  kod: string;
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

export const getKafedralar = async (): Promise<Kafedra[]> => {
  const response = await apiClient.get('/kafedralar');
  return response.data;
};

export const getKafedra = async (id: number): Promise<Kafedra> => {
  const response = await apiClient.get(`/kafedralar/${id}`);
  return response.data;
};

export const createKafedra = async (data: CreateKafedraPayload): Promise<Kafedra> => {
  const response = await apiClient.post('/kafedralar', data);
  return response.data;
};

export const updateKafedra = async (id: number, data: CreateKafedraPayload): Promise<Kafedra> => {
  const response = await apiClient.put(`/kafedralar/${id}`, data);
  return response.data;
};

export const deleteKafedra = async (id: number): Promise<void> => {
  await apiClient.delete(`/kafedralar/${id}`);
};
