/**
 * Standardized AI Response Types matching backend StandardAiResponse schema (v2026.1).
 * Applied across all AI modules in Nexora:
 * - Resume analysis
 * - Career readiness
 * - Analytics
 * - PDF summaries & QA
 * - AI Chat
 * - Interview evaluation
 * - Coding evaluation
 * - Learning recommendations
 */

export interface EvidenceItem {
  claim: string;
  source?: string;
  quote_or_detail?: string;
  status?: 'Demonstrated' | 'Partially demonstrated' | 'Not demonstrated' | 'Insufficient info';
  confidence?: number;
}

export type AiModule =
  | 'resume_analysis'
  | 'career_readiness'
  | 'analytics'
  | 'pdf_summary'
  | 'pdf_qa'
  | 'interview_evaluation'
  | 'coding_evaluation'
  | 'ai_chat'
  | 'learning_recommendation';

export type AiStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NEEDS_INFO' | 'FAILED';

export interface StandardAiResponse {
  success: boolean;
  module: AiModule | string;
  version: string;
  summary: string;
  score: number | null;
  status: AiStatus | string;
  strengths: string[];
  weaknesses: string[];
  evidence: EvidenceItem[];
  recommendations: string[];
  missing_information: string[];
  metadata: Record<string, unknown>;
}

export interface ApiSafeErrorResponse {
  message: string;
  detail: string;
  status: number;
  requestId?: string;
}
