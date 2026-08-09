import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import {
  Bot, CheckSquare, Plus, Loader2, Trash2, Sparkles, CalendarDays,
  ChevronLeft, ChevronRight, ListTodo, Inbox,
} from 'lucide-react';
import './../components/tasks/tasks.css';
import {
  Task, TaskStatus, statusLabel, statusTextClass, getTasks, createTask, updateTask, deleteTask,
  getTaskSummary, TaskSummary, errorMessage, toDateKey,
} from '../services/taskService';
import AiPlanModal from '../components/tasks/AiPlanModal';
import { assistantBus } from '../services/assistantBus';

interface FormState {
  title: string;
  deadline: string;
}

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary>({ total: 0, completed: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ title: '', deadline: '' });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [planOpen, setPlanOpen] = useState(false);

  function toDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, summ] = await Promise.all([getTasks(), getTaskSummary()]);
      setTasks(list);
      setSummary(summ);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your tasks.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return assistantBus.onTasksChanged(() => {
      load();
    });
  }, [load]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = toDateKey(task.deadline);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const selectedKey = toDayKey(selectedDate);
  const selectedTasks = tasksByDate.get(selectedKey) ?? [];
  const sortedSelected = [...selectedTasks].sort((a, b) =>
    a.status === 'COMPLETED' ? 1 : b.status === 'COMPLETED' ? -1 : 0
  );

  const askAssistantFor = (task: Task) => {
    assistantBus.requestOpen({ taskId: task.id, taskTitle: task.title });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (summary.total >= 500) {
      setError('You have reached the maximum of 500 tasks. Delete some tasks before adding more.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createTask(form.title.trim(), form.deadline || undefined);
      setTasks((prev) => [...prev, created]);
      setSummary((prev) => ({ ...prev, total: prev.total + 1, pending: prev.pending + 1 }));
      setForm({ title: '', deadline: '' });
    } catch (err) {
      setError(errorMessage(err, 'Could not create the task.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: Task) => {
    const next: TaskStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    const completedDelta = next === 'COMPLETED' ? 1 : -1;
    const pendingDelta = next === 'PENDING' ? 1 : -1;
    setTogglingId(task.id);
    setError(null);
    try {
      const updated = await updateTask(task.id, { status: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      setSummary((prev) => ({
        ...prev,
        completed: Math.max(0, prev.completed + completedDelta),
        pending: Math.max(0, prev.pending + pendingDelta),
      }));
    } catch (err) {
      setError(errorMessage(err, 'Could not update the task.'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string, status: TaskStatus) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSummary((prev) => ({
        ...prev,
        total: prev.total - 1,
        completed: status === 'COMPLETED' ? prev.completed - 1 : prev.completed,
        pending: status === 'PENDING' ? prev.pending - 1 : prev.pending,
      }));
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the task.'));
    } finally {
      setDeletingId(null);
    }
  };

  const isToday = (date: Date) => toDayKey(date) === toDayKey(new Date());

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'COMPLETED' ? 1 : -1;
        return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
      }),
    [tasks]
  );

  const statCards = [
    { label: 'Total Tasks', value: summary.total, color: 'text-foreground', icon: <ListTodo size={18} className="text-primary" /> },
    { label: 'Completed', value: summary.completed, color: 'text-emerald-600', icon: <CheckSquare size={18} className="text-primary" /> },
    { label: 'Pending', value: summary.pending, color: 'text-amber-600', icon: <Plus size={18} className="text-primary" /> },
    { label: 'Overdue', value: summary.overdue, color: summary.overdue > 0 ? 'text-rose-600' : 'text-foreground', icon: <CalendarDays size={18} className="text-primary" /> },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="z-20 shrink-0 border-b border-border bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-500 text-white shadow-lg shadow-violet-500/30">
              <CheckSquare size={18} />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight text-foreground">Task Manager</p>
              <p className="text-xs text-muted">Plan your deadlines, stay on track</p>
            </div>
          </div>

          <button
            onClick={() => setPlanOpen(true)}
            disabled={summary.pending === 0}
            title="Generate an AI plan for your pending tasks"
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary-tint hover:text-primary-hover disabled:opacity-50"
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">AI Task Planner</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-surface-tint p-4">
                <div className="flex items-center gap-2 text-muted">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">{s.icon}</div>
                  <span className="text-[11px] font-bold uppercase tracking-wider">{s.label}</span>
                </div>
                <p className={`mt-2 text-3xl font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Add + List */}
            <div className="space-y-6 lg:col-span-2">
              {/* Add form */}
              <form
                onSubmit={handleCreate}
                className="rounded-2xl border border-border bg-white p-5 shadow-card"
              >
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Add a new task</h3>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    maxLength={255}
                    placeholder="What do you need to do?"
                    className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="datetime-local"
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={saving || !form.title.trim()}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-primary-hover disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Add
                  </button>
                </div>
              </form>

              {/* Task list */}
              <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Your Tasks</h3>
                  <span className="rounded-full bg-tag-bg px-2.5 py-0.5 text-xs font-semibold text-muted">
                    {summary.total} total
                  </span>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-14">
                    <Loader2 size={28} className="animate-spin text-primary" />
                    <p className="text-sm text-muted">Loading tasks...</p>
                  </div>
                ) : sortedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Inbox size={26} />
                    </div>
                    <p className="mt-2 font-semibold text-foreground">No tasks yet</p>
                    <p className="max-w-sm text-sm text-muted">
                      Add a task above to get started. The AI Task Planner will help you stay on schedule.
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                    {sortedTasks.map((task) => {
                      const overdue = task.status === 'PENDING' && !!task.deadline && new Date(task.deadline) < new Date();
                      return (
                        <li
                          key={task.id}
                          className={`group flex items-center gap-3 rounded-xl border p-3 shadow-card transition-colors ${
                            overdue
                              ? 'border-rose-300 bg-rose-50'
                              : 'border-border bg-white hover:border-primary-soft'
                          }`}
                        >
                          <button
                            onClick={() => handleToggle(task)}
                            disabled={togglingId === task.id}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all disabled:opacity-50 ${
                              task.status === 'COMPLETED'
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-gray-300 text-transparent hover:border-emerald-500'
                            }`}
                            aria-label={task.status === 'COMPLETED' ? 'Mark as pending' : 'Mark as completed'}
                          >
                            {togglingId === task.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckSquare size={14} />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`truncate text-sm font-medium ${
                                  task.status === 'COMPLETED' ? 'text-muted line-through' : 'text-foreground'
                                }`}
                              >
                                {task.title}
                              </p>
                              {task.parentTaskId && (
                                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">chunk</span>
                              )}
                              {task.status !== 'PENDING' && task.status !== 'COMPLETED' && (
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTextClass(task.status)}`}>
                                  {statusLabel(task.status)}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs ${overdue ? 'font-semibold text-rose-600' : 'text-muted'}`}>
                              {task.deadline
                                ? new Date(task.deadline).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'No deadline'}
                              {overdue ? ' • Overdue' : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => askAssistantFor(task)}
                            title={`Ask the AI assistant about "${task.title}"`}
                            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <Bot size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id, task.status)}
                            disabled={deletingId === task.id}
                            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                            aria-label="Delete task"
                          >
                            {deletingId === task.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Calendar */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Calendar</h3>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="text-xs font-semibold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-colors"
                >
                  Today
                </button>
              </div>

              <div className="tasks-cal">
                <Calendar
                  value={selectedDate}
                  onChange={(value) => {
                    if (value instanceof Date) setSelectedDate(value);
                  }}
                  onActiveStartDateChange={({ activeStartDate }) => {
                    if (activeStartDate) setSelectedDate(activeStartDate);
                  }}
                  prevLabel={<ChevronLeft size={16} />}
                  nextLabel={<ChevronRight size={16} />}
                  prev2Label={null}
                  next2Label={null}
                  tileContent={({ date }) => {
                    const key = toDayKey(date);
                    const dayTasks = tasksByDate.get(key);
                    if (!dayTasks || dayTasks.length === 0) return null;
                    const overdueCount = dayTasks.filter((t) => t.status === 'PENDING' && !!t.deadline && new Date(t.deadline) < new Date()).length;
                    return (
                      <div className="mt-1 flex justify-center gap-0.5">
                        {dayTasks.length > 0 && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: overdueCount > 0 ? '#f43f5e' : '#34d399' }}
                          />
                        )}
                      </div>
                    );
                  }}
                  tileClassName={({ date }) => (isToday(date) ? 'react-calendar__tile--now' : undefined)}
                />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                {sortedSelected.length === 0 ? (
                  <p className="py-2 text-sm text-muted">No tasks on this day.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {sortedSelected.map((task) => (
                      <li
                        key={task.id}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                          task.status === 'COMPLETED' ? 'border-border opacity-60' : 'border-border'
                        }`}
                      >
                        <span
                          className={`min-w-0 truncate text-sm font-medium ${
                            task.status === 'COMPLETED' ? 'text-muted line-through' : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span
                          className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTextClass(task.status)}`}
                        >
                          {statusLabel(task.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AiPlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
};

export default Tasks;
