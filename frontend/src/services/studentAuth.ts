import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const STUDENT_TOKEN_KEY = 'exam_student_token';

export type StudentLoginCredentials = {
  identifier: string;
  password: string;
};

export type StudentProfile = {
  id: number;
  etsId: string;
  ad: string;
  soyad: string;
  ata?: string | null;
  qrup?: string | null;
  ixtisas?: string | null;
  kurs?: number | null;
  email?: string | null;
};

export const getStudentToken = (): string | null => localStorage.getItem(STUDENT_TOKEN_KEY);
export const setStudentToken = (token: string) => localStorage.setItem(STUDENT_TOKEN_KEY, token);
export const clearStudentToken = () => localStorage.removeItem(STUDENT_TOKEN_KEY);
export const isStudentAuthenticated = (): boolean => Boolean(getStudentToken());

const studentAuthClient = axios.create({
  baseURL: `${API_BASE_URL}/api/student`,
});

studentAuthClient.interceptors.request.use((config) => {
  const token = getStudentToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const studentLogin = async (credentials: StudentLoginCredentials) => {
  const { data } = await studentAuthClient.post('/login', credentials);
  if (!data.token) throw new Error('Token serverdən qayıtmadı');
  localStorage.removeItem('exam_token');
  setStudentToken(data.token);
  return data as { token: string; telebe: StudentProfile };
};

export const fetchStudentProfile = async (): Promise<StudentProfile> => {
  const { data } = await studentAuthClient.get('/me');
  return data.telebe;
};

export const studentLogout = () => {
  clearStudentToken();
};
