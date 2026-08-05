import apiClient from './apiClient';

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
  confidence: number;
  communication: number;
  grammar: number;
  technicalAccuracy: number;
  structure: number;
  completeness: number;
}

export interface InterviewFeedback {
  score: number;
  scores: FeedbackScores;
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
  idealAnswer: string;
  nextQuestion: string;
  nextDifficulty: string;
  questionCount: number;
  shouldEnd: boolean;
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

export interface CodingProblem {
  title: string;
  statement: string;
  examples: CodingExample[];
  constraints: string;
  difficulty: string;
  topics: string[];
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

export interface CodingSubmitResponse {
  evaluation: CodingEvaluation;
  passed: boolean;
  totalScore: number;
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
}

export interface ReadinessComponent {
  name: string;
  score: number;
  weight: number;
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
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: unknown } } }).response;
    const msg = resp?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const base = '/placement';

export async function analyzeResume(file: File): Promise<ResumeResponse> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await apiClient.post<ResumeResponse>(`${base}/resume/analyze`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
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

export async function submitCoding(id: string, body: SubmitCodingBody): Promise<CodingSubmitResponse> {
  try {
    const res = await apiClient.post<CodingSubmitResponse>(`${base}/coding/${id}/submit`, body);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not submit your solution.'));
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
