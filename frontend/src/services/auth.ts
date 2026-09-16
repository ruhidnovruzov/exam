import axios from 'axios';
import { AUTH_API_URL } from '../config/api';

const TOKEN_KEY = 'exam_token';

export type LoginCredentials = {
  username: string;
  parol: string;
};

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const isAuthenticated = (): boolean => Boolean(getToken());

const authClient = axios.create({
  baseURL: AUTH_API_URL,
});

authClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (credentials: LoginCredentials) => {
  const response = await authClient.post('/login', credentials);
  const payload = response.data;

  if (!payload.token) {
    throw new Error('Token not returned from server');
  }

  localStorage.removeItem('exam_student_token');
  setToken(payload.token);
  return payload;
};

export type CurrentUser = {
  id: number;
  ad: string;
  soyad: string;
  username: string;
  rol: string;
  kafedra: null | { id: number; ad: string };
  muellimFennler: unknown[];
};

export const fetchCurrentUser = async (): Promise<CurrentUser> => {
  const response = await authClient.get('/me');
  return response.data;
};

export const logout = () => {
  clearToken();
};
