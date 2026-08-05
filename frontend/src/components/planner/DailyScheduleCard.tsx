import React, { useMemo, useState } from 'react';
import { Clock, CheckCircle2, Circle, Loader2, Sparkles, Coffee } from 'lucide-react';
import { StudyPlanResponse, StudySlot, markSessionCompleted } from '../../services/plannerService';

interface Props {
  plan: StudyPlanResponse | null;
  loading: boolean;
  generating: boolean;
  onGenerate: () => void;
  onChanged: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const TYPE_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  STUDY: { label: 'Study Session', cls: 'bg-blue-50/70 text-blue-755 border-blue-100 text-blue-600', dot: 'bg-blue-500' },
  REVISION: { label: 'Revision', cls: 'bg-purple-50/70 text-purple-755 border-purple-100 text-purple-600', dot: 'bg-purple-500' },
  PRACTICE: { label: 'Practice', cls: 'bg-emerald-50/70 text-emerald-755 border-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
  MOCK_TEST: { label: 'Mock Test', cls: 'bg-orange-50/70 text-orange-755 border-orange-100 text-orange-600', dot: 'bg-orange-500' },
  ASSIGNMENT: { label: 'Assignment', cls: 'bg-amber-50/70 text-amber-755 border-amber-100 text-amber-600', dot: 'bg-amber-500' },
  BREAK: { label: 'Break Time', cls: 'bg-slate-100/70 text-slate-655 border-slate-200 text-slate-500', dot: 'bg-slate-400' },
};

const parseDayLabel = (label: string) => {
  const parts = label.split(/[\(\)]/);
  if (parts.length >= 2) {
    return {
      main: parts[0].trim(),
      sub: parts[1].trim(),
    };
  }
  return { main: label, sub: '' };
};

const DailyScheduleCard: React.FC<Props> = ({ plan, loading, generating, onGenerate, onChanged, onToast }) => {
  const days = plan?.days ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [toggling, setToggling] = useState<string | null>(null);

  const selected = days[Math.min(selectedIndex, Math.max(days.length - 1, 0))];

  const sortedItems = useMemo(() => {
    if (!selected) return [];
    return [...selected.items].sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [selected]);

  const toggleSession = async (slot: StudySlot) => {
    setToggling(slot.id);
    try {
      await markSessionCompleted(slot.id, !slot.completed);
      onToast(slot.completed ? 'Marked as incomplete' : 'Great job — session completed!', 'success');
      onChanged();
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Could not update session', 'error');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-100/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2.5">
            <Clock size={20} className="text-sky-500 animate-pulse" />
            <span>Smart Schedule</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">AI-generated step-by-step daily study roadmap</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-sky-500 hover:bg-sky-600 border border-sky-400 text-white disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-sky-500/10 shrink-0"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          <span>{generating ? 'Generating...' : 'Regenerate Plan'}</span>
        </button>
      </div>

      {days.length > 0 && (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-sky-200 scrollbar-track-transparent">
          {days.map((day, i) => {
            const { main, sub } = parseDayLabel(day.label);
            const isActive = i === selectedIndex;
            return (
              <button
                key={day.date}
                onClick={() => setSelectedIndex(i)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl min-w-[80px] h-24 border transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-b from-sky-400 to-sky-500 text-white border-transparent shadow-lg shadow-sky-500/20 scale-[1.03]'
                    : 'bg-white text-gray-700 border-gray-100 hover:border-sky-300 hover:shadow-sm hover:translate-y-[-2px]'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)' } : {}}
              >
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-400'}`}>
                  {main}
                </span>
                <span className="text-xl font-black my-1 tracking-tight">
                  {sub.split(' ').pop() || '—'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-655 text-sky-600'
                }`}>
                  {Math.round(day.totalHours * 10) / 10}h
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-50 border border-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !selected || selected.items.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Sparkles size={32} className="mx-auto mb-3 text-sky-500 animate-bounce" />
          <p className="font-semibold text-slate-700 mb-1">No study roadmap generated</p>
          <p className="text-xs max-w-sm mx-auto">Upload your academic calendar or tap "Generate Plan" above and our AI will build your daily customized study sessions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((slot) => {
            const style = TYPE_STYLES[slot.sessionType] ?? TYPE_STYLES.STUDY;
            const isBreak = slot.sessionType === 'BREAK';
            return (
              <div
                key={slot.id}
                className={`group relative flex items-center gap-4 p-4 pl-6 rounded-2xl border transition-all duration-300 ${
                  slot.completed
                    ? 'bg-emerald-50/10 border-emerald-100/50 shadow-sm opacity-75'
                    : isBreak
                    ? 'bg-slate-50/50 border-dashed border-slate-200'
                    : 'bg-white border-slate-100 hover:border-sky-100 hover:shadow-md hover:translate-x-1'
                }`}
              >
                {/* Left vertical bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${
                    slot.completed ? 'bg-emerald-500' : style.dot
                  }`}
                />

                {/* Time Indicator */}
                <div className="flex flex-col items-center justify-center min-w-[64px] py-1.5 px-2 rounded-xl bg-slate-50 border border-slate-100 text-center shrink-0">
                  <Clock size={11} className="text-slate-400 mb-0.5" />
                  <span className="text-xs font-extrabold text-slate-700 tracking-tight">
                    {slot.startTime || '—'}
                  </span>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 z-10">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold truncate transition-all duration-200 ${
                      slot.completed ? 'text-slate-450 text-slate-400 line-through' : 'text-slate-800'
                    }`}>
                      {isBreak ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
                          <Coffee size={14} className="text-slate-400 shrink-0" />
                          {slot.subject}
                        </span>
                      ) : (
                        slot.subject
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${style.cls}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {slot.hours} hr{slot.hours !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Checkbox Trigger */}
                <button
                  onClick={() => toggleSession(slot)}
                  disabled={toggling === slot.id}
                  className="p-1 rounded-full hover:bg-slate-50 transition-colors shrink-0 outline-none focus:ring-2 focus:ring-sky-500/20 z-10"
                >
                  {toggling === slot.id ? (
                    <Loader2 size={22} className="text-sky-500 animate-spin" />
                  ) : slot.completed ? (
                    <CheckCircle2 size={22} className="text-emerald-500 fill-emerald-50 hover:scale-105 active:scale-95 transition-transform" />
                  ) : (
                    <Circle size={22} className="text-slate-300 hover:text-sky-500 hover:scale-105 active:scale-95 transition-transform" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && plan?.message && days.length > 0 && (
        <p className="mt-4 text-xs text-slate-450 text-slate-400 italic bg-slate-50/50 p-3 rounded-xl border border-slate-100">{plan.message}</p>
      )}
    </div>
  );
};

export default DailyScheduleCard;
