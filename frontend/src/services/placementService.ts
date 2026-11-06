import apiClient from './apiClient';
import { StandardAiResponse } from '../types/ai';

export type PlacementView =
  | 'dashboard'
  | 'resume'
  | 'interview'
  | 'coding'
  | 'aptitude'
  | 'analytics'
  | 'readiness'
  | 'roadmap'
  | 'sessions';

export type SessionType =
  | 'MOCK'
  | 'ROLE'
  | 'COMPANY'
  | 'TECHNICAL'
  | 'HR'
  | 'BEHAVIORAL'
  | 'PROJECT'
  | 'DSA_ORAL'
  | 'CODING'
  | 'APTITUDE';

export type SessionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type AptitudeCategory = 'QUANTITATIVE' | 'LOGICAL' | 'VERBAL' | 'PUZZLE' | 'DI';

export interface Suggestion {
  line: string;
  suggestion: string;
}

export interface RewrittenBullet {
  original: string;
  rewritten: string;
}

export interface ProjectEntry {
  title: string;
  description: string;
  technologies: string[];
  highlights: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  duration: string;
  percentage: string;
}

export interface ExperienceEntry {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
}

export interface SkillEvaluation {
  skill: string;
  evidenceLevel: 'Demonstrated' | 'Partially demonstrated' | 'Not demonstrated' | 'Insufficient info' | string;
  benchmark: 'Essential' | 'Expected' | 'Role-dependent' | 'Advanced' | string;
  evidenceDetail?: string;
  assessedScore?: number | null;
}

export interface DimensionBreakdown {
  dimension: string;
  score?: number | null;
  weight: number;
  isAssessed: boolean;
  evidenceSummary: string;
}

export interface ResumeAnalysis {
  candidateName: string;
  atsScore: number;
  overallScore: number;
  categoryScores: Record<string, number>;
  skills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: Suggestion[];
  rewrittenBullets: RewrittenBullet[];
  sections: string[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  expectedQuestions: string[];
  recommendedProjects: string[];
  recommendedCertifications: string[];
  checklist: string[];
  skillEvaluations?: SkillEvaluation[];
  standardResponse?: StandardAiResponse | null;
}

export interface ResumeResponse {
  resumeId: string | null;
  fileName: string | null;
  textLength: number | null;
  analysis: ResumeAnalysis | null;
}

export interface ResumeListItem {
  id: string;
  fileName: string;
  textLength: number;
  analyzedAt: string;
}

export interface TodayPractice {
  sessionsToday: number;
  questionsToday: number;
  goal: number;
}

export interface RecentFeedbackEntry {
  sessionTitle: string;
  type: string;
  date: string;
  summary: string;
}

export interface DashboardData {
  readiness: number;
  readinessLabel: string;
  streak: number;
  questionsAnswered: number;
  interviewsCompleted: number;
  codingProblems: number;
  resumeScore: number;
  todayPractice: TodayPractice;
  weakAreas: string[];
  strongAreas: string[];
  weeklyProgress: { day: string; score: number }[];
  recentFeedback: RecentFeedbackEntry[];
}

export interface PlacementSession {
  id: string;
  type: SessionType;
  mode: string;
  role: string | null;
  company: string | null;
  difficulty: SessionDifficulty | null;
  topic: string | null;
  status: string;
  score: number | null;
  messageCount: number | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  summary: string | null;
}

export interface CreateSessionBody {
  type: SessionType;
  mode: string;
  role: string;
  company: string;
  difficulty: SessionDifficulty;
  resumeId?: string;
}

export interface StartSessionResponse {
  sessionId: string;
  question: string;
}

export interface FeedbackScores {
  confidence?: number | null;
  communication: number;
  grammar: number;
  technicalAccuracy: number;
  structure: number;
  completeness: number;
}

export interface InterviewFeedback {
  score: number;
  overallScore?: number;
  scores: FeedbackScores;
  categoryScores?: Record<string, number>;
  correctConcepts?: string[];
  incorrectClaims?: string[];
  missingConcepts?: string[];
  strengths: string[];
  weaknesses: string[];
  improvements?: string[];
  improvementTips: string[];
  idealAnswer: string;
  scoreExplanation?: Record<string, string> | string;
  nextQuestion: string;
  nextDifficulty: string;
  questionCount: number;
  shouldEnd: boolean;
  isDegradedEvaluation?: boolean;
  evaluationStatus?: string;
}

export interface MessageResponse {
  feedback: InterviewFeedback;
  sessionCompleted: boolean;
  finalSummary: string | null;
}

export interface EndSessionResponse {
  score: number | null;
  summary: string | null;
  messageCount: number | null;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  analysis: InterviewFeedback | null;
  createdAt: string;
}

export interface SessionDetail {
  session: PlacementSession;
  messages: ChatMessage[];
}

export interface CodingExample {
  input: string;
  output: string;
}

export interface CodingTest {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface CodingProblem {
  title: string;
  statement: string;
  examples: CodingExample[];
  constraints: string;
  difficulty: string;
  topics: string[];
  testCases?: CodingTest[];
}

export interface CodingSessionResponse {
  sessionId: string;
  problem: CodingProblem;
}

export interface CreateCodingBody {
  role: string;
  topic: string;
  difficulty: string;
}

export interface CodingEvaluation {
  correctness: number;
  timeComplexity: string;
  spaceComplexity: string;
  codeQuality: number;
  naming: number;
  optimization: number;
  feedback: string;
  alternativeSolutions: string[];
  expectedQuestions: string[];
}

export interface CodingTestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error: string | null;
  hidden: boolean;
  executionTimeMs?: number;
  status?: string;
}

export interface RunCodingBody {
  language: string;
  code: string;
  customInput?: string;
}

export interface CodingRunResponse {
  status: string;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  testResults: CodingTestResult[];
  customResult?: CodingTestResult | null;
  compilationError?: string | null;
  runtimeError?: string | null;
  executionTimeMs?: number | null;
}

export interface SubmissionHistoryItem {
  id: string;
  language: string;
  status: string;
  score: number;
  passedTests: number;
  totalTests: number;
  executionTimeMs?: number | null;
  submittedAt: string;
}

export interface CodingSubmitResponse {
  submissionId?: string;
  status?: string;
  evaluation: CodingEvaluation;
  passed: boolean;
  totalScore: number;
  testResults?: CodingTestResult[];
  passedTests?: number;
  totalTests?: number;
  executionTimeMs?: number | null;
  compilationError?: string | null;
  runtimeError?: string | null;
  standardResponse?: any;
}

export interface SubmitCodingBody {
  language: string;
  code: string;
}

export interface AptitudeQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number | null;
  explanation: string | null;
  shortcut: string | null;
  difficulty: string;
  companyFrequency: string;
}

