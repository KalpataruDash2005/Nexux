import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">CareerOS</h1>
        
        <div className="flex items-center space-x-6">
          <div className="text-sm text-gray-300">
            Welcome, <span className="font-semibold text-white">{user?.email}</span> 
            <span className="ml-2 px-2 py-1 bg-blue-600/20 text-blue-400 rounded-md text-xs font-bold uppercase">{user?.role}</span>
          </div>
          
          <button 
            onClick={handleLogout}
            className="text-gray-400 hover:text-white transition-colors border border-gray-600 hover:border-gray-400 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Log Out
          </button>
        </div>
      </header>
      
      <main className="p-8 max-w-7xl mx-auto">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">Dashboard Overview</h2>
          <p className="text-gray-400 mb-6">
            You have successfully authenticated via JWT. This protected route is only accessible to logged-in users.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/profile" className="bg-gray-900 border border-gray-700 rounded-xl p-6 block hover:bg-gray-800 transition-colors">
              <h3 className="text-lg font-medium text-blue-400 mb-2">My Profile</h3>
              <p className="text-sm text-gray-500">Update your resume and skills</p>
            </Link>
            <Link to="/jobs" className="bg-gray-900 border border-gray-700 rounded-xl p-6 block hover:bg-gray-800 transition-colors">
              <h3 className="text-lg font-medium text-emerald-400 mb-2">Job Board</h3>
              <p className="text-sm text-gray-500">Browse new placements and openings</p>
            </Link>
            <Link to="/applications" className="bg-gray-900 border border-gray-700 rounded-xl p-6 block hover:bg-gray-800 transition-colors">
              <h3 className="text-lg font-medium text-purple-400 mb-2">Applications</h3>
              <p className="text-sm text-gray-500">Track your interview status</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
