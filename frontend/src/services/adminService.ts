import apiClient from './apiClient';
import { JobDto } from '../types/job';

export interface UserAdminDto {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export const getAllUsers = async (): Promise<UserAdminDto[]> => {
  const response = await apiClient.get<UserAdminDto[]>('/admin/users');
  return response.data;
};

export const getAllJobsForAdmin = async (): Promise<JobDto[]> => {
  const response = await apiClient.get<JobDto[]>('/admin/jobs');
  return response.data;
};

export interface FeedbackAdminDto {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
}

export const getAllFeedback = async (): Promise<FeedbackAdminDto[]> => {
  const response = await apiClient.get<FeedbackAdminDto[]>('/admin/feedback');
  return response.data;
};

export const updateFeedbackStatus = async (id: string, status: string): Promise<void> => {
  await apiClient.patch(`/admin/feedback/${id}/status`, { status });
};

export const deleteFeedback = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/feedback/${id}`);
};

export interface AptitudeSetDto {
  id: string;
  title: string;
  fileName: string | null;
  questionCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface AptitudeQuestionDto {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  difficulty: string | null;
  topic: string | null;
  category: string | null;
  createdAt: string;
}

export const uploadAptitudeSet = async (file: File, title?: string): Promise<AptitudeSetDto> => {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  const response = await apiClient.post<AptitudeSetDto>('/admin/aptitude/sets', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return response.data;
};

export const getAptitudeSets = async (): Promise<AptitudeSetDto[]> => {
  const response = await apiClient.get<AptitudeSetDto[]>('/admin/aptitude/sets');
  return response.data;
};

export const getAptitudeSetQuestions = async (setId: string): Promise<AptitudeQuestionDto[]> => {
  const response = await apiClient.get<AptitudeQuestionDto[]>(`/admin/aptitude/sets/${setId}/questions`);
  return response.data;
};

export const deleteAptitudeSet = async (setId: string): Promise<void> => {
  await apiClient.delete(`/admin/aptitude/sets/${setId}`);
};
