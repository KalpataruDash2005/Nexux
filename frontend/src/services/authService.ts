import apiClient from './apiClient';
import { AuthRequestDto, RegisterRequestDto, AuthResponseDto } from '../types/auth';

export const login = async (data: AuthRequestDto): Promise<AuthResponseDto> => {
  const response = await apiClient.post<AuthResponseDto>('/auth/login', data);
  return response.data;
};

export const register = async (data: RegisterRequestDto): Promise<string> => {
  const response = await apiClient.post<string>('/auth/register', data);
  return response.data;
};
