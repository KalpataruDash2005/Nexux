import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, FolderOpen, ArrowRight } from 'lucide-react';
import { Workspace } from '../../services/workspaceService';
import { WorkspaceRowSkeleton } from './Skeleton';

const TILE_COLORS = [
  'bg-primary-tint text-primary',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
];

interface Props {
  workspaces: Workspace[];
  loading: boolean;
}

const RecentWorkspaces: React.FC<Props> = ({ workspaces, loading }) => {
  const sorted = [...workspaces]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint text-primary ring-1 ring-primary-soft">
            <FolderOpen size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Recent Workspaces</h2>
            <p className="text-xs text-muted">Jump back into your latest projects</p>
          </div>
        </div>
        <Link
          to="/workspaces"
          className="flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          View all
          <ArrowRight size={15} />
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 divide-y divide-border">
          {[0, 1, 2, 3].map((i) => (
            <WorkspaceRowSkeleton key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border bg-background">
            <FolderOpen size={26} className="text-muted" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No workspaces yet</p>
            <p className="mt-1 text-xs text-muted">Create a workspace to organize your learning.</p>
          </div>
          <Link
            to="/workspaces"
            className="mt-1 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 transition-all hover:bg-primary-hover"
          >
            Create your first workspace
          </Link>
        </div>
      ) : (
        <div className="flex-1 divide-y divide-border">
          {sorted.map((ws, idx) => (
            <Link
              key={ws.id}
              to={`/workspaces/${ws.id}`}
              className="group flex items-center justify-between px-2 py-3.5 transition-colors"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 ${TILE_COLORS[idx % TILE_COLORS.length]}`}>
                  <BookOpen size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                    {ws.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {ws.description || 'No description'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs font-medium text-muted">
                  {new Date(ws.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <ChevronRight size={16} className="text-muted/60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentWorkspaces;