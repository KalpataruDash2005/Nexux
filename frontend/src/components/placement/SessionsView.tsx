import React, { useEffect, useState } from 'react';
import { History, Eye, Play, X, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import {
  getSessions, getSession, deleteSession, PlacementSession, SessionDetail, InterviewFeedback,
} from '../../services/placementService';
import {
  Card, SectionTitle, TypeBadge, DifficultyChip, Pill, LoadingSpinner, ErrorBanner,
  EmptyState, Ring, ScoreBar, formatDate, formatDateTime, PlacementNavProps,
} from './ui';
import { useToast } from '../ui/Toast';

const SessionModal: React.FC<{ detail: SessionDetail; onClose: () => void }> = ({ detail, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
    <div
      className="phq-fade-in phq-scrollbar flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <TypeBadge type={detail.session.type} />
          <div>
            <p className="text-sm font-bold text-foreground">
              {detail.session.role || detail.session.topic || 'Session'}
            </p>
            <p className="text-xs text-muted">{formatDateTime(detail.session.createdAt)}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-muted transition-colors hover:bg-tag-bg" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="phq-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {detail.messages.length === 0 ? (
          <EmptyState icon={<MessageSquare size={26} />} title="No messages in this session" />
        ) : (
          detail.messages.map((m) => (
            <div key={m.id} className="space-y-2">
              <div className={`flex items-start gap-3 ${m.role.toLowerCase() === 'user' ? 'justify-end' : ''}`}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tag-bg text-xs font-bold text-muted">
                  {m.role.toLowerCase() === 'user' ? 'You' : 'AI'}
                </div>
                <div className="max-w-[85%] rounded-2xl border border-border bg-tag-bg px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{m.content}</p>
                </div>
              </div>
              {m.analysis && <InlineAnalysis feedback={m.analysis} />}
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

const InlineAnalysis: React.FC<{ feedback: InterviewFeedback }> = ({ feedback }) => (
  <div className="ml-10 rounded-xl border border-primary-soft bg-primary-tint p-3">
    <div className="flex items-center gap-3">
      <Ring value={feedback.score ?? 0} size={48} stroke={5} gradientId="sessRing" label={`${Math.round(feedback.score ?? 0)}`} />
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1">
        <ScoreBar label="Confidence" value={feedback.scores?.confidence ?? 0} />
        <ScoreBar label="Communication" value={feedback.scores?.communication ?? 0} />
        <ScoreBar label="Grammar" value={feedback.scores?.grammar ?? 0} />
        <ScoreBar label="Technical" value={feedback.scores?.technicalAccuracy ?? 0} />
      </div>
    </div>
  </div>
);

const SessionsView: React.FC<PlacementNavProps> = ({ onNavigate }) => {
  const [sessions, setSessions] = useState<PlacementSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
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
    load();
  }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(await getSession(id));
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleContinue = (s: PlacementSession) => {
    onNavigate('interview', s.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this session? Its transcript and score will be permanently removed.')) return;
    setDeletingId(id);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (detail?.session.id === id) setDetail(null);
      toast('Session deleted.', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const active = sessions.filter((s) => s.status.toUpperCase() === 'ACTIVE');
  const completed = sessions.filter((s) => s.status.toUpperCase() !== 'ACTIVE');

  const renderRow = (s: PlacementSession) => (
    <div
      key={s.id}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary-soft"
    >
      <TypeBadge type={s.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {s.role || s.topic || 'Session'} {s.company ? `@ ${s.company}` : ''}
        </p>
        <p className="text-xs text-muted">
          {s.mode} · {formatDate(s.createdAt)} · {s.messageCount ?? 0} messages
        </p>
      </div>
      {s.difficulty && <DifficultyChip difficulty={s.difficulty} />}
      {s.status.toUpperCase() === 'ACTIVE' ? (
        <Pill tone="amber"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 phq-pulse-soft" /> Active</Pill>
      ) : (
        <Pill tone="slate">Completed</Pill>
      )}
      {s.score != null && <Pill tone="emerald">Score {Math.round(s.score)}</Pill>}
      <div className="flex gap-2">
        {s.status.toUpperCase() === 'ACTIVE' && s.type !== 'CODING' && s.type !== 'APTITUDE' && (
          <button
            onClick={() => handleContinue(s)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <Play size={13} />
            Continue
          </button>
        )}
        <button
          onClick={() => openDetail(s.id)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:border-primary-soft"
        >
          <Eye size={13} />
          View
        </button>
        <button
          onClick={() => handleDelete(s.id)}
          disabled={deletingId === s.id}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-error transition-colors hover:border-error hover:bg-error/5 disabled:opacity-50"
          title="Delete session"
        >
          {deletingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="phq-fade-in space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
          <History size={24} className="text-emerald-600" />
          All Sessions
        </h2>
        <p className="mt-1 text-sm text-muted">Every interview, coding run and aptitude attempt, in one place.</p>
      </div>

      {loading ? (
        <Card><LoadingSpinner label="Loading sessions..." /></Card>
      ) : error ? (
        <Card><ErrorBanner message={error} onRetry={load} /></Card>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState icon={<History size={26} />} title="No sessions yet" subtitle="Start an interview, coding problem or aptitude test to see it here." />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <Card>
              <SectionTitle icon={<Play size={16} />} title="Active Sessions" />
              <div className="space-y-3">{active.map(renderRow)}</div>
            </Card>
          )}
          {completed.length > 0 && (
            <Card>
              <SectionTitle icon={<History size={16} />} title="Completed Sessions" subtitle={`${completed.length} total`} />
              <div className="space-y-3">{completed.map(renderRow)}</div>
            </Card>
          )}
        </>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl bg-white p-6"><LoadingSpinner label="Loading transcript..." /></div>
        </div>
      )}
      {detail && <SessionModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

export default SessionsView;
