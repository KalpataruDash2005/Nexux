export interface ApplicationDto {
  id?: string;
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  studentId?: string;
  studentEmail?: string;
  status?: string;
  createdAt?: string;
}

export interface CreateApplicationDto {
  jobId: string;
}
