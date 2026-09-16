import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Muellim {
  id: number;
  lastName: string;
  firstName: string;
  fatherName?: string;
  pin: string;
  gender: 'MALE' | 'FEMALE';
  birthDate: string;
  email: string;
  mobile?: string;
  phone?: string;
  position: string;
  status: 'ACTIVE' | 'INACTIVE';
  facultyId?: number;
  departmentId?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  faculty?: {
    id: number;
    name: string;
  };
  department?: {
    id: number;
    name: string;
  };
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

export const getMuellimler = async (): Promise<Muellim[]> => {
  const response = await apiClient.get('/muellimler');
  return Array.isArray(response.data) ? response.data : [];
};

export const getMuellim = async (id: number): Promise<Muellim> => {
  const response = await apiClient.get(`/muellimler/${id}`);
  return response.data;
};
