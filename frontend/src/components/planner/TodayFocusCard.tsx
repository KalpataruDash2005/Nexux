import React from 'react';
import { Target, Flame, Clock, TrendingUp, AlertCircle, CalendarDays } from 'lucide-react';
import { TodayFocusResponse, FocusItem } from '../../services/plannerService';

interface Props {
  data: TodayFocusResponse | null;
  loading: boolean;
}

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const styles: Record<string, string> = {
    HIGH: 'bg-red-50 text-red-600 border-red-100',
    MEDIUM: 'bg-amber-50 text-amber-600 border-amber-100',
    LOW: 'bg-green-50 text-green-600 border-green-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${styles[priority] ?? styles.MEDIUM}`}>
      {priority}
    </span>
  );
};

const FocusCard: React.FC<{ item: FocusItem; index: number }> = ({ item, index }) => {
  const isToday = item.daysRemaining === 0;
  const isFree = item.category === 'FREE';
  return (
    <div className="flex items-start space-x-4 p-4 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-sm transition-all">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (item.color ?? '#8b5cf6') + '22', color: item.color ?? '#8b5cf6' }}>
        {isToday ? <Flame size={18} /> : isFree ? <CalendarDays size={18} /> : <Target size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
          {!isFree && <PriorityBadge priority={item.priority} />}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{item.reason}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-gray-500">
          {!isFree && (
            <>
              {item.daysRemaining > 0 ? (
                <span className={`font-semibold ${item.daysRemaining <= 3 ? 'text-red-500' : 'text-gray-600'}`}>
                  {item.daysRemaining === 1 ? '1 day left' : `${item.daysRemaining} days left`}
                </span>
              ) : (
                <span className="font-semibold text-purple-600">Today</span>
              )}
              <span className="flex items-center space-x-1">
                <Clock size={12} />
                <span>Est. {Math.round(item.estimatedHours)}h prep</span>
              </span>
              {item.recommendedHours > 0 && (
                <span className="flex items-center space-x-1">
                  <TrendingUp size={12} />
                  <span>Recommended {Math.round(item.recommendedHours)}h today</span>
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-200">{String(index + 1).padStart(2, '0')}</div>
    </div>
  );
};

const TodayFocusCard: React.FC<Props> = ({ data, loading }) => {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
          <Target size={18} className="text-purple-600" />
          <span>Today's Focus</span>
        </h2>
        {data && (
          <span className="text-xs font-semibold text-gray-400">
            {new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : data && data.focus.length > 0 ? (
        <div className="space-y-3">
          {data.focus.map((item, i) => (
            <FocusCard key={i} item={item} index={i} />
          ))}
        </div>
      ) : (
        <div className="p-10 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl border border-gray-100">
          <AlertCircle size={28} className="mx-auto mb-2 opacity-40" />
          Upload your academic calendar to see today's priorities.
        </div>
      )}

      {data && data.recommendations.length > 0 && (
        <div className="mt-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-purple-600 mb-2">AI Recommendations</p>
          <ul className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TodayFocusCard;
