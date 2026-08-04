import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { getMyProfile } from '../services/profileService';
import { StudentProfileDto } from '../types/profile';
import { getWorkspaces, Workspace } from '../services/workspaceService';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, BookOpen, FolderOpen, Sparkles, TrendingUp, Award, Zap, ArrowRight } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfileDto | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();

  useEffect(() => {
    getMyProfile().then(setProfile).catch(console.error);
    getWorkspaces().then(setWorkspaces).catch(console.error);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const displayName = () => {
    if (profile?.firstName) {
      return `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`;
    }
    if (user?.email) {
      return user.email.split('@')[0] || 'there';
    }
    return 'there';
  };

  const recentWorkspaces = [...workspaces]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 4);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 flex flex-col font-sans">
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Welcome Header */}
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center space-x-2 text-gray-500 mb-1">
                <Sparkles size={16} className="text-purple-600" />
                <span className="text-sm font-medium tracking-wide uppercase">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                {getGreeting()}, <span className="text-purple-700">{displayName()}</span>
              </h1>
            </div>
            <div className="text-right">
              <div className="text-3xl font-light text-gray-400 tracking-widest font-mono">
                {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <NavLink to="/workspaces" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-purple-200 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <FolderOpen size={20} className="text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-gray-900">{workspaces.length}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {workspaces.length === 1 ? 'Workspace' : 'Workspaces'}
                </p>
              </div>
            </NavLink>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-blue-100 transition-colors">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <BookOpen size={20} className="text-blue-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-gray-900">0</h3>
                <p className="text-sm text-gray-500 mt-1">Study Sessions</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-orange-100 transition-colors">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-orange-50 rounded-xl">
                  <Zap size={20} className="text-orange-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-gray-900">0</h3>
                <p className="text-sm text-gray-500 mt-1">Current Streak</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-green-100 transition-colors">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-green-50 rounded-xl">
                  <Award size={20} className="text-green-600" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-gray-900">0%</h3>
                <p className="text-sm text-gray-500 mt-1">Completion Rate</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Workspaces */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <TrendingUp size={18} className="text-purple-600" />
                  <span>Recent Workspaces</span>
                </h2>
                <NavLink to="/workspaces" className="text-sm font-semibold text-purple-600 hover:text-purple-700 flex items-center space-x-1">
                  <span>View all</span>
                  <ArrowRight size={15} />
                </NavLink>
              </div>

              {recentWorkspaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-3">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                    <FolderOpen size={24} className="text-gray-400" />
                  </div>
                  <p className="text-sm">No workspaces yet.</p>
                  <NavLink to="/workspaces" className="text-sm font-semibold text-purple-600 hover:text-purple-700">
                    Create your first workspace
                  </NavLink>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWorkspaces.map((ws) => (
                    <NavLink
                      key={ws.id}
                      to={`/workspaces/${ws.id}`}
                      className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:border-purple-200 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                          <BookOpen size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{ws.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {ws.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">
                        {new Date(ws.createdAt || Date.now()).toLocaleDateString()}
                      </div>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Schedule */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Calendar size={18} className="text-purple-600" />
                  <span>Schedule</span>
                </h2>
              </div>
              <div className="space-y-4">
                <div className="p-4 border border-gray-100 rounded-2xl bg-gray-50">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Today</p>
                  <p className="text-sm font-medium text-gray-900">No upcoming events</p>
                </div>
                <div className="p-4 border border-gray-100 rounded-2xl flex items-center space-x-2 text-xs text-gray-400">
                  <Clock size={14} />
                  <span>Your study schedule will appear here.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
