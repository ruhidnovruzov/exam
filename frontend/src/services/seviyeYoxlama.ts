import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

const client = axios.create({ baseURL: `${API_BASE_URL}/api/muellim/seviye-yoxlama` });
client.interceptors.request.use((config) => { const token = getToken(); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });

export const getMyLevelGradingExams = async () => (await client.get('/imtahanlar')).data;
export const getLevelEssayQueue = async (id: number) => (await client.get(`/imtahanlar/${id}/nobet`)).data;
export const gradeLevelEssay = async (id: number, payload: { bal: number; qeyd?: string }) => (await client.post(`/essayler/${id}/qiymet`, payload)).data;
