import React, { useState } from 'react';
import { Gauge, Building2, Users, GraduationCap, ChevronDown, Clock, BookOpen } from 'lucide-react';
import { getReadiness, ReadinessData, LearningPathItem } from '../../services/placementService';
import { Card, SectionTitle, Pill, Ring, ScoreBar, LoadingSpinner, ErrorBanner, useAsync } from './ui';

const PRIORITY_TONE: Record<string, 'rose' | 'amber' | 'emerald'> = {
  HIGH: 'rose',
  MEDIUM: 'amber',
  LOW: 'emerald',
};

const LearningPathAccordion: React.FC<{ items: LearningPathItem[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(0);
  if (items.length === 0) return <p className="text-sm text-slate-500">No learning path generated yet.</p>;
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-sm font-bold text-violet-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{item.topic}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={11} /> ~{item.estimatedHours}h · {item.resources.length} resources
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={PRIORITY_TONE[item.priority.toUpperCase()] ?? 'slate'}>{item.priority}</Pill>
                <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {isOpen && (
              <div className="phq-fade-in border-t border-slate-800 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <BookOpen size={12} /> Recommended resources
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.resources.map((r, ri) => (
                    <a
                      key={ri}
                      href={r.startsWith('http') ? r : `https://${r}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
                    >
                      <BookOpen size={11} />
                      {r.replace(/^https?:\/\//, '')}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ReadinessView: React.FC = () => {
  const { data, loading, error, run } = useAsync<ReadinessData>(() => getReadiness(), []);

  if (loading) return <LoadingSpinner label="Loading your readiness report..." />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl pt-8">
        <ErrorBanner message={error ?? 'No readiness report available.'} onRetry={run} />
      </div>
    );
  }

  return (
    <div className="phq-fade-in space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center py-10">
          <Ring value={data.score} size={180} stroke={15} gradientId="readyRing" label={`${Math.round(data.score)}%`} sublabel="Readiness" />
          <p className="mt-5 text-xl font-extrabold text-slate-100">{data.label}</p>
          <p className="mt-1 text-center text-xs text-slate-400">Your overall placement readiness score</p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle icon={<Gauge size={16} />} title="Component Breakdown" subtitle="Weighted readiness by area" />
          <div className="space-y-3">
            {data.components.length > 0 ? (
              data.components.map((c) => (
                <div key={c.name} className="flex items-center gap-4">
                  <div className="w-32 shrink-0">
                    <p className="text-sm font-semibold text-slate-300">{c.name}</p>
                    <p className="text-[10px] text-slate-500">weight {c.weight}%</p>
                  </div>
                  <div className="flex-1">
                    <ScoreBar label="" value={c.score} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-200">{Math.round(c.score)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No component data yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={<Building2 size={16} />} title="Recommended Companies" subtitle="Based on your profile & skills" />
          {data.recommendedCompanies.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.recommendedCompanies.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm font-bold text-emerald-300">
                      {c.charAt(0)}
                    </div>
                    <p className="text-sm font-semibold text-slate-100">{c}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No company recommendations yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<Users size={16} />} title="Recommended Roles" />
          <div className="flex flex-wrap gap-2">
            {data.recommendedRoles.length > 0 ? (
              data.recommendedRoles.map((r) => <Pill key={r} tone="violet">{r}</Pill>)
            ) : (
              <p className="text-sm text-slate-500">No role recommendations yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={<GraduationCap size={16} />} title="Learning Path" subtitle="Your personalized upskilling roadmap" />
        <LearningPathAccordion items={data.learningPath} />
      </Card>
    </div>
  );
};

export default ReadinessView;
