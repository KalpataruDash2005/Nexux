import apiClient from './apiClient';
import { JobDto } from '../types/job';

export const getActiveJobs = async (search?: string): Promise<JobDto[]> => {
  const url = search ? `/jobs?search=${encodeURIComponent(search)}` : '/jobs';
  const response = await apiClient.get<JobDto[]>(url);
  return response.data;
};

export const createJob = async (data: JobDto): Promise<JobDto> => {
  const response = await apiClient.post<JobDto>('/jobs', data);
  return response.data;
};
