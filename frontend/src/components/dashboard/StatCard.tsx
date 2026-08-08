import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  to?: string;
  tileClassName?: string;
  valueClassName?: string;
  animate?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  hint,
  to,
  tileClassName = 'bg-primary-tint text-primary',
  valueClassName = 'text-foreground',
  animate = true,
}) => {
  const body = (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border border-border bg-white p-6 shadow-card transition-all duration-300 ${
        to ? 'hover:-translate-y-1 hover:border-primary-soft hover:shadow-lg' : ''
      } ${animate ? 'animate-[fadeInUp_0.4s_ease-out]' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/5 ${tileClassName}`}>
          {icon}
        </div>
        {to && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-tag-bg text-muted transition-all duration-300 group-hover:bg-primary-tint group-hover:text-primary">
            <ArrowUpRight size={14} />
          </div>
        )}
      </div>
      <div className="mt-5">
        <p className={`text-3xl font-extrabold tracking-tight ${valueClassName}`}>{value}</p>
        <p className="mt-1 text-sm font-medium text-muted">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted/80">{hint}</p>}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {body}
      </Link>
    );
  }
  return body;
};