import React from 'react';
import { Link } from 'react-router-dom';
import {
  ListChecks, TrendingUp, FileText, FolderOpen, Sparkles, ChevronRight,
} from 'lucide-react';
import { assistantBus } from '../../services/assistantBus';

interface ActionItem {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  tileClassName?: string;
  to?: string;
  onClick?: () => void;
}

const ACTIONS: ActionItem[] = [
  {
    icon: <ListChecks size={18} />,
    label: 'Open Tasks',
    subtitle: 'Plan & track your workload',
    tileClassName: 'bg-primary-tint text-primary',
    to: '/tasks',
  },
  {
    icon: <TrendingUp size={18} />,
    label: 'Career Readiness',
    subtitle: 'Interviews, coding & aptitude',
    tileClassName: 'bg-emerald-100 text-emerald-700',
    to: '/placement',
  },
  {
    icon: <FileText size={18} />,
    label: 'Resume Analyzer',
    subtitle: 'Score & improve your resume',
    tileClassName: 'bg-violet-100 text-violet-700',
    to: '/placement?view=resume',
  },
  {
    icon: <Sparkles size={18} />,
    label: 'Ask AI Assistant',
    subtitle: 'Get instant guidance',
    tileClassName: 'bg-amber-100 text-amber-700',
    onClick: () => assistantBus.requestOpen({ taskId: null, taskTitle: null }),
  },
  {
    icon: <FolderOpen size={18} />,
    label: 'My Workspaces',
    subtitle: 'Your learning spaces',
    tileClassName: 'bg-sky-100 text-sky-700',
    to: '/workspaces',
  },
];

const QuickActions: React.FC = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-bold text-foreground">Quick Actions</h2>
      <span className="rounded-full bg-tag-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        Shortcuts
      </span>
    </div>
    <div className="space-y-2">
      {ACTIONS.map((action) => {
        const content = (
          <>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 ${action.tileClassName}`}>
              {action.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{action.label}</p>
              {action.subtitle && <p className="truncate text-xs text-muted">{action.subtitle}</p>}
            </div>
            <ChevronRight size={16} className="shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
          </>
        );
        const rowClassName = `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200`;
        if (action.to) {
          return (
            <Link key={action.label} to={action.to} className={`${rowClassName} hover:bg-surface-tint`}>
              {content}
            </Link>
          );
        }
        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`${rowClassName} w-full text-left hover:bg-surface-tint`}
          >
            {content}
          </button>
        );
      })}
    </div>
  </div>
);

export default QuickActions;