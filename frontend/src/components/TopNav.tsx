import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Briefcase, Search, Bell, Command, Folder, LogOut, CheckSquare } from 'lucide-react';import { getMyProfile } from '../services/profileService';
import { StudentProfileDto } from '../types/profile';
import { getWorkspaces, Workspace } from '../services/workspaceService';
import { useAuth } from '../context/AuthContext';

const TopNav: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfileDto | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    getMyProfile().then(setProfile).catch(console.error);
    getWorkspaces().then(setWorkspaces).catch(console.error);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const displayName = () => {
    if (profile?.firstName) {
      return `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`;
    }
    if (user?.email) {
      return user.email.split('@')[0] || 'there';
    }
    return 'there';
  };

  const subtitle = () => {
    if (profile?.degree) return profile.degree;
    if (user?.email) return user.email;
    return '';
  };

  const getInitials = () => {
    if (profile?.firstName) {
      return (profile.firstName.charAt(0) + (profile.lastName ? profile.lastName.charAt(0) : '')).toUpperCase();
    }
    const name = displayName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const trimmedQuery = query.trim().toLowerCase();
  const results = trimmedQuery
    ? workspaces
        .filter((ws) =>
          ws.name.toLowerCase().includes(trimmedQuery) ||
          (ws.description || '').toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 6)
    : [];

  const openResult = (ws: Workspace) => {
    setQuery('');
    setFocused(false);
    navigate(`/workspaces/${ws.id}`);
  };

  return (
    <nav className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center space-x-8">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
            <div className="absolute inset-0 border-t-2 border-l-2 border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></div>
            <div className="absolute inset-0 border-b-2 border-r-2 border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></div>
            <span className="font-black text-xs text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[-1px]">
              N
            </span>
          </div>
          <span className="font-extrabold text-xl tracking-wide text-slate-850">Nexora</span>
        </div>

        {/* Links */}
        <div className="flex space-x-1">
          <NavLink to="/dashboard" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-purple-700 bg-purple-50" : "text-gray-600 hover:bg-gray-50")}>
            <Home size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/workspaces" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-purple-700 bg-purple-50" : "text-gray-600 hover:bg-gray-50")}>
            <BookOpen size={18} />
            <span>Academics</span>
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-purple-700 bg-purple-50" : "text-gray-600 hover:bg-gray-50")}>
            <CheckSquare size={18} />
            <span>Tasks</span>
          </NavLink>
          <NavLink to="/placement" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-purple-700 bg-purple-50" : "text-gray-600 hover:bg-gray-50")}>
            <Briefcase size={18} />
            <span>Placement</span>
          </NavLink>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative" ref={searchBoxRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search workspaces..."
            className="pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocused(true);
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                setFocused(false);
              } else if (e.key === 'Enter' && results.length > 0) {
                openResult(results[0]);
              }
            }}
          />
          {!query && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1 text-gray-400 pointer-events-none">
              <Command size={14} />
              <span className="text-xs font-medium">K</span>
            </div>
          )}

          {focused && trimmedQuery && (
            <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No workspaces match "{query}".</p>
              ) : (
                results.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => openResult(ws)}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-purple-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 shrink-0">
                      <Folder size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ws.name}</p>
                      <p className="text-xs text-gray-400 truncate">{ws.description || 'No description'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button onClick={() => alert('You have no new notifications.')} className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-full">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-purple-600 rounded-full"></span>
        </button>

        {/* Profile */}
        <div className="flex items-center space-x-3 border-l pl-4 pr-2">
          <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold">
            {getInitials()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{displayName()}</span>
            <span className="text-xs text-gray-500 truncate max-w-[160px]">{subtitle() || 'Academic'}</span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate('/auth');
          }}
          className="flex items-center space-x-2 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-medium text-sm border border-transparent hover:border-red-100 shrink-0"
          title="Logout"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default TopNav;
