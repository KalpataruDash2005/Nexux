import apiClient from './apiClient';
import { ApplicationDto, CreateApplicationDto, ApplicationDetailsDto } from '../types/application';

export const getMyApplications = async (): Promise<ApplicationDto[]> => {
  const response = await apiClient.get<ApplicationDto[]>('/applications/me');
  return response.data;
};

export const applyForJob = async (data: CreateApplicationDto): Promise<ApplicationDto> => {
  const response = await apiClient.post<ApplicationDto>('/applications', data);
  return response.data;
};

export const getApplicationsForJob = async (jobId: string): Promise<ApplicationDetailsDto[]> => {
  const response = await apiClient.get<ApplicationDetailsDto[]>(`/applications/jobs/${jobId}`);
  return response.data;
};

export const updateApplicationStatus = async (applicationId: string, status: string): Promise<ApplicationDetailsDto> => {
  const response = await apiClient.put<ApplicationDetailsDto>(`/applications/${applicationId}/status`, { status });
  return response.data;
};
