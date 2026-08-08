import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Inbox } from 'lucide-react';
import { errorMessage, PlacementView, SessionType } from '../../services/placementService';

export interface PlacementNavProps {
  onNavigate: (view: PlacementView, sessionId?: string) => void;
}

export type PillTone = 'emerald' | 'rose' | 'amber' | 'violet' | 'teal' | 'slate' | 'sky' | 'cyan';

export const PILL_TONES: Record<PillTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  slate: 'bg-tag-bg text-muted border-border',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}> = ({ children, className = '', hover = false }) => (
  <div
    className={`rounded-2xl border border-border bg-white p-5 shadow-card ${
      hover ? 'transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-soft hover:shadow-lg' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const StatChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}> = ({ icon, label, value, accent = false }) => (
  <div
    className={`rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
      accent
        ? 'border-amber-200 bg-amber-50 ring-1 ring-amber-300'
        : 'border-border bg-white hover:border-primary-soft'
    }`}
  >
    <div className="flex items-center gap-2 text-muted">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent ? 'bg-amber-100 text-amber-700' : 'bg-tag-bg text-primary'}`}>
        {icon}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
  </div>
);

export const Pill: React.FC<{
  children: React.ReactNode;
  tone?: PillTone;
  outline?: boolean;
  className?: string;
}> = ({ children, tone = 'slate', outline = false, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
      outline ? 'border-rose-200 text-rose-600' : PILL_TONES[tone]
    } ${className}`}
  >
    {children}
  </span>
);

export const SectionTitle: React.FC<{
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ icon, title, subtitle, right }) => (
  <div className="mb-5 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-tint text-primary ring-1 ring-primary-soft">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

export const LoadingSpinner: React.FC<{ label?: string; className?: string }> = ({ label, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <Loader2 size={32} className="animate-spin text-primary" />
    {label && <p className="text-sm font-medium text-muted">{label}</p>}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
    <div className="flex-1">
      <p className="text-sm font-semibold text-rose-700">Something went wrong</p>
      <p className="mt-0.5 text-sm text-rose-600">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
      >
        Retry
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tag-bg text-muted">
      {icon ?? <Inbox size={26} />}
    </div>
    <p className="mt-2 font-semibold text-foreground">{title}</p>
    {subtitle && <p className="max-w-sm text-sm text-muted">{subtitle}</p>}
  </div>
);

export const Ring: React.FC<{
  value: number;
  size?: number;
  stroke?: number;
  gradientId?: string;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  color?: string;
}> = ({ value, size = 140, stroke = 12, gradientId, label, sublabel, color }) => {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const id = gradientId ?? 'placementRing';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#444CE7" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? `url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tracking-tight text-foreground">{label}</span>
        {sublabel && <span className="mt-1 text-xs font-medium text-muted">{sublabel}</span>}
      </div>
    </div>
  );
};

export const ScoreBar: React.FC<{
  label: string;
  value: number;
  color?: string;
}> = ({ label, value, color = '#444ce7' }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">{label}</span>
        <span className="font-bold text-foreground">{Math.round(pct)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const TYPE_META: Record<string, { label: string; tone: PillTone }> = {
  MOCK: { label: 'Mock Interview', tone: 'violet' },
  ROLE: { label: 'Role-based', tone: 'sky' },
  COMPANY: { label: 'Company', tone: 'cyan' },
  TECHNICAL: { label: 'Technical', tone: 'emerald' },
  HR: { label: 'HR', tone: 'amber' },
  BEHAVIORAL: { label: 'Behavioral', tone: 'rose' },
  PROJECT: { label: 'Project', tone: 'teal' },
  DSA_ORAL: { label: 'DSA Oral', tone: 'emerald' },
  CODING: { label: 'Coding', tone: 'sky' },
  APTITUDE: { label: 'Aptitude', tone: 'violet' },
};

export const TypeBadge: React.FC<{ type: SessionType | string }> = ({ type }) => {
  const meta = TYPE_META[type] ?? { label: type, tone: 'slate' as PillTone };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
};

export const DifficultyChip: React.FC<{ difficulty: string | null }> = ({ difficulty }) => {
  if (!difficulty) return null;
  const tone: PillTone = difficulty === 'EASY' ? 'emerald' : difficulty === 'HARD' ? 'rose' : 'amber';
  return <Pill tone={tone}>{difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}</Pill>;
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    return fnRef.current()
      .then((d) => {
        setData(d);
        return d;
      })
      .catch((err: unknown) => {
        setError(errorMessage(err, 'Something went wrong.'));
        return null;
      })
      .finally(() => setLoading(false));
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, run };
}
