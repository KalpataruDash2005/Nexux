import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Briefcase, Search, Bell, Command, Folder, LogOut, CheckSquare, AlertTriangle, Clock, MailCheck, Loader2 } from 'lucide-react';import { getMyProfile } from '../services/profileService';
import { StudentProfileDto } from '../types/profile';
import { getWorkspaces, Workspace } from '../services/workspaceService';
import { getTasks, getTaskSummary, Task, TaskSummary } from '../services/taskService';
import { semanticSearch, SearchResult } from '../services/searchService';
import { sendPendingWorkReminder } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ui/Toast';

const TopNav: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfileDto | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [bellOpen, setBellOpen] = useState(false);
  const [summary, setSummary] = useState<TaskSummary>({ total: 0, completed: 0, pending: 0, overdue: 0 });
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [bellSending, setBellSending] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPending = async () => {
    try {
      const s = await getTaskSummary();
      setSummary(s ?? { total: 0, completed: 0, pending: 0, overdue: 0 });
    } catch {
      /* ignore */
    }
    try {
      const tasks = await getTasks();
      setTaskList(tasks);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadPending();
    const timer = setInterval(loadPending, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const overdueTasks = taskList.filter((t) => t.status === 'PENDING' && t.deadline && new Date(t.deadline) < new Date());
  const pendingTasks = taskList.filter((t) => t.status === 'PENDING' && t.deadline && new Date(t.deadline) >= new Date());
  const attention = overdueTasks.length + pendingTasks.length;

  const handleSendReminder = async () => {
    setBellSending(true);
    try {
      const res = await sendPendingWorkReminder();
      toast(
        res.overdue + res.pending > 0
          ? `Reminder sent to your email (${res.overdue} overdue, ${res.pending} pending).`
          : 'You are all caught up — no pending tasks.',
        'success'
      );
    } catch {
      toast('Could not send the email reminder. Please try again.', 'error');
    } finally {
      setBellSending(false);
    }
  };

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
    if (user?.name) {
      return user.name;
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
  };  const trimmedQuery = query.trim().toLowerCase();
  const workspaceResults = trimmedQuery
    ? workspaces
        .filter((ws) =>
          ws.name.toLowerCase().includes(trimmedQuery) ||
          (ws.description || '').toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 6)
    : [];
  const results = workspaceResults;
  const showSemantic = trimmedQuery && semanticResults.length > 0;

  const openResult = (ws: Workspace) => {
    setQuery('');
    setFocused(false);
    navigate(`/workspaces/${ws.id}`);
  };

  const openSemanticResult = (r: SearchResult) => {
    const ws = workspaces.find((w) => w.id === r.documentId.split(':')[0] || w.id === r.documentId);
    setQuery('');
    setFocused(false);
    if (ws) {
      navigate(`/workspaces/${ws.id}`);
    }
  };

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!trimmedQuery || workspaces.length === 0) {
      setSemanticResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const batches = await Promise.allSettled(
        workspaces.slice(0, 3).map((ws) => semanticSearch(ws.id, trimmedQuery, 3))
      );
      const collected: SearchResult[] = [];
      batches.forEach((b, i) => {
        if (b.status === 'fulfilled') {
          b.value.forEach((r) => {
            collected.push({ ...r, documentId: `${workspaces[i].id}:${r.documentId}` });
          });
        }
      });
      collected.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setSemanticResults(collected.slice(0, 5));
      setSearching(false);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [trimmedQuery, workspaces]);

  return (
    <nav className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center space-x-8">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3" aria-label="Nexora home">
          <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
            <div className="absolute inset-0 border-t-2 border-l-2 border-sky-400 rounded-tl-sm w-3/4 h-3/4 left-0 top-0"></div>
            <div className="absolute inset-0 border-b-2 border-r-2 border-indigo-500 rounded-br-sm w-3/4 h-3/4 right-0 bottom-0"></div>
            <span className="font-black text-xs text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-indigo-500 leading-none mt-[-1px]">
              N
            </span>
          </div>
          <span className="font-extrabold text-xl tracking-wide text-slate-850">Nexora</span>
        </Link>

        {/* Links */}
        <div className="flex space-x-1">
          <NavLink to="/dashboard" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-primary bg-primary-tint" : "text-gray-600 hover:bg-gray-50")}>
            <Home size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/workspaces" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-primary bg-primary-tint" : "text-gray-600 hover:bg-gray-50")}>
            <BookOpen size={18} />
            <span>Academics</span>
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-primary bg-primary-tint" : "text-gray-600 hover:bg-gray-50")}>
            <CheckSquare size={18} />
            <span>Tasks</span>
          </NavLink>
          <NavLink to="/placement" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-primary bg-primary-tint" : "text-gray-600 hover:bg-gray-50")}>
            <Briefcase size={18} />
            <span>Placement</span>
          </NavLink>
          {user?.role?.toUpperCase() === 'ADMIN' && (
            <NavLink to="/admin-dashboard" className={({ isActive }) => "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors " + (isActive ? "text-primary bg-primary-tint" : "text-gray-600 hover:bg-gray-50")}>
              <Command size={18} />
              <span>Admin</span>
            </NavLink>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative" ref={searchBoxRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search workspaces..."
            className="pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary w-64"
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
              {searching ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Searching your notes...
                </div>
              ) : results.length === 0 && !showSemantic ? (
                <p className="px-4 py-3 text-sm text-gray-400">No matches for "{query}".</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {results.length > 0 && (
                    <>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Workspaces</p>
                      {results.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => openResult(ws)}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-primary-tint transition-colors"
                        >
                          <div className="w-8 h-8 bg-primary-tint rounded-lg flex items-center justify-center text-primary shrink-0">
                            <Folder size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{ws.name}</p>
                            <p className="text-xs text-gray-400 truncate">{ws.description || 'No description'}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {showSemantic && (
                    <>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">In your notes</p>
                      {semanticResults.map((r) => (
                        <button
                          key={r.documentId}
                          onClick={() => openSemanticResult(r)}
                          className="w-full flex items-start space-x-3 px-4 py-3 text-left hover:bg-primary-tint transition-colors"
                        >
                          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 shrink-0">
                            <BookOpen size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.documentName}</p>
                            <p className="text-xs text-gray-400 line-clamp-2">{r.content}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => {
              setBellOpen((o) => !o);
              if (!bellOpen) loadPending();
            }}
            className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {attention > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${overdueTasks.length > 0 ? 'bg-error' : 'bg-primary'}`}>
                {attention}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50 animate-[fadeInUp_0.2s_ease-out]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">Pending work</p>
                <span className="text-xs font-semibold text-muted">
                  {summary.overdue} overdue · {summary.pending} pending
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {overdueTasks.length === 0 && pendingTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <MailCheck size={18} />
                    </div>
                    <p className="text-sm font-medium text-gray-900">You're all caught up!</p>
                    <p className="text-xs text-muted">No overdue or pending tasks.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {overdueTasks.map((t) => (
                      <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-error" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{t.title}</p>
                          <p className="text-xs text-error">Overdue · {formatDate(t.deadline!)}</p>
                        </div>
                      </div>
                    ))}
                    {pendingTasks.map((t) => (
                      <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                        <Clock size={15} className="mt-0.5 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{t.title}</p>
                          <p className="text-xs text-muted">Due {formatDate(t.deadline!)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 p-3">
                <button
                  onClick={handleSendReminder}
                  disabled={bellSending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {bellSending ? <Loader2 size={15} className="animate-spin" /> : <MailCheck size={15} />}
                  {bellSending ? 'Sending...' : 'Send email reminder'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="flex items-center space-x-3 border-l pl-4 pr-2">
          <div className="w-9 h-9 bg-primary-tint rounded-full flex items-center justify-center text-primary font-bold">
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
