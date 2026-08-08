import apiClient from './apiClient';

export interface PendingWorkPayload {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export async function sendPendingWorkReminder(): Promise<PendingWorkPayload> {
  const res = await apiClient.post<PendingWorkPayload>('/notifications/pending-work');
  return res.data;
}
