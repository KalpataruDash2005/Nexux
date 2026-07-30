import React, { useEffect, useState } from 'react';
import { getMyApplications } from '../services/applicationService';
import { ApplicationDto } from '../types/application';
import { Link } from 'react-router-dom';

const Applications: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const data = await getMyApplications();
      setApplications(data);
    } catch (err) {
      console.error('Failed to fetch applications', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'APPLIED': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'INTERVIEWING': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'OFFERED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'REJECTED': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 flex items-center mb-8">
        <Link to="/dashboard" className="text-gray-400 hover:text-white mr-4 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          My Applications
        </h1>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 border-b border-gray-700 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold mb-1">Application Tracker</h2>
              <p className="text-sm text-gray-400">Track the status of all jobs you've applied for.</p>
            </div>
            <div className="text-3xl font-bold text-gray-600">{applications.length}</div>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 mb-4">You haven't applied to any jobs yet.</p>
              <Link to="/jobs" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Browse Job Board &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {applications.map(app => (
                <div key={app.id} className="p-6 hover:bg-gray-750 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">{app.jobTitle}</h3>
                    <p className="text-gray-400 text-sm mb-2">{app.companyName}</p>
                    <p className="text-xs text-gray-500">
                      Applied on {new Date(app.createdAt || '').toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Applications;
