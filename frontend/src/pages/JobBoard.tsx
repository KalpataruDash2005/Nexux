import React, { useEffect, useState } from 'react';
import { getActiveJobs, createJob } from '../services/jobService';
import { JobDto } from '../types/job';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const JobBoard: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newJob, setNewJob] = useState<JobDto>({ title: '', companyName: '', description: '', location: '', salary: '' });

  const isRecruiter = user?.role === 'RECRUITER' || user?.role === 'ADMIN';

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await getActiveJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createJob(newJob);
      setShowModal(false);
      setNewJob({ title: '', companyName: '', description: '', location: '', salary: '' });
      fetchJobs();
    } catch (err) {
      console.error('Failed to create job', err);
      alert('Failed to create job.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12 relative">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link to="/dashboard" className="text-gray-400 hover:text-white mr-4 transition-colors">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Job Board
          </h1>
        </div>
        {isRecruiter && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
          >
            + Post New Job
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center bg-gray-800 border border-gray-700 rounded-xl py-12 text-gray-400">
            No active jobs found right now. Check back later!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map(job => (
              <div key={job.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-gray-500 transition-colors shadow-lg flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-blue-400">{job.title}</h2>
                  <div className="text-sm font-medium text-gray-300 mb-4">{job.companyName}</div>
                  
                  <div className="flex flex-wrap gap-2 mb-4 text-xs font-medium text-gray-400">
                    {job.location && <span className="bg-gray-900 px-2 py-1 rounded border border-gray-700">📍 {job.location}</span>}
                    {job.salary && <span className="bg-gray-900 px-2 py-1 rounded border border-gray-700">💰 {job.salary}</span>}
                  </div>
                  
                  <p className="text-sm text-gray-400 line-clamp-3 mb-6">
                    {job.description}
                  </p>
                </div>
                
                <div className="flex justify-between items-center border-t border-gray-700 pt-4 mt-auto">
                  <div className="text-xs text-gray-500">
                    Posted by {job.postedByEmail}
                  </div>
                  <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                    Apply &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-white">Post a New Job</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={newJob.title}
                  onChange={e => setNewJob({...newJob, title: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newJob.companyName}
                  onChange={e => setNewJob({...newJob, companyName: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={newJob.location}
                    onChange={e => setNewJob({...newJob, location: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Salary</label>
                  <input
                    type="text"
                    value={newJob.salary}
                    onChange={e => setNewJob({...newJob, salary: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  required
                  rows={4}
                  value={newJob.description}
                  onChange={e => setNewJob({...newJob, description: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Post Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobBoard;
