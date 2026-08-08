import apiClient from './apiClient';

export interface FeedbackPayload {
  name: string;
  email: string;
  message: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  await apiClient.post('/feedback', payload);
}
