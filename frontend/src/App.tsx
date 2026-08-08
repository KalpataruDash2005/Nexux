import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import TopNav from './components/TopNav';
import AdminLayout from './components/AdminLayout';
import WorkspaceList from './pages/WorkspaceList';
import AcademicWorkspace from './pages/AcademicWorkspace';
import Tasks from './pages/Tasks';
import Placement from './pages/Placement';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import OAuth2Callback from './pages/OAuth2Callback';
import { AuthProvider, useAuth } from './context/AuthContext';
import AiAssistantWidget from './components/tasks/AiAssistantWidget';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';

// Layout for pages that require the top navigation bar (Protected/App Routes).
// Admins never see the student shell — they are scoped to the admin layout.
const ProtectedLayout: React.FC = () => {
  const { user } = useAuth();
  if (user?.role?.toUpperCase() === 'ADMIN') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <TopNav />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      {/* Floating AI assistant available on every authenticated page */}
      <AiAssistantWidget />
    </div>
  );
};

// Layout for public pages (Landing, Auth, Onboarding) that don't need TopNav
const PublicLayout: React.FC = () => {
  return <Outlet />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/oauth2/callback" element={<OAuth2Callback />} />
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>

            {/* Protected App Routes */}
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workspaces" element={<WorkspaceList />} />
                <Route path="/workspaces/:workspaceId" element={<AcademicWorkspace />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/placement" element={<Placement />} />
            </Route>

            {/* Admin-only area: no student nav, no AI assistant widget */}
            <Route element={<AdminLayout />}>
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
