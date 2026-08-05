import apiClient from './apiClient';

export type TaskStatus = 'PENDING' | 'COMPLETED';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  createdAt: string;
}

export interface TaskSummary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface AiPlanResponse {
  plan: string;
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

const base = '/tasks';

export async function getTasks(status?: TaskStatus): Promise<Task[]> {
  try {
    const res = await apiClient.get<Task[]>(`${base}`, {
      params: status ? { status } : undefined,
    });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your tasks.'));
  }
}

export async function createTask(title: string, deadline?: string): Promise<Task> {
  try {
    const res = await apiClient.post<Task>(`${base}`, { title, deadline: deadline || null });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not create the task.'));
  }
}

export async function updateTask(
  id: string,
  input: { title?: string; status?: TaskStatus; deadline?: string | null }
): Promise<Task> {
  try {
    const res = await apiClient.patch<Task>(`${base}/${id}`, input);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not update the task.'));
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await apiClient.delete(`${base}/${id}`);
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not delete the task.'));
  }
}

export async function getTaskSummary(): Promise<TaskSummary> {
  try {
    const res = await apiClient.get<TaskSummary>(`${base}/summary`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not load your task summary.'));
  }
}

export async function generateAiPlan(): Promise<AiPlanResponse> {
  try {
    const res = await apiClient.post<AiPlanResponse>(`${base}/ai-plan`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, 'Could not generate an AI plan.'));
  }
}

export function formatTaskDate(value: string | null | undefined): string {
  if (!value) return 'No deadline';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
