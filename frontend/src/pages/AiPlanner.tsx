import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles, Upload, FileDown, RefreshCw, CalendarCheck, TrendingUp,
  AlertTriangle, ListChecks, ChevronDown, Loader2, Trash2,
} from 'lucide-react';
import { ToastProvider, useToast } from '../components/pdf-assistant/Toast';
import UploadCalendarModal from '../components/planner/UploadCalendarModal';
import DailyScheduleCard from '../components/planner/DailyScheduleCard';
import UpcomingEventsCard from '../components/planner/UpcomingEventsCard';
import EventModal from '../components/planner/EventModal';
import {
  PlannerEvent, PlannerStats, StudyPlanResponse,
  getStats, getStudyPlan, getEvents, generateStudyPlan,
  clearPlanner, CalendarUploadResponse,
} from '../services/plannerService';

const AiPlannerInner: React.FC = () => {
  const { toast } = useToast();

  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [stats, setStats] = useState<PlannerStats | null>(null);
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlannerEvent | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const loadEvents = useCallback(async (cat: string, st: string, q: string) => {
    setEventsLoading(true);
    try {
      const data = await getEvents(cat || undefined, st || undefined, q || undefined);
      setEvents(data);
    } catch (err) {
      toast('Could not load events.', 'error');
    } finally {
      setEventsLoading(false);
    }
  }, [toast]);

  const loadDashboard = useCallback(async () => {
    setPlanLoading(true);
    try {
      const [s, p] = await Promise.all([getStats(), getStudyPlan()]);
      setStats(s);
      setPlan(p);
    } catch (err) {
      toast('Could not load the planner dashboard.', 'error');
    } finally {
      setPlanLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadEvents(category, status, search);
  }, [category, status, search, loadEvents]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleImported = (result: CalendarUploadResponse) => {
    toast(result.message, 'success');
    result.warnings.forEach((w) => toast(w, 'info'));
    if (result.needsVerification > 0) {
      toast(`${result.needsVerification} event(s) need your review.`, 'info');
    }
    loadDashboard();
    loadEvents('', '', '');
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      const newPlan = await generateStudyPlan();
      setPlan(newPlan);
      toast('AI study plan generated for the coming days.', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Could not generate study plan. Try again later.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!window.confirm('Reset the entire academic planner? This permanently deletes all imported calendar events, study sessions and progress for your account.')) {
      return;
    }
    setClearing(true);
    try {
      await clearPlanner();
      setEvents([]);
      setStats(null);
      setPlan(null);
      setSearch('');
      setCategory('');
      setStatus('');
      toast('Academic planner data has been reset.', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Could not reset the planner. Try again later.', 'error');
    } finally {
      setClearing(false);
    }
  };

  const handleEventUpdated = (updated: PlannerEvent) => {
    setSelectedEvent(updated);
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    loadDashboard();
    loadEvents(category, status, search);
  };

  const handleEventDeleted = (id: string) => {
    setSelectedEvent(null);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    loadDashboard();
  };

  const handleExport = (format: 'csv' | 'ics') => {
    if (format === 'csv') exportCsv(events);
    else exportIcs(events);
    setExportOpen(false);
    toast(`Calendar exported as ${format.toUpperCase()}.`, 'success');
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-[fadeIn_0.4s_ease-out]">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 p-8 md:p-10 text-white shadow-2xl shadow-blue-500/20 border border-sky-300">
          <div className="absolute -top-16 -right-16 w-80 h-80 bg-white/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-10 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white">
                <Sparkles size={14} className="text-white animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider">AI Academic Assistant</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text bg-gradient-to-r from-white via-slate-100 to-blue-100">
                Academic Planner
              </h1>
              <p className="text-sky-50 max-w-xl text-sm md:text-base font-medium leading-relaxed">
                Upload your academic calendar — AI extracts every exam, assignment, holiday and deadline, then builds your study plan automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <button
                onClick={() => setUploadOpen(true)}
                className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white text-blue-600 font-bold text-sm shadow-md hover:bg-slate-50 hover:shadow-lg active:scale-95 transition-all duration-200"
              >
                <Upload size={18} />
                <span>Upload Calendar</span>
              </button>
              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-blue-700 border border-blue-600 text-white font-bold text-sm hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-700/20 active:scale-95 transition-all duration-200 disabled:opacity-50"
              >
                {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                <span>{generating ? 'Planning...' : 'Generate Plan'}</span>
              </button>
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((o) => !o)}
                  className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/25 text-white font-bold text-sm hover:bg-white/20 active:scale-95 transition-all duration-200"
                >
                  <FileDown size={18} />
                  <span>Export</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-40 animate-[fadeInUp_0.15s_ease-out]">
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      CSV Spreadsheet
                    </button>
                    <button onClick={() => handleExport('ics')} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      iCal Calendar File
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => { loadDashboard(); loadEvents('', '', ''); }}
                className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 border border-white/25 text-white hover:bg-white/20 hover:rotate-45 active:scale-95 transition-all duration-200"
                title="Refresh all data"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="flex items-center space-x-2 px-4 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-white font-bold text-sm hover:bg-red-500/30 active:scale-95 transition-all duration-200 disabled:opacity-50"
                title="Reset all planner data"
              >
                {clearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Stat chips */}
          <div className="relative mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatChip icon={<CalendarCheck size={18} />} label="Total events" value={stats ? stats.totalEvents : '—'} />
            <StatChip icon={<TrendingUp size={18} />} label="Upcoming" value={stats ? stats.upcomingEvents : '—'} />
            <StatChip icon={<ListChecks size={18} />} label="Completed" value={stats ? stats.completedEvents : '—'} />
            <StatChip
              icon={<AlertTriangle size={18} />}
              label="Need review"
              value={stats ? stats.needsVerification : '—'}
              accent={!!stats && stats.needsVerification > 0}
            />
          </div>
        </div>

        {/* Main grid */}
        <div className="space-y-6">
          <DailyScheduleCard
            plan={plan}
            loading={planLoading}
            generating={generating}
            onGenerate={handleGeneratePlan}
            onChanged={loadDashboard}
            onToast={toast}
          />
        </div>

        <UpcomingEventsCard
          events={events}
          loading={eventsLoading}
          onSelect={setSelectedEvent}
          search={search}
          onSearch={setSearch}
          category={category}
          onCategory={setCategory}
          status={status}
          onStatus={setStatus}
        />
      </div>

      {uploadOpen && (
        <UploadCalendarModal onClose={() => setUploadOpen(false)} onImported={handleImported} />
      )}

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={handleEventUpdated}
          onDeleted={handleEventDeleted}
          onToast={toast}
        />
      )}
    </div>
  );
};

