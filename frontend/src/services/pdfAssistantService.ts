import apiClient from './apiClient';

export type PdfStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type PdfSource = 'N8N' | 'NATIVE';

export interface PdfDocument {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  status: PdfStatus;
  processingSource: PdfSource | null;
  summary: string | null;
  chunkCount: number | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface PdfChatMessage {
  id: string;
  role: 'USER' | 'AI';
  content: string;
  createdAt: string;
}

export interface PdfChatResponse {
  answer: string;
  sources: string[];
  history: PdfChatMessage[];
}

export interface PdfUploadResponse {
  id: string;
  fileName: string;
  status: PdfStatus;
  message: string;
}

const base = (workspaceId: string) => `/pdf-assistant/workspaces/${workspaceId}/documents`;

export async function listPdfDocuments(workspaceId: string): Promise<PdfDocument[]> {
  const res = await apiClient.get<PdfDocument[]>(base(workspaceId));
  return res.data;
}

export async function uploadPdfDocument(workspaceId: string, file: File): Promise<PdfUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<PdfUploadResponse>(base(workspaceId), form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deletePdfDocument(workspaceId: string, documentId: string): Promise<void> {
  await apiClient.delete(`${base(workspaceId)}/${documentId}`);
}

export async function askPdfQuestion(
  workspaceId: string,
  documentId: string,
  question: string
): Promise<PdfChatResponse> {
  const res = await apiClient.post<PdfChatResponse>(
    `${base(workspaceId)}/${documentId}/chat`,
    { question }
  );
  return res.data;
}

export async function getPdfChatHistory(
  workspaceId: string,
  documentId: string
): Promise<PdfChatMessage[]> {
  const res = await apiClient.get<PdfChatMessage[]>(`${base(workspaceId)}/${documentId}/chat`);
  return res.data;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isProcessing(status: PdfStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}
