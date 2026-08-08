import React from 'react';

export const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-tag-bg ${className}`} />
);

export const StatCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
    <div className="flex items-start justify-between">
      <SkeletonPulse className="h-11 w-11 rounded-xl" />
      <SkeletonPulse className="h-5 w-5 rounded-full" />
    </div>
    <SkeletonPulse className="mt-5 h-8 w-16" />
    <SkeletonPulse className="mt-2 h-3 w-24" />
  </div>
);

export const WorkspaceRowSkeleton: React.FC = () => (
  <div className="flex items-center justify-between p-4">
    <div className="flex items-center space-x-3">
      <SkeletonPulse className="h-10 w-10 rounded-xl" />
      <div className="space-y-2">
        <SkeletonPulse className="h-3.5 w-40" />
        <SkeletonPulse className="h-3 w-24" />
      </div>
    </div>
    <SkeletonPulse className="h-3 w-14" />
  </div>
);