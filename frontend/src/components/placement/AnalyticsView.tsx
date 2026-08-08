import React, { useState } from 'react';
import { BarChart3, TrendingUp, Timer, Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAnalytics, AnalyticsData } from '../../services/placementService';
import { Card, StatChip, SectionTitle, Pill, LoadingSpinner, ErrorBanner, useAsync } from './ui';

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  color: '#111827',
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
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Performance Analytics</h2>
        <p className="mt-1 text-sm text-muted">Track your growth across every placement dimension.</p>
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
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Radar dataKey="value" stroke="#444ce7" fill="#444ce7" fillOpacity={0.15} />
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
              <div className="flex gap-1 rounded-lg border border-border bg-tag-bg p-1">
                {(['daily', 'weekly', 'monthly'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1 text-xs font-bold capitalize transition-colors ${
                      range === r ? 'bg-primary-soft text-primary' : 'text-muted hover:text-foreground'
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#e5e7eb" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis stroke="#e5e7eb" tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(68,76,231,0.06)' }} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {rangeData.map((d, i) => (
                      <Cell key={i} fill={barColor(d.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted">No trend data available yet.</p>
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
              <p className="text-sm text-muted">No strong topics identified yet.</p>
            )}
          </div>
        </Card>
        <Card>
          <SectionTitle icon={<AlertTriangle size={16} />} title="Weak Topics" />
          <div className="flex flex-wrap gap-2">
            {data.weakTopics.length > 0 ? (
              data.weakTopics.map((t) => <Pill key={t} tone="rose">{t}</Pill>)
            ) : (
              <p className="text-sm text-muted">No weak topics identified — impressive!</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsView;
