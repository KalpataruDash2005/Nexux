import apiClient from './apiClient';

export interface SearchResult {
    documentId: string;
    documentName: string;
    content: string;
    score: number;
}

export const semanticSearch = async (workspaceId: string, query: string, maxResults: number = 5): Promise<SearchResult[]> => {
    const response = await apiClient.get<SearchResult[]>(`/workspaces/${workspaceId}/search`, {
        params: { query, maxResults }
    });
    return response.data;
};
