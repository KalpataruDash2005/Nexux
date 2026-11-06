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

export interface LogoutResponseDto {
  message: string;
  status: string;
}

export interface ChangePasswordRequestDto {
  current_password?: string;
  new_password?: string;
}
