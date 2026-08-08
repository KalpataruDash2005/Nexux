import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  getAllUsers,
  getAllJobsForAdmin,
  UserAdminDto,
  getAllFeedback,
  updateFeedbackStatus,
  deleteFeedback,
  FeedbackAdminDto,
  getAptitudeSets,
  uploadAptitudeSet,
  deleteAptitudeSet,
  AptitudeSetDto,
} from '../services/adminService';
import { useToast } from '../components/ui/Toast';
import { JobDto } from '../types/job';

type Tab = 'overview' | 'feedback' | 'aptitude';

const roleBadge = (role: string) => {
  if (role === 'ADMIN') return 'bg-red-50 text-red-600';
  if (role === 'RECRUITER') return 'bg-violet-50 text-violet-600';
  return 'bg-indigo-50 text-indigo-600';
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const tabFromQuery = (new URLSearchParams(location.search).get('tab') || 'overview') as Tab;
  const [tab, setTab] = useState<Tab>(tabFromQuery);
  const [users, setUsers] = useState<UserAdminDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [feedback, setFeedback] = useState<FeedbackAdminDto[]>([]);
  const [sets, setSets] = useState<AptitudeSetDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [setTitle, setSetTitle] = useState('');

  if (user?.role?.toUpperCase() !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    setTab(tabFromQuery);
  }, [location.search]);

  useEffect(() => {
    if (user?.role?.toUpperCase() !== 'ADMIN') return;
    if (tab === 'overview') {
      Promise.all([getAllUsers(), getAllJobsForAdmin()])
        .then(([u, j]) => { setUsers(u); setJobs(j); })
        .catch((err) => console.error('Failed to fetch admin data', err));
    } else if (tab === 'feedback') {
      getAllFeedback().then(setFeedback).catch(() => toast('Could not load feedback', 'error'));
    } else if (tab === 'aptitude') {
      getAptitudeSets().then(setSets).catch(() => toast('Could not load aptitude sets', 'error'));
    }
  }, [tab, user?.role]);

  const go = (next: Tab) => navigate(next === 'overview' ? '/admin-dashboard' : `/admin-dashboard?tab=${next}`);

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateFeedbackStatus(id, status);
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
      toast('Feedback status updated', 'success');
    } catch {
      toast('Could not update feedback status', 'error');
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    try {
      await deleteFeedback(id);
      setFeedback((prev) => prev.filter((f) => f.id !== id));
      toast('Feedback deleted', 'success');
    } catch {
      toast('Could not delete feedback', 'error');
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) {
      toast('Please choose a PDF file first', 'error');
      return;
    }
    setUploading(true);
    try {
      await uploadAptitudeSet(file, setTitle.trim() || undefined);
      setSetTitle('');
      toast('Aptitude set imported successfully', 'success');
      const updated = await getAptitudeSets();
      setSets(updated);
    } catch (err) {
      const resp = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response
        : undefined;
      toast(resp?.data?.message || 'Could not import the aptitude set', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSet = async (id: string) => {
    try {
      await deleteAptitudeSet(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
      toast('Aptitude set deleted', 'success');
    } catch {
      toast('Could not delete aptitude set', 'error');
    }
  };

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => go(key)}
      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
        tab === key ? 'bg-primary text-white shadow-card' : 'bg-white text-muted hover:bg-surface-tint hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Admin <span className="bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">Control Center</span>
        </h1>
      </div>

      <div className="mb-8 flex gap-2">
        {tabBtn('overview', 'Overview')}
        {tabBtn('feedback', 'Feedback')}
        {tabBtn('aptitude', 'Aptitude Sets')}
      </div>

      {tab === 'overview' && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-2 text-sm font-medium text-muted">Total Users</h2>
              <div className="text-4xl font-bold text-foreground">{users.length}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-2 text-sm font-medium text-muted">Total Jobs Posted</h2>
              <div className="text-4xl font-bold text-foreground">{jobs.length}</div>
            </div>
          </div>

          <section className="mb-8">
            <h2 className="mb-4 border-b border-border pb-2 text-xl font-semibold text-foreground">Registered Users</h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Joined At</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border transition-colors hover:bg-surface-tint">
                      <td className="px-6 py-4 font-mono text-xs text-muted">{u.id}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${roleBadge(u.role)}`}>{u.role}</span>
                      </td>
                      <td className="px-6 py-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-border pb-2 text-xl font-semibold text-foreground">All Job Postings</h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Job Title</th>
                    <th className="px-6 py-4">Company</th>
                    <th className="px-6 py-4">Posted By</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t border-border transition-colors hover:bg-surface-tint">
                      <td className="px-6 py-4 font-medium text-foreground">{j.title}</td>
                      <td className="px-6 py-4">{j.companyName}</td>
                      <td className="px-6 py-4">{j.postedByEmail}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${
                          j.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'feedback' && (
        <section>
          <h2 className="mb-4 border-b border-border pb-2 text-xl font-semibold text-foreground">
            Feedback Submissions <span className="text-sm font-normal text-muted">({feedback.length})</span>
          </h2>
          {feedback.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted">
              No feedback submissions yet.
            </div>
          ) : (
            <div className="space-y-4">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${
                        f.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' :
                        f.status === 'READ' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>{f.status}</span>
                      <span className="font-medium text-foreground">{f.name || 'Anonymous'}</span>
                      <span className="text-sm text-muted">{f.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.status === 'NEW' && (
                        <button onClick={() => handleStatus(f.id, 'READ')} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-tint">
                          Mark read
                        </button>
                      )}
                      {f.status !== 'RESOLVED' && (
                        <button onClick={() => handleStatus(f.id, 'RESOLVED')} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600">
                          Mark resolved
                        </button>
                      )}
                      <button onClick={() => handleDeleteFeedback(f.id)} className="rounded-lg border border-error/30 px-3 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error/5">
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{f.message}</p>
                  <p className="mt-3 text-xs text-muted">{new Date(f.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'aptitude' && (
        <section>
          <h2 className="mb-4 border-b border-border pb-2 text-xl font-semibold text-foreground">Aptitude Question Banks</h2>

          <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Upload an aptitude question bank (PDF)</h3>
            <input
              type="text"
              value={setTitle}
              onChange={(e) => setSetTitle(e.target.value)}
              placeholder="Set title (optional)"
              className="mb-3 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary">
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} disabled={uploading} />
              <span className="text-sm text-muted">
                {uploading ? 'Processing PDF — extracting questions...' : 'Click to choose a PDF — questions are extracted and added to randomized tests'}
              </span>
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase text-muted">
                <tr>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">File</th>
                  <th className="px-6 py-4">Questions</th>
                  <th className="px-6 py-4">Uploaded At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sets.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-16 text-center text-muted">No aptitude sets uploaded yet.</td></tr>
                ) : sets.map((s) => (
                  <tr key={s.id} className="border-t border-border transition-colors hover:bg-surface-tint">
                    <td className="px-6 py-4 font-medium text-foreground">{s.title}</td>
                    <td className="px-6 py-4">{s.fileName || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="rounded px-2 py-1 text-xs font-semibold bg-orange-50 text-orange-600">{s.questionCount}</span>
                    </td>
                    <td className="px-6 py-4">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDeleteSet(s.id)} className="rounded-lg border border-error/30 px-3 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error/5">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminDashboard;