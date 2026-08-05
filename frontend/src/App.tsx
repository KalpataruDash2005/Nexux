import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import TopNav from './components/TopNav';
import WorkspaceList from './pages/WorkspaceList';
import AcademicWorkspace from './pages/AcademicWorkspace';
import Tasks from './pages/Tasks';
import Placement from './pages/Placement';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import OAuth2Callback from './pages/OAuth2Callback';
import { AuthProvider } from './context/AuthContext';

// Layout for pages that require the top navigation bar (Protected/App Routes)
const ProtectedLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <TopNav />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
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
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
