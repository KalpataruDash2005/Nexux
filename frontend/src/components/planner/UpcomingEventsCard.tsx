import React from 'react';
import { CalendarDays, Search, Filter, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { PlannerEvent, CATEGORY_META, countdown } from '../../services/plannerService';

interface Props {
  events: PlannerEvent[];
  loading: boolean;
  onSelect: (event: PlannerEvent) => void;
  search: string;
  onSearch: (q: string) => void;
  category: string;
  onCategory: (c: string) => void;
  status: string;
  onStatus: (s: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING_VERIFICATION', label: 'Needs review' },
];

const categoryOptions = Object.entries(CATEGORY_META).sort((a, b) => a[1].label.localeCompare(b[1].label));

const TodayBadge: React.FC<{ days: number | null }> = ({ days }) => {
  if (days == null) return null;
  if (days < 0) return <span className="text-xs text-slate-400 font-semibold bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Completed</span>;
  const today = days === 0;
  const urgent = days <= 3;
  return (
    <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full shadow-sm tracking-tight ${
      today 
        ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white animate-pulse' 
        : urgent 
        ? 'bg-red-50 text-red-655 text-red-600 border border-red-100' 
        : 'bg-sky-50 text-sky-600 border border-sky-100'
    }`}>
      {countdown(days)}
    </span>
  );
};

const UpcomingEventsCard: React.FC<Props> = ({ events, loading, onSelect, search, onSearch, category, onCategory, status, onStatus }) => {
  const sorted = [...events].sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-100/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2.5">
            <CalendarDays size={20} className="text-sky-600" />
            <span>Upcoming Events</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage and track your schedule milestones</p>
        </div>
        <span className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-100 rounded-2xl px-3 py-1 self-start sm:self-center shrink-0">
          {events.length} event{events.length !== 1 ? 's' : ''} total
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search events, subjects, exams..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium placeholder-slate-400 text-slate-700"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={category}
              onChange={(e) => onCategory(e.target.value)}
              className="pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold text-slate-700 appearance-none cursor-pointer"
            >
              <option value="">All categories</option>
              {categoryOptions.map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={status}
              onChange={(e) => onStatus(e.target.value)}
              className="pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold text-slate-700 appearance-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-50 border border-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <CalendarDays size={32} className="mx-auto mb-3 text-sky-500" />
          <p className="font-semibold text-slate-700 mb-1">No events found</p>
          <p className="text-xs max-w-sm mx-auto">Try adjusting your filters or upload a new calendar file to see your events here.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {sorted.map((event) => {
            const meta = CATEGORY_META[event.category] ?? CATEGORY_META.OTHER;
            return (
              <button
                key={event.id}
                onClick={() => onSelect(event)}
                className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-sky-100 hover:shadow-md hover:translate-y-[-1px] hover:bg-slate-50/20 active:translate-y-0 transition-all text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{ backgroundColor: `${meta.color}15`, borderColor: `${meta.color}30`, color: meta.color }}
                  >
                    <CalendarDays size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{event.title}</p>
                      {event.needsVerification && (
                        <div className="px-1.5 py-0.5 rounded bg-amber-55 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 shrink-0">
                          <AlertTriangle size={10} className="text-amber-500" />
                          <span>Review</span>
                        </div>
                      )}
                      {event.completed && (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>{new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      {event.startTime && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>{event.startTime}</span>
                        </>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="font-extrabold uppercase text-[10px] tracking-wider" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    </p>
                  </div>
                </div>
                <TodayBadge days={event.daysRemaining} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UpcomingEventsCard;
