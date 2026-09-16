import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

const adminClient = axios.create({ baseURL: `${API_BASE_URL}/api/seviye-imtahani` });
adminClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type LevelQuestion = {
  id: number; sualTipi: 'TEST' | 'LISTENING' | 'READING' | 'ESSAY'; kateqoriya?: string | null; seviye?: string | null;
  metn: string; mediaUrl?: string | null; variantlar?: Array<{ label: string; text: string }> | null; duzgunCavab?: string | null; bal: number; sira: number;
};

export const getLevelConfig = async () => (await adminClient.get('/')).data;
export const saveLevelConfig = async (data: unknown) => (await adminClient.post('/', data)).data;
export const getLevelQuestions = async (id: number): Promise<LevelQuestion[]> => (await adminClient.get(`/${id}/questions`)).data;
export const createLevelQuestion = async (id: number, data: unknown) => (await adminClient.post(`/${id}/questions`, data)).data;
export const updateLevelQuestion = async (id: number, questionId: number, data: unknown) => (await adminClient.put(`/${id}/questions/${questionId}`, data)).data;
export const uploadLevelListeningAudio = async (file: File): Promise<{ url: string }> => {
  const form = new FormData(); form.append('audio', file);
  return (await adminClient.post('/listening-audio', form)).data;
};
export const deleteLevelQuestion = async (id: number, questionId: number) => adminClient.delete(`/${id}/questions/${questionId}`);
export const importLevelQuestions = async (id: number, file: File) => {
  const form = new FormData(); form.append('file', file);
  return (await adminClient.post(`/${id}/questions/import`, form)).data;
};
export const assignLevelEssayTeachers = async (id: number, etsTeacherIds: number[]) => (await adminClient.post(`/${id}/muellimler`, { etsTeacherIds })).data;
export const getLevelResults = async (id: number) => (await adminClient.get(`/${id}/netice`)).data;
export const saveLevelSpeakingScore = async (examId: number, attemptId: number, bal: number) =>
  (await adminClient.post(`/${examId}/netice/${attemptId}/speaking`, { bal })).data;