const StatChip: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }> = ({ icon, label, value, accent }) => (
  <div className={`rounded-2xl px-5 py-4 bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg ${accent ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20 bg-amber-500/10 border-amber-500/30' : ''}`}>
    <div className="flex items-center space-x-3 text-sky-100">
      <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${accent ? 'bg-amber-400/20 text-amber-300 animate-pulse' : 'bg-white/10 text-white'}`}>
        {icon}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-100">{label}</span>
    </div>
    <p className="text-3xl font-extrabold mt-3 tracking-tight text-white">{value}</p>
  </div>
);

const exportCsv = (events: PlannerEvent[]) => {
  const header = ['title', 'date', 'start_time', 'end_time', 'category', 'priority', 'location', 'description'];
  const rows = events.map((e) =>
    [e.title, e.date, e.startTime ?? '', e.endTime ?? '', e.category, e.priority, e.location ?? '', (e.description ?? '').replace(/\n/g, ' ')]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  download('nexora-calendar.csv', '\uFEFF' + [header.join(','), ...rows].join('\n'), 'text/csv');
};

const exportIcs = (events: PlannerEvent[]) => {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nexora//AI Academic Planner//EN'];
  for (const e of events) {
    const date = e.date.replace(/-/g, '');
    const start = e.startTime ? date + 'T' + e.startTime.replace(/:/g, '') + '00' : date;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@nexora`);
    lines.push(`DTSTART:${start}`);
    lines.push(`SUMMARY:${escapeIcs(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  download('nexora-calendar.ics', lines.join('\r\n'), 'text/calendar');
};

const escapeIcs = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const download = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const AiPlanner: React.FC = () => (
  <ToastProvider>
    <AiPlannerInner />
  </ToastProvider>
);

export default AiPlanner;
