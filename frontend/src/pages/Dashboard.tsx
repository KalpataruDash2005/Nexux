import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile } from '../services/profileService';
import { StudentProfileDto } from '../types/profile';
import { getWorkspaces, Workspace } from '../services/workspaceService';
import { getTaskSummary, TaskSummary } from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import {
  FolderOpen, ListChecks, CheckCircle2, AlertTriangle,
  TrendingUp, Sparkles, ArrowRight, CalendarDays,
} from 'lucide-react';
import PlacementDashboard from '../components/placement/PlacementDashboard';
import WelcomePopup from '../components/tasks/WelcomePopup';
import { StatCard } from '../components/dashboard/StatCard';
import QuickActions from '../components/dashboard/QuickActions';
import RecentWorkspaces from '../components/dashboard/RecentWorkspaces';
import { StatCardSkeleton } from '../components/dashboard/Skeleton';

const EMPTY_SUMMARY: TaskSummary = { total: 0, completed: 0, pending: 0, overdue: 0 };

const Dashboard: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfileDto | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [summary, setSummary] = useState<TaskSummary>(EMPTY_SUMMARY);
  const [loadingStats, setLoadingStats] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getMyProfile().then(setProfile).catch(console.error);
    getWorkspaces()
      .then(setWorkspaces)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
    getTaskSummary()
      .then((s) => setSummary(s ?? EMPTY_SUMMARY))
      .catch(() => setSummary(EMPTY_SUMMARY));
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const displayName = () => {
    if (profile?.firstName) {
      return `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`;
    }
    if (user?.email) {
      return user.email.split('@')[0] || 'there';
    }
    return 'there';
  };

  const initials = () => {
    const name = displayName().trim();
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase() || '?';
  };

  const completionRate =
    summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  const fullDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const clock = currentTime.toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="h-full overflow-y-auto bg-background font-sans">
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Hero */}
          <header className="relative overflow-hidden rounded-3xl border border-border bg-white p-6 shadow-card sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary-tint blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-primary-background blur-3xl" />
            <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-muted">
                  <CalendarDays size={15} className="text-primary" />
                  <span className="tracking-wide uppercase">{fullDate}</span>
                </div>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  {getGreeting()},{' '}
                  <span className="bg-gradient-to-r from-primary to-primary-soft bg-clip-text text-transparent">
                    {displayName()}
                  </span>
                </h1>
                <p className="mt-2 text-sm text-muted">
                  {summary.overdue > 0
                    ? `${summary.overdue} overdue task${summary.overdue === 1 ? '' : 's'} — let's get you back on track.`
                    : 'Here’s what’s happening with your learning today.'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="font-mono text-xl font-bold tracking-widest text-foreground tabular-nums">
                    {clock}
                  </span>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-600 text-sm font-bold text-white shadow-md shadow-primary/25">
                  {initials()}
                </div>
              </div>
            </div>
          </header>

          {/* KPI Row */}
          {loadingStats ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                to="/workspaces"
                icon={<FolderOpen size={20} />}
                label="Workspaces"
                value={workspaces.length}
                hint={workspaces.length === 1 ? 'Active learning space' : 'Active learning spaces'}
                tileClassName="bg-sky-100 text-sky-700"
              />
              <StatCard
                to="/tasks"
                icon={<ListChecks size={20} />}
                label="Total Tasks"
                value={summary.total}
                hint="Across all projects"
                tileClassName="bg-primary-tint text-primary"
              />
              <StatCard
                to="/tasks"
                icon={<CheckCircle2 size={20} />}
                label="Completion Rate"
                value={`${completionRate}%`}
                hint={`${summary.completed} of ${summary.total} tasks done`}
                tileClassName="bg-emerald-100 text-emerald-700"
              />
              <StatCard
                to="/tasks"
                icon={<AlertTriangle size={20} />}
                label="Overdue Tasks"
                value={summary.overdue}
                hint={summary.overdue > 0 ? 'Needs attention' : 'All caught up'}
                tileClassName="bg-rose-100 text-rose-700"
                valueClassName={summary.overdue > 0 ? 'text-error' : 'text-foreground'}
              />
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentWorkspaces workspaces={workspaces} loading={loadingStats} />
            </div>
            <QuickActions />
          </div>

          {/* Career Readiness */}
          <section className="animate-[fadeInUp_0.5s_ease-out]">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Career Readiness</h2>
                  <p className="text-sm text-muted">Your placement prep at a glance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/placement')}
                className="flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                <Sparkles size={15} />
                Open placement
                <ArrowRight size={15} />
              </button>
            </div>
            <PlacementDashboard
              onNavigate={(view, sessionId) => {
                navigate(`/placement?view=${view}${sessionId ? `&session=${sessionId}` : ''}`);
              }}
            />
          </section>
        </div>
      </main>
      <WelcomePopup onOpenTasks={() => navigate('/tasks')} />
    </div>
  );
};

export default Dashboard;