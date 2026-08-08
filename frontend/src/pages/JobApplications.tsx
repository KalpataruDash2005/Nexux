import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApplicationsForJob, updateApplicationStatus } from '../services/applicationService';
import { ApplicationDetailsDto } from '../types/application';
import { useToast } from '../components/ui/Toast';

const JobApplications: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [applications, setApplications] = useState<ApplicationDetailsDto[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (jobId) {
      fetchApplications(jobId);
    }
  }, [jobId]);

  const fetchApplications = async (id: string) => {
    try {
      const data = await getApplicationsForJob(id);
      setApplications(data);
    } catch (err) {
      console.error('Failed to fetch applications', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      const updatedApp = await updateApplicationStatus(appId, newStatus);
      setApplications(apps => apps.map(app => (app.id === appId ? updatedApp : app)));
    } catch (err) {
      console.error('Failed to update status', err);
      toast('Failed to update status.', 'error');
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
    <div className="min-h-screen bg-gray-900 text-white pb-12 relative">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link to="/jobs" className="text-gray-400 hover:text-white mr-4 transition-colors">
            &larr; Back to Job Board
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Applicant Tracking
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading applicants...</div>
        ) : applications.length === 0 ? (
          <div className="text-center bg-gray-800 border border-gray-700 rounded-xl py-12 text-gray-400">
            No applicants found for this job yet.
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold mb-1 text-white">Candidates for: {applications[0].jobTitle}</h2>
              <p className="text-sm text-gray-400">Total Applicants: {applications.length}</p>
            </div>
            <div className="divide-y divide-gray-700">
              {applications.map(app => (
                <div key={app.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-750 transition-colors">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white mb-1">{app.studentName}</h3>
                    <div className="text-sm text-gray-400 mb-3">{app.studentEmail}</div>
                    
                    {app.studentSkills && (
                      <div className="text-xs font-medium text-gray-400 mb-3">
                        <span className="text-gray-500 mr-2">Skills:</span>
                        {app.studentSkills}
                      </div>
                    )}
                    
                    {app.studentResumeUrl && (
                      <a href={app.studentResumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline">
                        View Resume &rarr;
                      </a>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-3 min-w-[200px]">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(app.status)} mb-2 self-start md:self-end`}>
                      Current: {app.status}
                    </span>
                    <select
                      value={app.status}
                      onChange={(e) => app.id && handleStatusChange(app.id, e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                    >
                      <option value="APPLIED">APPLIED</option>
                      <option value="INTERVIEWING">INTERVIEWING</option>
                      <option value="OFFERED">OFFERED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                    <div className="text-xs text-gray-500">
                      Applied {new Date(app.createdAt || '').toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default JobApplications;
