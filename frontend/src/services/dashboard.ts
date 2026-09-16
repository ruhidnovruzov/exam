import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface DashboardStats {
  kafedralar: number;
  fennler: number;
  testBankilar: number;
  movzular: number;
  suallar: number;
  imtahanlar: number;
  telebeler: number;
  istifadeciler: number;
  tedrisIller: number;
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

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await apiClient.get('/dashboard');
  return response.data;
};
