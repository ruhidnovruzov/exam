import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface EtsDepartment {
  id: number | string;
  code?: string;
  name?: string;
  status?: string;
  facultyId?: number;
  createdAt?: string;
  updatedAt?: string;
  faculty?: {
    name?: string;
    code?: string;
  };
  _count?: {
    specialties?: number;
  };
}

export interface EtsSubject {
  id: number | string;
  subjectCode?: string;
  subjectTitle?: string;
  departmentId?: number | string;
  department?: { id: number | string; code?: string; name?: string };
  _count?: { topics?: number };
}

export interface EtsTopic {
  id: number;
  topicCode?: number;
  name: string;
  lessonType?: string;
  imageUrl?: string | null;
  subjectId?: number;
  createdAt?: string;
  updatedAt?: string;
  subject?: {
    id: number;
    subjectTitle?: string;
    subjectCode?: string;
  };
  _count?: {
    materials?: number;
    assignments?: number;
    curriculumPlanEntries?: number;
  };
}

export interface EtsSubjectGroup {
  id: number | string;
  name?: string;
  academicYear?: string;
  semester?: string;
  subjectId?: number | string;
  subject?: { subjectTitle?: string; subjectCode?: string; id?: number | string };
  lectureTeacher?: { firstName?: string; lastName?: string };
  seminarTeacher?: { firstName?: string; lastName?: string };
  faculty?: { name?: string };
  specialty?: { name?: string };
  department?: { name?: string };
  educationForm?: string;
  status?: string;
  _count?: { enrollments?: number };
}

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const normalizeList = <T>(payload: T[] | { data?: T[] }): T[] => {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
};

export const getDepartments = async (): Promise<EtsDepartment[]> => {
  const { data } = await api.get<EtsDepartment[] | { data?: EtsDepartment[] }>('/api/ets/departments');
  return normalizeList(data);
};

export const getSubjects = async (): Promise<EtsSubject[]> => {
  const { data } = await api.get<EtsSubject[] | { data?: EtsSubject[] }>('/api/ets/subjects');
  return normalizeList(data);
};

export const getTopics = async (): Promise<EtsTopic[]> => {
  const { data } = await api.get<EtsTopic[] | { data?: EtsTopic[] }>('/api/ets/topics');
  return normalizeList(data);
};

export const getSubjectGroups = async (
  academicYear?: string,
  semester?: string,
  status = 'ACTIVE',
  subjectId?: string | number
): Promise<EtsSubjectGroup[]> => {
  const params: Record<string, string> = {};
  if (academicYear) params.academicYear = academicYear;
  if (semester) params.semester = semester;
  if (status) params.status = status;
  if (subjectId != null && subjectId !== '') params.subjectId = String(subjectId);

  const { data } = await api.get<EtsSubjectGroup[] | { data?: EtsSubjectGroup[] }>(
    '/api/ets/subject-groups',
    { params }
  );
  return normalizeList(data);
};
