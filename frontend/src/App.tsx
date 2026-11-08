import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import TopNav from './components/TopNav';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import OAuth2Callback from './pages/OAuth2Callback';
import { AuthProvider, useAuth } from './context/AuthContext';
import AiAssistantWidget from './components/tasks/AiAssistantWidget';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';

// Code-split secondary pages for instant bundle evaluation and rapid auth redirect
const Placement = lazy(() => import('./pages/Placement'));
const AcademicWorkspace = lazy(() => import('./pages/AcademicWorkspace'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const WorkspaceList = lazy(() => import('./pages/WorkspaceList'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const PageFallback: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center p-8 bg-background">
    <div className="flex items-center gap-3 text-sm text-muted font-medium">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>Loading...</span>
    </div>
  </div>
);

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
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </div>
      {/* Floating AI assistant available on every authenticated page */}
      <AiAssistantWidget />
    </div>
  );
};

// Layout for public pages (Landing, Auth, Onboarding) that don't need TopNav
const PublicLayout: React.FC = () => {
  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  );
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
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/about" element={<AboutPage initialTab="about" />} />
                <Route path="/careers" element={<AboutPage initialTab="careers" />} />
                <Route path="/campuses" element={<AboutPage initialTab="campuses" />} />
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
                <Route
                  path="/admin-dashboard"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminDashboard />
                    </Suspense>
                  }
                />
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
