import React, { useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { PlannerEvent, CATEGORY_META } from '../../services/plannerService';

interface Props {
  events: PlannerEvent[];
  loading: boolean;
  onSelect?: (event: PlannerEvent) => void;
}

const MiniCalendarCard: React.FC<Props> = ({ events, loading, onSelect }) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    for (const event of events) {
      const key = event.date;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const selectedKey = viewDate.toISOString().slice(0, 10);
  const selectedEvents = eventsByDate.get(selectedKey) ?? [];

  const isToday = (date: Date) => date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <CalendarIcon size={18} className="text-purple-600" />
          <span>Calendar</span>
        </h2>
        <button
          onClick={() => setViewDate(new Date())}
          className="text-xs font-semibold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-full transition-colors"
        >
          Today
        </button>
      </div>

      <style>{`
        .planner-cal .react-calendar { width: 100%; border: none; font-family: inherit; background: transparent; }
        .planner-cal .react-calendar__navigation { display: flex; margin-bottom: 8px; }
        .planner-cal .react-calendar__navigation button { min-width: 34px; font-size: 13px; font-weight: 600; color: #374151; border-radius: 10px; }
        .planner-cal .react-calendar__navigation button:enabled:hover { background: #f3f4f6; }
        .planner-cal .react-calendar__navigation__label { flex-grow: 1; text-align: center; }
        .planner-cal .react-calendar__month-view__weekdays { text-align: center; }
        .planner-cal .react-calendar__month-view__weekdays__weekday { font-size: 11px; text-transform: uppercase; color: #9ca3af; padding-bottom: 6px; }
        .planner-cal .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }
        .planner-cal .react-calendar__month-view__days__day { aspect-ratio: 1; font-size: 13px; color: #374151; border-radius: 10px; position: relative; }
        .planner-cal .react-calendar__month-view__days__day--weekend { color: #6b7280; }
        .planner-cal .react-calendar__month-view__days__day--neighboringMonth { color: #d1d5db; }
        .planner-cal .react-calendar__tile:enabled:hover { background: #f3f4f6; }
        .planner-cal .react-calendar__tile--now { background: #f5f3ff; color: #6d28d9; font-weight: 700; }
        .planner-cal .react-calendar__tile--active { background: linear-gradient(135deg, #2563eb, #7c3aed) !important; color: white !important; }
        .planner-cal .react-calendar__tile--active:enabled:hover { background: linear-gradient(135deg, #2563eb, #7c3aed) !important; }
      `}</style>

      {loading ? (
        <div className="h-72 bg-gray-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="planner-cal">
          <Calendar
            value={viewDate}
            onChange={(value) => {
              if (value instanceof Date) setViewDate(value);
            }}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (activeStartDate) setViewDate(activeStartDate);
            }}
            prevLabel={<ChevronLeft size={16} />}
            nextLabel={<ChevronRight size={16} />}
            prev2Label={null}
            next2Label={null}
            tileContent={({ date }) => {
              const key = date.toISOString().slice(0, 10);
              const dayEvents = eventsByDate.get(key);
              if (!dayEvents || dayEvents.length === 0) return null;
              const colors = dayEvents.slice(0, 4).map((e) => CATEGORY_META[e.category]?.color ?? '#6366f1');
              return (
                <div className="flex justify-center gap-0.5 mt-1">
                  {colors.map((c, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
              );
            }}
            tileClassName={({ date }) => (isToday(date) ? 'react-calendar__tile--now' : undefined)}
          />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
          {viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No events on this day.</p>
        ) : (
          <div className="space-y-1.5">
            {selectedEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelect?.(event)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-gray-50 transition-all text-left"
              >
                <span className="flex items-center space-x-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_META[event.category]?.color ?? '#6366f1' }} />
                  <span className="text-sm font-medium text-gray-800 truncate">{event.title}</span>
                </span>
                <ArrowRight size={14} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MiniCalendarCard;
