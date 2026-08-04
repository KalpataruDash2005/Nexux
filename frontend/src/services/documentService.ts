import apiClient from './apiClient';

export interface DocumentResponse {
    id: string;
    workspaceId: string;
    name: string;
    type: string;
    sizeBytes: number;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export const uploadDocument = async (workspaceId: string, file: File): Promise<DocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<DocumentResponse>(`/workspaces/${workspaceId}/documents`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const getDocuments = async (workspaceId: string): Promise<DocumentResponse[]> => {
    const response = await apiClient.get<DocumentResponse[]>(`/workspaces/${workspaceId}/documents`);
    return response.data;
};

export const deleteDocument = async (workspaceId: string, documentId: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${workspaceId}/documents/${documentId}`);
};
