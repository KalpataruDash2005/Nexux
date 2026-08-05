import React, { useState } from 'react';
import {
  Rocket, FileText, MessageSquare, Code2, BrainCircuit, BarChart3,
  Gauge, Map, History, Menu, X, RotateCcw,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import './../components/placement/placement.css';
import type { PlacementView } from '../services/placementService';
import { resetPlacementActivity } from '../services/placementService';
import ResumeAnalyzer from '../components/placement/ResumeAnalyzer';
import InterviewHub from '../components/placement/InterviewHub';
import CodingPractice from '../components/placement/CodingPractice';
import AptitudeTest from '../components/placement/AptitudeTest';
import AnalyticsView from '../components/placement/AnalyticsView';
import ReadinessView from '../components/placement/ReadinessView';
import RoadmapView from '../components/placement/RoadmapView';
import SessionsView from '../components/placement/SessionsView';

type IconComponent = React.ComponentType<{ size?: number | string; className?: string }>;

interface NavItem {
  view: PlacementView;
  label: string;
  icon: IconComponent;
}

const NAV: NavItem[] = [
  { view: 'resume', label: 'Resume', icon: FileText },
  { view: 'interview', label: 'Interview', icon: MessageSquare },
  { view: 'coding', label: 'Coding', icon: Code2 },
  { view: 'aptitude', label: 'Aptitude', icon: BrainCircuit },
  { view: 'analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'readiness', label: 'Readiness', icon: Gauge },
  { view: 'roadmap', label: 'Roadmap', icon: Map },
  { view: 'sessions', label: 'Sessions', icon: History },
];

const Placement: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialView = (queryParams.get('view') as PlacementView) || 'resume';
  const initialSession = queryParams.get('session') || null;

  const [view, setView] = useState<PlacementView>(initialView);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(initialSession);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleNavigate = (next: PlacementView, sessionId?: string) => {
    setView(next);
    setOpenSessionId(sessionId ?? null);
    setMobileOpen(false);
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        'Reset ALL placement activity?\n\nThis permanently deletes your uploaded resumes, analyses, mock interviews, coding sessions, aptitude tests, and all placement stats. This cannot be undone.'
      )
    ) {
      return;
    }
    setResetting(true);
    setResetMsg(null);
    try {
      const result = await resetPlacementActivity();
      setResetMsg({
        text: `Reset complete — ${result.deletedSessions} session(s) and ${result.deletedResumes} resume(s) removed. Your placement dashboard is now clean.`,
        ok: true,
      });
      setView('resume');
      setOpenSessionId(null);
      setMobileOpen(false);
    } catch (err) {
      setResetMsg({ text: err instanceof Error ? err.message : 'Reset failed. Please try again.', ok: false });
    } finally {
      setResetting(false);
    }
  };

  const renderView = () => {
    switch (view) {
      case 'resume':
        return <ResumeAnalyzer />;
      case 'interview':
        return (
          <InterviewHub
            onNavigate={handleNavigate}
            openSessionId={openSessionId}
            onSessionOpened={() => setOpenSessionId(null)}
          />
        );
      case 'coding':
        return <CodingPractice />;
      case 'aptitude':
        return <AptitudeTest />;
      case 'analytics':
        return <AnalyticsView />;
      case 'readiness':
        return <ReadinessView />;
      case 'roadmap':
        return <RoadmapView />;
      case 'sessions':
        return <SessionsView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="z-20 shrink-0 border-b border-slate-800 bg-slate-950">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-500 text-white shadow-lg shadow-violet-500/30">
              <Rocket size={18} />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight text-slate-100">Features</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => handleNavigate(n.view)}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  view === n.view
                    ? 'bg-slate-800/80 text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <n.icon size={15} />
                {n.label}
                {view === n.view && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
                )}
              </button>
            ))}
          </nav>

          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset all placement activity"
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rose-400 transition-all hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
          >
            <RotateCcw size={15} className={resetting ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{resetting ? 'Resetting...' : 'Reset'}</span>
          </button>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-800 lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-800 px-4 py-3 lg:hidden">
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((n) => (
                <button
                  key={n.view}
                  onClick={() => handleNavigate(n.view)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-all ${
                    view === n.view
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <n.icon size={17} />
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {resetMsg && (
          <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                resetMsg.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              <span>{resetMsg.text}</span>
              <button
                onClick={() => setResetMsg(null)}
                className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default Placement;