export interface AptitudeTest {
  questions: AptitudeQuestion[];
}

export interface AptitudeTestResponse {
  sessionId: string;
  test: AptitudeTest;
}

export interface CreateAptitudeBody {
  category: AptitudeCategory;
  difficulty: string;
  count: number;
}

export interface AptitudeAnswer {
  questionId: string;
  selectedIndex: number;
}

export interface AptitudeDetail {
  questionId: string;
  correct: boolean;
  correctAnswerIndex: number;
  yourAnswer: number | null;
  explanation: string | null;
}

export interface AptitudeSubmitResponse {
  score: number;
  total: number;
  percentage: number;
  sessionCompleted: boolean;
  detailed: AptitudeDetail[];
}

export interface AnalyticsData {
  technical: number;
  hr: number;
  communication: number;
  coding: number;
  dsa: number;
  aptitude: number;
  resume: number;
  overallReadiness: number;
  daily: { date: string; score: number }[];
  weekly: { date: string; score: number }[];
  monthly: { date: string; score: number }[];
  timeSpentMinutes: number;
  accuracy: number;
  successRate: number;
  strongTopics: string[];
  weakTopics: string[];
  scoreBreakdown?: Record<string, string>;
  standardResponse?: StandardAiResponse | null;
}

export interface ReadinessComponent {
  name: string;
  score: number;
  weight: number;
  isAssessed?: boolean;
  evidenceSummary?: string;
}

export interface LearningPathItem {
  topic: string;
  resources: string[];
  estimatedHours: number;
  priority: string;
}

export interface ReadinessData {
  score: number;
  label: string;
  components: ReadinessComponent[];
  recommendedCompanies: string[];
  recommendedRoles: string[];
  learningPath: LearningPathItem[];
  skillEvaluations?: SkillEvaluation[];
  missingAssessments?: string[];
  dimensionBreakdown?: DimensionBreakdown[];
  standardResponse?: StandardAiResponse | null;
}

export interface CompanyPreparation {
  company: string;
  notes: string;
}

export interface RoadmapData {
  weakTopics: string[];
  dailyTasks: string[];
  weeklyGoals: string[];
  interviewSchedule: string[];
  companyPreparation: CompanyPreparation[];
  resumeImprovements: string[];
  codingRecommendations: string[];
  dsaRevision: string[];
  aptitudePractice: string[];
  generatedAt?: string;
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: unknown; detail?: unknown; requestId?: unknown } } }).response;
    const msg = typeof resp?.data?.message === 'string' && resp.data.message.trim()
      ? resp.data.message
      : typeof resp?.data?.detail === 'string' && resp.data.detail.trim()
        ? resp.data.detail
        : null;
    const reqId = typeof resp?.data?.requestId === 'string' && resp.data.requestId.trim() ? resp.data.requestId : null;
    if (msg) {
      if (reqId && !msg.includes('Reference ID')) {
        return `${msg} (Reference ID: ${reqId})`;
      }
      return msg;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const base = '/placement';

export async function analyzeResume(
  file: File,
  options?: { onProgress?: (pct: number) => void; signal?: AbortSignal }
): Promise<ResumeResponse> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await apiClient.post<ResumeResponse>(`${base}/resume/analyze`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
      signal: options?.signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && options?.onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(percent);
        }
      },
    });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Resume analysis failed. Please try again.'));
  }
}

export async function getResumeLatest(): Promise<ResumeResponse> {
  try {
    const res = await apiClient.get<ResumeResponse>(`${base}/resume/latest`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your latest resume analysis.'));
  }
}

export async function getResumes(): Promise<ResumeListItem[]> {
  try {
    const res = await apiClient.get<ResumeListItem[]>(`${base}/resumes`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your resumes.'));
  }
}

export async function getDashboard(): Promise<DashboardData> {
  try {
    const res = await apiClient.get<DashboardData>(`${base}/dashboard`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load the placement dashboard.'));
  }
}

export async function createSession(body: CreateSessionBody): Promise<PlacementSession> {
  try {
    const res = await apiClient.post<PlacementSession>(`${base}/sessions`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not start the interview session.'));
  }
}

export async function startSession(id: string): Promise<StartSessionResponse> {
  try {
    const res = await apiClient.post<StartSessionResponse>(`${base}/sessions/${id}/start`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not start the session.'));
  }
}

export async function sendMessage(id: string, content: string): Promise<MessageResponse> {
  try {
    const res = await apiClient.post<MessageResponse>(`${base}/sessions/${id}/messages`, { content });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not send your answer.'));
  }
}

export async function endSession(id: string): Promise<EndSessionResponse> {
  try {
    const res = await apiClient.post<EndSessionResponse>(`${base}/sessions/${id}/end`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not end the session.'));
  }
}

export async function getSessions(): Promise<PlacementSession[]> {
  try {
    const res = await apiClient.get<PlacementSession[]>(`${base}/sessions`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your sessions.'));
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await apiClient.delete(`${base}/sessions/${id}`);
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not delete the session.'));
  }
}

export async function getSession(id: string): Promise<SessionDetail> {
  try {
    const res = await apiClient.get<SessionDetail>(`${base}/sessions/${id}`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load the session transcript.'));
  }
}

export async function createCodingSession(body: CreateCodingBody): Promise<CodingSessionResponse> {
  try {
    const res = await apiClient.post<CodingSessionResponse>(`${base}/coding`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not generate a coding problem.'));
  }
}

export async function runCoding(id: string, body: RunCodingBody): Promise<CodingRunResponse> {
  try {
    const res = await apiClient.post<CodingRunResponse>(`${base}/coding/${id}/run`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not run your code.'));
  }
}

export async function submitCoding(id: string, body: SubmitCodingBody): Promise<CodingSubmitResponse> {
  try {
    const res = await apiClient.post<CodingSubmitResponse>(`${base}/coding/${id}/submit`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not submit your solution.'));
  }
}

export async function getCodingSubmissions(id: string): Promise<SubmissionHistoryItem[]> {
  try {
    const res = await apiClient.get<SubmissionHistoryItem[]>(`${base}/coding/${id}/submissions`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not fetch submission history.'));
  }
}

export async function createAptitudeTest(body: CreateAptitudeBody): Promise<AptitudeTestResponse> {
  try {
    const res = await apiClient.post<AptitudeTestResponse>(`${base}/aptitude`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not generate an aptitude test.'));
  }
}

export async function submitAptitude(id: string, answers: AptitudeAnswer[]): Promise<AptitudeSubmitResponse> {
  try {
    const res = await apiClient.post<AptitudeSubmitResponse>(`${base}/aptitude/${id}/submit`, { answers });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not submit your test.'));
  }
}

export async function getAnalytics(): Promise<AnalyticsData> {
  try {
    const res = await apiClient.get<AnalyticsData>(`${base}/analytics`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your analytics.'));
  }
}

export async function getReadiness(): Promise<ReadinessData> {
  try {
    const res = await apiClient.get<ReadinessData>(`${base}/readiness`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your readiness report.'));
  }
}

export async function getRoadmap(): Promise<RoadmapData> {
  try {
    const res = await apiClient.get<RoadmapData>(`${base}/roadmap`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your roadmap.'));
  }
}

export interface PlacementResetResponse {
  reset: boolean;
  deletedSessions: number;
  deletedResumes: number;
}

export async function resetPlacementActivity(): Promise<PlacementResetResponse> {
  try {
    const res = await apiClient.delete<PlacementResetResponse>(`${base}/reset`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not reset your placement activity.'));
  }
}
