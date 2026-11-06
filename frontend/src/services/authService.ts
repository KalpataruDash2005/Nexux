import apiClient from './apiClient';
import {
  AuthRequestDto,
  RegisterRequestDto,
  AuthResponseDto,
  LogoutResponseDto,
  ChangePasswordRequestDto,
} from '../types/auth';

export const login = async (data: AuthRequestDto): Promise<AuthResponseDto> => {
  const response = await apiClient.post<AuthResponseDto>('/auth/login', data);
  return response.data;
};

export const register = async (data: RegisterRequestDto): Promise<string> => {
  const response = await apiClient.post<string>('/auth/register', data);
  return response.data;
};

export const logout = async (): Promise<LogoutResponseDto> => {
  try {
    const response = await apiClient.post<LogoutResponseDto>('/auth/logout');
    return response.data;
  } catch (err) {
    return { message: 'Logged out locally', status: 'LOGGED_OUT' };
  }
};

export const changePassword = async (data: ChangePasswordRequestDto): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/auth/change-password', data);
  return response.data;
};
