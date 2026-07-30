import apiClient from './apiClient';

export interface HealthResponse {
  status: string;
}

export const getHealthStatus = async (): Promise<HealthResponse> => {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
};
