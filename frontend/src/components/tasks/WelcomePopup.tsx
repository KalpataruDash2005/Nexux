import React, { useEffect, useState } from 'react';
import { PartyPopper, CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react';
import { getTaskSummary, TaskSummary } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';

const STORAGE_KEY = 'careeros_welcome_seen_v1';

interface Props {
  onOpenTasks?: () => void;
}

const WelcomePopup: React.FC<Props> = ({ onOpenTasks }) => {
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    getTaskSummary()
      .then((s) => {
        setSummary(s);
        setVisible(true);
        localStorage.setItem(STORAGE_KEY, '1');
      })
      .catch(() => {
        /* silently ignore summary failures */
      });
  }, []);

  const displayName = () => {
    if (user?.firstName) return user.firstName;
    if (user?.email) return user.email.split('@')[0] || 'there';
    return 'there';
  };

  if (!visible || !summary) return null;

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-2xl shadow-black/10 animate-[fadeInUp_0.3s_ease-out]">
        <button
          onClick={() => setVisible(false)}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
          aria-label="Close welcome"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-500 text-white shadow-lg shadow-violet-500/30">
            <PartyPopper size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              Welcome Back, {displayName()}!
            </h2>
            <p className="text-sm text-muted">Here's your task summary.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface-tint p-5">
          <p className="text-sm leading-relaxed text-foreground">
            You have <span className="font-bold text-foreground">{plural(summary.total, 'task')}</span> —{' '}
            <span className="font-semibold text-emerald-600">{plural(summary.completed, 'completed')}</span>{' '}
            and{' '}
            <span className="font-semibold text-amber-600">{plural(summary.pending, 'pending')}</span>.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white p-3">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span className="text-lg font-extrabold text-foreground">{summary.completed}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Done</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white p-3">
              <Clock size={18} className="text-amber-600" />
              <span className="text-lg font-extrabold text-foreground">{summary.pending}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Pending</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white p-3">
              <AlertTriangle size={18} className="text-rose-600" />
              <span className="text-lg font-extrabold text-foreground">{summary.overdue}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Overdue</span>
            </div>
          </div>

          {summary.overdue > 0 && (
            <p className="mt-4 text-xs text-rose-700">
              Heads up: you have {plural(summary.overdue, 'overdue task')}. Consider catching up today!
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setVisible(false)}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-slate-100"
          >
            Got it
          </button>
          {onOpenTasks && (
            <button
              onClick={() => {
                setVisible(false);
                onOpenTasks();
              }}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover"
            >
              Open Tasks
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup;
