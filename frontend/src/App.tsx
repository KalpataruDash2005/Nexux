import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HealthCheck from './pages/HealthCheck';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col justify-between">
        <header className="border-b border-card-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚀</span>
              <span className="font-bold text-xl tracking-wider text-white">CareerOS</span>
            </div>
            <div className="text-xs px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
              PRE-ALPHA
            </div>
          </div>
        </header>

        <main className="flex-grow flex items-center justify-center">
          <Routes>
            <Route path="/health" element={<HealthCheck />} />
            <Route path="*" element={<Navigate to="/health" replace />} />
          </Routes>
        </main>

        <footer className="border-t border-card-border bg-card/20 py-6 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} CareerOS. All rights reserved.
        </footer>
      </div>
    </Router>
  );
};

export default App;
