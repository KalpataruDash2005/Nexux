export interface AuthRequestDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  role: 'STUDENT' | 'RECRUITER' | 'ADMIN';
  name?: string;
}

export interface AuthResponseDto {
  token: string;
  type: string;
  email: string;
  role: string;
  name?: string;
}
