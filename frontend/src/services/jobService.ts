import apiClient from './apiClient';
import { JobDto } from '../types/job';

export const getActiveJobs = async (): Promise<JobDto[]> => {
  const response = await apiClient.get<JobDto[]>('/jobs');
  return response.data;
};

export const createJob = async (data: JobDto): Promise<JobDto> => {
  const response = await apiClient.post<JobDto>('/jobs', data);
  return response.data;
};
