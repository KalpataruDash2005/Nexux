import React from 'react';
import { TrendingUp } from 'lucide-react';
import { SubjectProgress } from '../../services/plannerService';

interface Props {
  progress: SubjectProgress[];
  loading: boolean;
}

const StudyProgressCard: React.FC<Props> = ({ progress, loading }) => {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2 mb-5">
        <TrendingUp size={18} className="text-purple-600" />
        <span>Study Progress</span>
      </h2>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : progress.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm bg-gray-50 rounded-2xl border border-gray-100">
          Progress will appear here once you complete study sessions from your AI schedule.
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((p) => (
            <div key={p.subject}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold text-gray-800">{p.subject}</p>
                <p className="text-sm font-bold text-gray-600">{p.percent}%</p>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, p.percent)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {Math.round(p.completedHours)}h of {Math.round(p.plannedHours)}h completed
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyProgressCard;
