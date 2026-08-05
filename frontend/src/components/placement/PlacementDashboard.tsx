import React from 'react';
import {
  Flame, MessageSquare, Target, Code2, FileText, TrendingUp,
  ListChecks, CheckCircle2, AlertTriangle, Timer, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getDashboard, DashboardData } from '../../services/placementService';
import { Card, StatChip, Pill, SectionTitle, LoadingSpinner, ErrorBanner, Ring, useAsync, PlacementNavProps } from './ui';

const FEEDBACK_TONE: Record<string, string> = {
  INTERVIEW: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  CODING: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  APTITUDE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  MOCK: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 12,
};

const PlacementDashboard: React.FC<PlacementNavProps> = () => {
  const { data, loading, error, run } = useAsync<DashboardData>(() => getDashboard(), []);

  if (loading) return <LoadingSpinner label="Loading your placement dashboard..." />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl pt-8">
        <ErrorBanner message={error ?? 'No dashboard data available.'} onRetry={run} />
      </div>
    );
  }

  const practicePct = data.todayPractice.goal > 0
    ? Math.min(100, Math.round((data.todayPractice.questionsToday / data.todayPractice.goal) * 100))
    : 0;

  return (
    <div className="phq-fade-in space-y-6">
      {/* Readiness + stat chips */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center py-8">
          <div className="relative">
            <Ring value={data.readiness} size={168} stroke={14} label={`${Math.round(data.readiness)}%`} sublabel="Readiness" />
            <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              <Flame size={13} />
              {data.streak} day streak
            </div>
          </div>
          <p className="mt-6 text-lg font-bold text-slate-100">{data.readinessLabel}</p>
          <p className="text-xs text-slate-400">Placement readiness score</p>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          <StatChip icon={<MessageSquare size={16} />} label="Questions answered" value={data.questionsAnswered} />
          <StatChip icon={<Target size={16} />} label="Interviews completed" value={data.interviewsCompleted} />
          <StatChip icon={<Code2 size={16} />} label="Coding problems" value={data.codingProblems} />
          <StatChip icon={<FileText size={16} />} label="Resume score" value={data.resumeScore ? `${data.resumeScore}/100` : '—'} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's practice */}
        <Card>
          <SectionTitle icon={<Timer size={16} />} title="Today's Practice" subtitle="Daily goal tracker" />
          <div className="flex items-end gap-6">
            <div className="relative">
              <Ring value={practicePct} size={104} stroke={10} gradientId="practiceRing" label={`${practicePct}%`} />
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Target size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-100">{data.todayPractice.sessionsToday}</p>
                  <p className="text-xs text-slate-400">Sessions today</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <ListChecks size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-100">{data.todayPractice.questionsToday} / {data.todayPractice.goal}</p>
                  <p className="text-xs text-slate-400">Questions vs goal</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700" style={{ width: `${practicePct}%` }} />
          </div>
        </Card>

        {/* Weak / strong areas */}
        <Card>
          <SectionTitle icon={<Zap size={16} />} title="Skill Areas" subtitle="Where to focus" />
          {data.weakAreas.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                <AlertTriangle size={13} /> Weak areas
              </p>
              <div className="flex flex-wrap gap-2">
                {data.weakAreas.map((w) => <Pill key={w} tone="rose">{w}</Pill>)}
              </div>
            </div>
          )}
          {data.strongAreas.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={13} /> Strong areas
              </p>
              <div className="flex flex-wrap gap-2">
                {data.strongAreas.map((s) => <Pill key={s} tone="emerald">{s}</Pill>)}
              </div>
            </div>
          )}
          {data.weakAreas.length === 0 && data.strongAreas.length === 0 && (
            <p className="text-sm text-slate-500">Complete a few practice sessions to get area insights.</p>
          )}
        </Card>

        {/* Weekly progress */}
        <Card>
          <SectionTitle icon={<TrendingUp size={16} />} title="Weekly Progress" subtitle="Score across the last week" />
          {data.weeklyProgress.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.weeklyProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weeklyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="score" stroke="#34d399" strokeWidth={2.5} fill="url(#weeklyGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">No weekly activity yet. Start practicing to see progress here.</p>
          )}
        </Card>
      </div>

      {/* Recent feedback */}
      <Card>
        <SectionTitle icon={<ListChecks size={16} />} title="Recent Feedback" subtitle="Latest session insights" />
        {data.recentFeedback.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.recentFeedback.slice(0, 6).map((f, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-200">{f.sessionTitle}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${FEEDBACK_TONE[f.type] ?? 'bg-slate-700/40 text-slate-300 border-slate-600/60'}`}>
                    {f.type}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{f.summary}</p>
                <p className="mt-1 text-[10px] font-medium text-slate-500">{new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">No feedback yet. Run your first interview.</p>
        )}
      </Card>
    </div>
  );
};

export default PlacementDashboard;
