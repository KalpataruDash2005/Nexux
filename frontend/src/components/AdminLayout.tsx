import React from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Command, LogOut, LayoutDashboard, MessageSquareText, FileQuestion } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';

  if (user?.role?.toUpperCase() !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const link = (to: string, icon: React.ReactNode, label: string, tab: string) => (
    <NavLink
      to={to}
      className={
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
        (currentTab === tab ? 'text-primary bg-primary-tint' : 'text-gray-600 hover:bg-gray-50')
      }
    >
      {icon}
      {label}
    </NavLink>
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <nav className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500">
                <Command size={16} className="text-white" />
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-wide text-slate-800">Nexora</span>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-600">
              Admin
            </span>
          </div>
          <div className="flex space-x-1">
            {link('/admin-dashboard', <LayoutDashboard size={18} />, 'Overview', 'overview')}
            {link('/admin-dashboard?tab=feedback', <MessageSquareText size={18} />, 'Feedback', 'feedback')}
            {link('/admin-dashboard?tab=aptitude', <FileQuestion size={18} />, 'Aptitude Sets', 'aptitude')}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-600">{user?.email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-error hover:bg-error/5 hover:text-error"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;