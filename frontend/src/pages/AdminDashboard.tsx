import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { getAllUsers, getAllJobsForAdmin, UserAdminDto } from '../services/adminService';
import { JobDto } from '../types/job';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserAdminDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [loading, setLoading] = useState(true);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, jobsData] = await Promise.all([
        getAllUsers(),
        getAllJobsForAdmin()
      ]);
      setUsers(usersData);
      setJobs(jobsData);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 flex items-center mb-8">
        <Link to="/dashboard" className="text-gray-400 hover:text-white mr-4 transition-colors">
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
          Admin Control Center
        </h1>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading platform data...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-lg">
                <h2 className="text-lg font-medium text-gray-400 mb-2">Total Users</h2>
                <div className="text-4xl font-bold text-white">{users.length}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-lg">
                <h2 className="text-lg font-medium text-gray-400 mb-2">Total Jobs Posted</h2>
                <div className="text-4xl font-bold text-white">{jobs.length}</div>
              </div>
            </div>

            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">Registered Users</h2>
              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-lg">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Joined At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">{u.id}</td>
                        <td className="px-6 py-4 font-medium text-white">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' :
                            u.role === 'RECRUITER' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">All Job Postings</h2>
              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-lg">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-4">Job Title</th>
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Posted By</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => (
                      <tr key={j.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{j.title}</td>
                        <td className="px-6 py-4">{j.companyName}</td>
                        <td className="px-6 py-4">{j.postedByEmail}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            j.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {j.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
