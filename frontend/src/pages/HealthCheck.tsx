import React, { useEffect, useState } from 'react';
import { getHealthStatus, HealthResponse } from '../services/healthService';

const HealthCheck: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getHealthStatus();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-card border border-card-border shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">System Connectivity Check</h2>
          <p className="text-sm text-gray-400">Verifying linkage between React frontend and Spring Boot backend</p>
        </div>

        <div className="p-5 rounded-xl bg-black/40 border border-card-border flex flex-col items-center justify-center space-y-4">
          <div className="text-sm font-semibold uppercase tracking-wider text-gray-500">Backend Status</div>
          
          {loading && (
            <div className="flex items-center space-x-2 text-primary">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Querying server...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center space-y-2 text-red-400 text-center">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/20">DOWN</span>
              <p className="text-xs max-w-[280px] mt-1 break-words">{error}</p>
            </div>
          )}

          {!loading && data && (
            <div className="flex flex-col items-center space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                ACTIVE
              </span>
              <code className="text-xs text-indigo-300 font-mono mt-1">
                {JSON.stringify(data)}
              </code>
            </div>
          )}
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl font-medium text-primary-foreground bg-primary hover:bg-primary-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check Connectivity
        </button>
      </div>
    </div>
  );
};

export default HealthCheck;
