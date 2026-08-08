import React, { useEffect, useState } from 'react';
import { MessageSquare, Play, Loader2, User, Building2, AlertTriangle } from 'lucide-react';
import {
  createSession, startSession, getSessions, getResumes,
  PlacementSession, ResumeListItem, SessionType, SessionDifficulty,
} from '../../services/placementService';
import { Card, SectionTitle, TypeBadge, DifficultyChip, Pill, LoadingSpinner, ErrorBanner, EmptyState, formatDate, PlacementNavProps } from './ui';
import InterviewChat from './InterviewChat';

const INTERVIEW_TYPES: { value: SessionType; label: string }[] = [
  { value: 'MOCK', label: 'Mock Interview' },
  { value: 'ROLE', label: 'Role-based' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'HR', label: 'HR' },
  { value: 'BEHAVIORAL', label: 'Behavioral' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'DSA_ORAL', label: 'DSA Oral' },
];

const DIFFICULTIES: SessionDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

const InterviewHub: React.FC<PlacementNavProps & {
  openSessionId: string | null;
  onSessionOpened: () => void;
}> = ({ openSessionId, onSessionOpened }) => {
  const [sessions, setSessions] = useState<PlacementSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);

  const [type, setType] = useState<SessionType>('MOCK');
  const [mode, setMode] = useState<'AI' | 'RESUME'>('AI');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [difficulty, setDifficulty] = useState<SessionDifficulty>('MEDIUM');
  const [resumeId, setResumeId] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await getSessions());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    getResumes().then(setResumes).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (openSessionId) {
      setActiveChat(openSessionId);
      onSessionOpened();
    }
  }, [openSessionId, onSessionOpened]);

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const body = {
        type,
        mode,
        role: role.trim() || 'Software Engineer',
        company: company.trim(),
        difficulty,
        ...(mode === 'RESUME' && resumeId ? { resumeId } : {}),
      };
      const session = await createSession(body);
      await startSession(session.id);
      setActiveChat(session.id);
      loadSessions();
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (activeChat) {
    return (
      <InterviewChat
        sessionId={activeChat}
        onBack={() => {
          setActiveChat(null);
          loadSessions();
        }}
        onSessionUpdated={(updated) => {
          setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
      />
    );
  }

  const interviewSessions = sessions.filter((s) => s.type !== 'CODING' && s.type !== 'APTITUDE');

  return (
    <div className="phq-fade-in grid gap-6 lg:grid-cols-5">
      {/* Launcher */}
      <Card className="lg:col-span-2 h-fit">
        <SectionTitle icon={<MessageSquare size={16} />} title="New Interview" subtitle="Launch an AI-powered mock interview" />
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Interview type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SessionType)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            >
              {INTERVIEW_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(['AI', 'RESUME'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    mode === m
                      ? 'border-primary-soft bg-primary-soft text-primary'
                      : 'border-border text-muted hover:border-primary-soft'
                  }`}
                >
                  {m === 'AI' ? 'AI only' : 'Resume-based'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Target role</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Software Engineer, Product Manager"
                className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Company (optional)</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Google, Infosys"
                className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                    difficulty === d
                      ? 'border-primary-soft bg-primary-soft text-primary'
                      : 'border-border text-muted hover:border-primary-soft'
                  }`}
                >
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {mode === 'RESUME' && (
            <div className="phq-fade-in">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Use resume</label>
              <select
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Select a resume…</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>{r.fileName}</option>
                ))}
              </select>
              {resumes.length === 0 && (
                <p className="mt-1.5 text-xs text-muted">No saved resumes found — analyze one in the Resume tab.</p>
              )}
            </div>
          )}

          {startError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {startError}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={starting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 text-sm font-bold text-white shadow-card transition-all hover:shadow-lg disabled:opacity-50"
          >
            {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {starting ? 'Starting interview...' : 'Start interview'}
          </button>
        </div>
      </Card>

      {/* Sessions list */}
      <Card className="lg:col-span-3">
        <SectionTitle icon={<MessageSquare size={16} />} title="Your Interviews" subtitle="Active and past mock interviews" />
        {loading ? (
          <LoadingSpinner label="Loading interviews..." />
        ) : error ? (
          <ErrorBanner message={error} onRetry={loadSessions} />
        ) : interviewSessions.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={26} />}
            title="No interviews yet"
            subtitle="Launch your first mock interview to start practicing."
          />
        ) : (
          <div className="space-y-3">
            {interviewSessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary-soft"
              >
                <TypeBadge type={s.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {s.role || s.topic || 'Interview'} {s.company ? `@ ${s.company}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {s.mode} · {formatDate(s.createdAt)} · {s.messageCount ?? 0} messages
                  </p>
                </div>
                {s.difficulty && <DifficultyChip difficulty={s.difficulty} />}
                {s.status.toUpperCase() === 'COMPLETED' && s.score != null && (
                  <Pill tone="emerald">Score {Math.round(s.score)}</Pill>
                )}
                {s.status.toUpperCase() === 'ACTIVE' && (
                  <Pill tone="amber"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 phq-pulse-soft" /> Active</Pill>
                )}
                <button
                  onClick={() => setActiveChat(s.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <Play size={13} />
                  {s.status.toUpperCase() === 'ACTIVE' ? 'Continue' : 'Review'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InterviewHub;
