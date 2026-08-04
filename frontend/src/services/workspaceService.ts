import apiClient from './apiClient';

export interface Workspace {
    id: string;
    studentId: string;
    name: string;
    description: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export const createWorkspace = async (name: string, description: string): Promise<Workspace> => {
    const response = await apiClient.post<Workspace>('/workspaces', { name, description });
    return response.data;
};

export const getWorkspaces = async (): Promise<Workspace[]> => {
    const response = await apiClient.get<Workspace[]>('/workspaces');
    return response.data;
};

export const getWorkspaceById = async (id: string): Promise<Workspace> => {
    const response = await apiClient.get<Workspace>(`/workspaces/${id}`);
    return response.data;
};

export const archiveWorkspace = async (id: string): Promise<Workspace> => {
    const response = await apiClient.patch<Workspace>(`/workspaces/${id}/archive`);
    return response.data;
};

export const deleteWorkspace = async (id: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${id}`);
};

export const renameWorkspace = async (id: string, name: string, description?: string): Promise<Workspace> => {
    const response = await apiClient.patch<Workspace>(`/workspaces/${id}`, { name, description });
    return response.data;
};
