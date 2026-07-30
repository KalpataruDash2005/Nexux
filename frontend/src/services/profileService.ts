import apiClient from './apiClient';
import { StudentProfileDto } from '../types/profile';

export const getMyProfile = async (): Promise<StudentProfileDto> => {
  const response = await apiClient.get<StudentProfileDto>('/students/me');
  return response.data;
};

export const updateMyProfile = async (data: StudentProfileDto): Promise<StudentProfileDto> => {
  const response = await apiClient.put<StudentProfileDto>('/students/me', data);
  return response.data;
};
