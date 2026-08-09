import React from 'react';
import {
  Map, ListChecks, Target, CalendarDays, Building2, FileText, Code2, GitBranch, BrainCircuit, AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { getRoadmap, RoadmapData } from '../../services/placementService';
import { Card, SectionTitle, Pill, LoadingSpinner, ErrorBanner, useAsync } from './ui';

function formatGeneratedAt(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const Checklist: React.FC<{ items: string[] }> = ({ items }) => {
  const unique = Array.from(new Set(items.filter((i) => i && i.trim())));
  if (unique.length === 0) return <p className="text-sm text-muted">Nothing planned yet.</p>;
  return (
    <ul className="space-y-2">
      {unique.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

const RoadmapView: React.FC = () => {
  const { data, loading, error, run } = useAsync<RoadmapData>(() => getRoadmap(), []);

  if (loading) return <LoadingSpinner label="Loading your roadmap..." />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl pt-8">
        <ErrorBanner message={error ?? 'No roadmap available.'} onRetry={run} />
      </div>
    );
  }

  return (
    <div className="phq-fade-in space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
          <Map size={24} className="text-emerald-600" />
          Placement Roadmap
        </h2>
        <p className="mt-1 text-sm text-muted">Your week-by-week action plan to interview readiness.</p>
        {data.generatedAt && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary-soft bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
            <RefreshCw size={12} />
            Updated based on your latest progress · {formatGeneratedAt(data.generatedAt)}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle icon={<AlertTriangle size={16} />} title="Focus Areas" subtitle="Weak topics to attack first" />
          <div className="flex flex-wrap gap-2">
            {data.weakTopics.length > 0 ? (
              data.weakTopics.map((t) => <Pill key={t} tone="rose">{t}</Pill>)
            ) : (
              <p className="text-sm text-muted">No weak topics flagged.</p>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<ListChecks size={16} />} title="Daily Tasks" />
          <Checklist items={data.dailyTasks} />
        </Card>

        <Card>
          <SectionTitle icon={<Target size={16} />} title="Weekly Goals" />
          <Checklist items={data.weeklyGoals} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle icon={<CalendarDays size={16} />} title="Interview Schedule" subtitle="Timeline of upcoming milestones" />
          {data.interviewSchedule.length > 0 ? (
            <div className="relative space-y-4 border-l border-border pl-5">
              {data.interviewSchedule.map((step, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-emerald-200 bg-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  </span>
                  <p className="text-sm text-foreground">{step}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No interview milestones yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<Building2 size={16} />} title="Company Preparation" subtitle="Target companies & notes" />
          {data.companyPreparation.length > 0 ? (
            <div className="space-y-3">
              {data.companyPreparation.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-white p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Building2 size={14} className="text-emerald-600" />
                    {c.company}
                  </p>
                  <p className="mt-1 text-sm text-muted">{c.notes}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No company prep notes yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<FileText size={16} />} title="Resume Improvements" />
          <Checklist items={data.resumeImprovements} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle icon={<Code2 size={16} />} title="Coding Recommendations" />
          <Checklist items={data.codingRecommendations} />
        </Card>

        <Card>
          <SectionTitle icon={<GitBranch size={16} />} title="DSA Revision" />
          <Checklist items={data.dsaRevision} />
        </Card>

        <Card>
          <SectionTitle icon={<BrainCircuit size={16} />} title="Aptitude Practice" />
          <Checklist items={data.aptitudePractice} />
        </Card>
      </div>
    </div>
  );
};

export default RoadmapView;
