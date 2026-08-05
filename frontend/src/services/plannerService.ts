import apiClient from './apiClient';

export interface PlannerEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  priority: string;
  color: string | null;
  location: string | null;
  semester: string | null;
  completed: boolean;
  needsVerification: boolean;
  aiConfidence: number | null;
  daysRemaining: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarUploadResponse {
  importedCount: number;
  duplicatesSkipped: number;
  needsVerification: number;
  semesterStart: string | null;
  semesterEnd: string | null;
  warnings: string[];
  events: PlannerEvent[];
  message: string;
}

export interface FocusItem {
  id: string | null;
  title: string;
  category: string;
  priority: string;
  color: string | null;
  date: string;
  daysRemaining: number;
  estimatedHours: number;
  recommendedHours: number;
  reason: string;
}

export interface TodayFocusResponse {
  date: string;
  focus: FocusItem[];
  recommendations: string[];
}

export interface StudySlot {
  id: string;
  startTime: string | null;
  subject: string;
  hours: number;
  sessionType: string;
  completed: boolean;
}

export interface StudyDay {
  date: string;
  label: string;
  totalHours: number;
  items: StudySlot[];
}

export interface StudyPlanResponse {
  generatedAt: string;
  message: string;
  days: StudyDay[];
}

export interface DailyScheduleResponse {
  date: string;
  totalHours: number;
  items: StudySlot[];
}

export interface SubjectProgress {
  subject: string;
  plannedHours: number;
  completedHours: number;
  percent: number;
}

export interface PlannerStats {
  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  needsVerification: number;
  byCategory: Record<string, number>;
  studyProgress: SubjectProgress[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  category?: string;
  priority?: string;
  color?: string;
  location?: string | null;
  semester?: string | null;
  completed?: boolean;
  needsVerification?: boolean;
}

const base = '/planner';

export async function uploadCalendar(file: File): Promise<CalendarUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<CalendarUploadResponse>(`${base}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return res.data;
}

export async function getEvents(category?: string, status?: string, q?: string): Promise<PlannerEvent[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const res = await apiClient.get<PlannerEvent[]>(`${base}/events`, { params });
  return res.data;
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<PlannerEvent> {
  const res = await apiClient.patch<PlannerEvent>(`${base}/events/${id}`, input);
  return res.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await apiClient.delete(`${base}/events/${id}`);
}

export async function clearPlanner(): Promise<void> {
  await apiClient.delete(`${base}/clear`);
}

export async function getTodayFocus(): Promise<TodayFocusResponse> {
  const res = await apiClient.get<TodayFocusResponse>(`${base}/today`);
  return res.data;
}

export async function getUpcoming(range?: string): Promise<PlannerEvent[]> {
  const params = range ? { range } : undefined;
  const res = await apiClient.get<PlannerEvent[]>(`${base}/upcoming`, { params });
  return res.data;
}

export async function getStats(): Promise<PlannerStats> {
  const res = await apiClient.get<PlannerStats>(`${base}/stats`);
  return res.data;
}

export async function getStudyPlan(): Promise<StudyPlanResponse> {
  const res = await apiClient.get<StudyPlanResponse>(`${base}/study-plan`);
  return res.data;
}

export async function generateStudyPlan(days?: number): Promise<StudyPlanResponse> {
  const res = await apiClient.post<StudyPlanResponse>(`${base}/study-plan/generate`, { days });
  return res.data;
}

export async function getSchedule(date?: string): Promise<DailyScheduleResponse> {
  const params = date ? { date } : undefined;
  const res = await apiClient.get<DailyScheduleResponse>(`${base}/schedule`, { params });
  return res.data;
}

export async function markSessionCompleted(sessionId: string, completed: boolean): Promise<StudySlot> {
  const res = await apiClient.patch<StudySlot>(`${base}/schedule/sessions/${sessionId}`, null, {
    params: { completed },
  });
  return res.data;
}

export const CATEGORY_META: Record<string, { label: string; color: string; dot: string }> = {
  EXAM: { label: 'Exam', color: '#ef4444', dot: 'bg-red-500' },
  INTERNAL_EXAM: { label: 'Internal Exam', color: '#ef4444', dot: 'bg-red-500' },
  EXTERNAL_EXAM: { label: 'External Exam', color: '#ef4444', dot: 'bg-red-500' },
  PRACTICAL_EXAM: { label: 'Practical Exam', color: '#ef4444', dot: 'bg-red-500' },
  ASSIGNMENT: { label: 'Assignment', color: '#f59e0b', dot: 'bg-amber-500' },
  SUBMISSION: { label: 'Submission', color: '#f59e0b', dot: 'bg-amber-500' },
  PROJECT: { label: 'Project', color: '#f97316', dot: 'bg-orange-500' },
  HACKATHON: { label: 'Hackathon', color: '#f97316', dot: 'bg-orange-500' },
  WORKSHOP: { label: 'Workshop', color: '#3b82f6', dot: 'bg-blue-500' },
  SEMINAR: { label: 'Seminar', color: '#3b82f6', dot: 'bg-blue-500' },
  HOLIDAY: { label: 'Holiday', color: '#22c55e', dot: 'bg-green-500' },
  FESTIVAL: { label: 'Festival', color: '#22c55e', dot: 'bg-green-500' },
  VACATION: { label: 'Vacation', color: '#22c55e', dot: 'bg-green-500' },
  SPORTS: { label: 'Sports Event', color: '#10b981', dot: 'bg-emerald-500' },
  PLACEMENT: { label: 'Placement', color: '#8b5cf6', dot: 'bg-violet-500' },
  INDUSTRIAL_VISIT: { label: 'Industrial Visit', color: '#3b82f6', dot: 'bg-blue-500' },
  ORIENTATION: { label: 'Orientation', color: '#3b82f6', dot: 'bg-blue-500' },
  CONVOCATION: { label: 'Convocation', color: '#ec4899', dot: 'bg-pink-500' },
  CLASS: { label: 'Class', color: '#6366f1', dot: 'bg-indigo-500' },
  OTHER: { label: 'Other', color: '#6366f1', dot: 'bg-indigo-500' },
};

export function categoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category ?? 'Other';
}

export function priorityLabel(priority: string): string {
  return (priority ?? 'MEDIUM').charAt(0) + (priority ?? 'MEDIUM').slice(1).toLowerCase();
}

export function countdown(days: number | null): string {
  if (days == null) return '';
  if (days < 0) return 'Completed';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days left`;
}
