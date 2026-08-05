import React, { useState } from 'react';
import {
  Rocket, LayoutDashboard, FileText, MessageSquare, Code2, BrainCircuit, BarChart3,
  Gauge, Map, History, Menu, X, Sparkles, ArrowRight,
} from 'lucide-react';
import './../components/placement/placement.css';
import type { PlacementView } from '../services/placementService';
import PlacementDashboard from '../components/placement/PlacementDashboard';
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
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'resume', label: 'Resume', icon: FileText },
  { view: 'interview', label: 'Interview', icon: MessageSquare },
  { view: 'coding', label: 'Coding', icon: Code2 },
  { view: 'aptitude', label: 'Aptitude', icon: BrainCircuit },
  { view: 'analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'readiness', label: 'Readiness', icon: Gauge },
  { view: 'roadmap', label: 'Roadmap', icon: Map },
  { view: 'sessions', label: 'Sessions', icon: History },
];

const QUICK_START: { view: PlacementView; label: string; icon: IconComponent; color: string }[] = [
  { view: 'interview', label: 'Mock Interview', icon: MessageSquare, color: 'text-emerald-400' },
  { view: 'coding', label: 'Coding Practice', icon: Code2, color: 'text-sky-400' },
  { view: 'aptitude', label: 'Aptitude Test', icon: BrainCircuit, color: 'text-violet-400' },
  { view: 'resume', label: 'Resume Review', icon: FileText, color: 'text-amber-400' },
];

const Placement: React.FC = () => {
  const [view, setView] = useState<PlacementView>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const handleNavigate = (next: PlacementView, sessionId?: string) => {
    setView(next);
    setOpenSessionId(sessionId ?? null);
    setMobileOpen(false);
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <PlacementDashboard onNavigate={handleNavigate} />;
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
      <header className="z-20 shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-500 text-white shadow-lg shadow-violet-500/30">
              <Rocket size={18} />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight text-slate-100">Placement HQ</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nexus</p>
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
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-800 lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="phq-fade-in border-t border-slate-800 px-4 py-3 lg:hidden">
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
      <main className="phq-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          {view === 'dashboard' && (
            <div className="phq-fade-up relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 md:p-8">
              <div className="phq-shimmer absolute inset-0 pointer-events-none" />
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <Sparkles size={13} />
                  Nexus Placement HQ
                </div>
                <h1 className="mt-4 bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl">
                  Welcome back, Developer
                </h1>
                <p className="mt-2 max-w-xl text-sm font-medium text-slate-400">
                  Your dream offer is closer than it looks. Small daily wins compound into interview-ready confidence.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {QUICK_START.map((q) => (
                    <button
                      key={q.view}
                      onClick={() => handleNavigate(q.view)}
                      className="group flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10"
                    >
                      <span className={q.color}><q.icon size={15} /></span>
                      {q.label}
                      <ArrowRight size={14} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default Placement;
