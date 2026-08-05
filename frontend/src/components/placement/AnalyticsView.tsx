import React, { useState } from 'react';
import { BarChart3, TrendingUp, Timer, Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAnalytics, AnalyticsData } from '../../services/placementService';
import { Card, StatChip, SectionTitle, Pill, LoadingSpinner, ErrorBanner, useAsync } from './ui';

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 12,
};

const barColor = (score: number) => (score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#fb7185');

type RangeKey = 'daily' | 'weekly' | 'monthly';

const AnalyticsView: React.FC = () => {
  const { data, loading, error, run } = useAsync<AnalyticsData>(() => getAnalytics(), []);
  const [range, setRange] = useState<RangeKey>('weekly');

  if (loading) return <LoadingSpinner label="Loading your analytics..." />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl pt-8">
        <ErrorBanner message={error ?? 'No analytics available.'} onRetry={run} />
      </div>
    );
  }

  const radarData = [
    { subject: 'Technical', value: data.technical },
    { subject: 'HR', value: data.hr },
    { subject: 'Communication', value: data.communication },
    { subject: 'Coding', value: data.coding },
    { subject: 'DSA', value: data.dsa },
    { subject: 'Aptitude', value: data.aptitude },
    { subject: 'Resume', value: data.resume },
  ];

  const rangeData = data[range] ?? [];

  return (
    <div className="phq-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-100">Performance Analytics</h2>
        <p className="mt-1 text-sm text-slate-400">Track your growth across every placement dimension.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatChip icon={<Target size={16} />} label="Technical" value={data.technical} />
        <StatChip icon={<Target size={16} />} label="HR" value={data.hr} />
        <StatChip icon={<Target size={16} />} label="Communication" value={data.communication} />
        <StatChip icon={<Target size={16} />} label="Coding" value={data.coding} />
        <StatChip icon={<Target size={16} />} label="DSA" value={data.dsa} />
        <StatChip icon={<Target size={16} />} label="Aptitude" value={data.aptitude} />
        <StatChip icon={<Target size={16} />} label="Resume" value={data.resume} />
        <StatChip icon={<TrendingUp size={16} />} label="Overall" value={`${data.overallReadiness}%`} accent={data.overallReadiness < 50} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={<BarChart3 size={16} />} title="Dimension Radar" subtitle="Score across all 7 dimensions" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle
            icon={<TrendingUp size={16} />}
            title="Score Trend"
            subtitle="Daily, weekly or monthly"
            right={
              <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                {(['daily', 'weekly', 'monthly'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1 text-xs font-bold capitalize transition-colors ${
                      range === r ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            }
          />
          {rangeData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rangeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {rangeData.map((d, i) => (
                      <Cell key={i} fill={barColor(d.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">No trend data available yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <StatChip icon={<Timer size={16} />} label="Time spent" value={`${Math.round(data.timeSpentMinutes)} min`} />
        <StatChip icon={<Target size={16} />} label="Accuracy" value={`${Math.round(data.accuracy)}%`} />
        <StatChip icon={<TrendingUp size={16} />} label="Success rate" value={`${Math.round(data.successRate)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={<CheckCircle2 size={16} />} title="Strong Topics" />
          <div className="flex flex-wrap gap-2">
            {data.strongTopics.length > 0 ? (
              data.strongTopics.map((t) => <Pill key={t} tone="emerald">{t}</Pill>)
            ) : (
              <p className="text-sm text-slate-500">No strong topics identified yet.</p>
            )}
          </div>
        </Card>
        <Card>
          <SectionTitle icon={<AlertTriangle size={16} />} title="Weak Topics" />
          <div className="flex flex-wrap gap-2">
            {data.weakTopics.length > 0 ? (
              data.weakTopics.map((t) => <Pill key={t} tone="rose">{t}</Pill>)
            ) : (
              <p className="text-sm text-slate-500">No weak topics identified — impressive!</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsView;
