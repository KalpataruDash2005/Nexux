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

export interface ApplicationDetailsDto extends ApplicationDto {
  studentName?: string;
  studentResumeUrl?: string;
  studentSkills?: string;
}

export interface UpdateApplicationStatusDto {
  status: string;
}
