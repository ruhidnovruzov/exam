import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getStudentToken } from './studentAuth';

const studentClient = axios.create({
  baseURL: `${API_BASE_URL}/api/student`,
});

studentClient.interceptors.request.use((config) => {
  const token = getStudentToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type StudentExamSummary = {
  id: number;
  imtahanId: number;
  telebeId: number;
  girisVaxti: string | null;
  cixisVaxti: string | null;
  bal: number | null;
  kecdi: boolean | null;
  deadlineAt: string;
  canStart: boolean;
  finished: boolean;
  imtahan: {
    id: number;
    ad: string;
    imtahanNovu: string;
    tehsilNovu: string;
    sualTipleri?: string[];
    muddet: number;
    kecidBali: number;
    baslamaVaxti: string;
    bitmeVaxti: string;
    status: string;
    fenn: { id: number; fennAdi: string; fennKodu: string };
    tedrisIl: { id: number; label: string };
    terkib: { sualTipi: string; sualSayi: number; balPerSual: number }[];
  };
};

export type StudentQuestion = {
  id: number;
  sira: number;
  sualTipi: 'TEST' | 'NEZERI' | 'DUSTUR' | 'PRAKTIKI';
  metn: string;
  sekil?: string | null;
  movzu?: { id: number; ad: string };
  cavablar: { id: number; metn: string; sekil?: string | null; sira: number }[];
  secilenCavabId?: number | null;
  yaziliCavab?: string | null;
  bal?: number | null;
  duzgundur?: boolean | null;
};

export type StudentExamDetail = StudentExamSummary & {
  questions: StudentQuestion[];
  result?: {
    test: { total: number; answered: number; correct: number; incorrect: number; score: number };
    essay: { total: number; answered: number };
  } | null;
};

export const getStudentExams = async (): Promise<StudentExamSummary[]> => {
  const { data } = await studentClient.get('/exams');
  return data;
};

export const getStudentExam = async (imtahanId: number): Promise<StudentExamDetail> => {
  const { data } = await studentClient.get(`/exams/${imtahanId}`);
  return data;
};

export const answerStudentQuestion = async (
  imtahanId: number,
  questionId: number,
  payload: { secilenCavabId?: number; yaziliCavab?: string }
) => {
  const { data } = await studentClient.post(`/exams/${imtahanId}/questions/${questionId}/answer`, payload);
  return data;
};

export const finishStudentExam = async (imtahanId: number) => {
  const { data } = await studentClient.post(`/exams/${imtahanId}/finish`);
  return data;
};
