import apiClient from './apiClient';

export interface ChatResponse {
    answer: string;
}

export const askQuestion = async (workspaceId: string, question: string): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>(`/workspaces/${workspaceId}/chat`, { question });
    return response.data;
};
