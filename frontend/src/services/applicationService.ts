import apiClient from './apiClient';
import { ApplicationDto, CreateApplicationDto } from '../types/application';

export const getMyApplications = async (): Promise<ApplicationDto[]> => {
  const response = await apiClient.get<ApplicationDto[]>('/applications/me');
  return response.data;
};

export const applyForJob = async (data: CreateApplicationDto): Promise<ApplicationDto> => {
  const response = await apiClient.post<ApplicationDto>('/applications', data);
  return response.data;
};
