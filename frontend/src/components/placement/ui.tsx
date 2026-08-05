import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Inbox } from 'lucide-react';
import { errorMessage, PlacementView, SessionType } from '../../services/placementService';

export interface PlacementNavProps {
  onNavigate: (view: PlacementView, sessionId?: string) => void;
}

export type PillTone = 'emerald' | 'rose' | 'amber' | 'violet' | 'teal' | 'slate' | 'sky' | 'cyan';

export const PILL_TONES: Record<PillTone, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  teal: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  slate: 'bg-slate-700/40 text-slate-300 border-slate-600/60',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}> = ({ children, className = '', hover = false }) => (
  <div
    className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/20 ${
      hover ? 'transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-xl hover:shadow-black/30' : ''
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
    className={`rounded-2xl border px-4 py-3.5 backdrop-blur-md transition-all duration-300 ${
      accent
        ? 'border-amber-500/30 bg-amber-500/10 ring-1 ring-amber-400/30'
        : 'border-slate-700/60 bg-slate-900/70 hover:border-slate-600'
    }`}
  >
    <div className="flex items-center gap-2 text-slate-400">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800 text-emerald-400'}`}>
        {icon}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-100">{value}</p>
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
      outline ? 'border-rose-500/40 text-rose-300' : PILL_TONES[tone]
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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-emerald-500/20 text-emerald-400 ring-1 ring-violet-500/20">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

export const LoadingSpinner: React.FC<{ label?: string; className?: string }> = ({ label, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <Loader2 size={32} className="animate-spin text-emerald-400" />
    {label && <p className="text-sm font-medium text-slate-400">{label}</p>}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-400" />
    <div className="flex-1">
      <p className="text-sm font-semibold text-rose-200">Something went wrong</p>
      <p className="mt-0.5 text-sm text-rose-300/80">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-500/20"
      >
        Retry
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
      {icon ?? <Inbox size={26} />}
    </div>
    <p className="mt-2 font-semibold text-slate-300">{title}</p>
    {subtitle && <p className="max-w-sm text-sm text-slate-500">{subtitle}</p>}
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
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1e293b"
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
        <span className="text-3xl font-extrabold tracking-tight text-slate-100">{label}</span>
        {sublabel && <span className="mt-1 text-xs font-medium text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
};

export const ScoreBar: React.FC<{
  label: string;
  value: number;
  color?: string;
}> = ({ label, value, color = '#34d399' }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-400">{label}</span>
        <span className="font-bold text-slate-200">{Math.round(pct)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
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
