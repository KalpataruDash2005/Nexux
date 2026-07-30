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
