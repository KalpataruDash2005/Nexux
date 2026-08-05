import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Send, ArrowLeft, ChevronDown, CheckCircle2, XCircle, Lightbulb, Trophy } from 'lucide-react';
import {
  getSession, sendMessage, endSession, PlacementSession, InterviewFeedback,
} from '../../services/placementService';
import { Card, TypeBadge, DifficultyChip, Ring, ScoreBar, LoadingSpinner } from './ui';

interface ChatUiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback: InterviewFeedback | null;
}

const SESSION_DEFAULT: PlacementSession = {
  id: '',
  type: 'MOCK',
  mode: 'AI',
  role: null,
  company: null,
  difficulty: null,
  topic: null,
  status: 'ACTIVE',
  score: null,
  messageCount: null,
  createdAt: '',
  startedAt: null,
  endedAt: null,
};

const InterviewChat: React.FC<{
  sessionId: string;
  onBack: () => void;
  onSessionUpdated: (session: PlacementSession) => void;
}> = ({ sessionId, onBack, onSessionUpdated }) => {
  const [session, setSession] = useState<PlacementSession>(SESSION_DEFAULT);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getSession(sessionId)
      .then((detail) => {
        if (cancelled) return;
        setSession(detail.session);
        setMessages(
          detail.messages.map((m) => ({
            id: m.id,
            role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
            content: m.content,
            feedback: m.analysis,
          }))
        );
        if (detail.session.status.toUpperCase() === 'COMPLETED') {
          setCompleted(true);
          setFinalScore(detail.session.score);
          setFinalSummary(detail.session.endedAt ? 'This interview has been completed.' : null);
        }
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError(null);
    setSending(true);
    const localId = `local-${idRef.current++}`;
    setMessages((prev) => [...prev, { id: localId, role: 'user', content: text, feedback: null }]);
    try {
      const res = await sendMessage(sessionId, text);
      const feedback = res.feedback;
      setMessages((prev) => [
        ...prev.map((m) => (m.id === localId ? { ...m, feedback } : m)),
        ...(feedback?.nextQuestion
          ? [{ id: `ai-${idRef.current++}`, role: 'assistant' as const, content: feedback.nextQuestion, feedback: null }]
          : []),
      ]);
      setFinalScore(feedback.score);
      if (res.sessionCompleted) {
        setCompleted(true);
        setFinalSummary(res.finalSummary);
        try {
          const detail = await getSession(sessionId);
          setSession(detail.session);
          onSessionUpdated(detail.session);
        } catch {
          /* ignore refresh failure */
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleEnd = async () => {
    if (!window.confirm('End this interview now? The AI will score your performance so far.')) return;
    setError(null);
    try {
      const res = await endSession(sessionId);
      setSession((prev) => ({
        ...prev,
        status: 'COMPLETED',
        score: res.score ?? prev.score,
        endedAt: new Date().toISOString(),
      }));
      setCompleted(true);
      setFinalScore(res.score);
      setFinalSummary(res.summary);
      onSessionUpdated({ ...session, status: 'COMPLETED', score: res.score ?? session.score });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return <Card><LoadingSpinner label="Loading interview transcript..." /></Card>;
  }

  return (
    <Card className="flex h-[calc(100vh-15rem)] min-h-[520px] flex-col p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200" aria-label="Back to interviews">
            <ArrowLeft size={18} />
          </button>
          <TypeBadge type={session.type} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">
              {session.role || session.topic || 'Interview'} {session.company ? `@ ${session.company}` : ''}
            </p>
            <p className="text-xs text-slate-500">Live AI interview · {session.mode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session.difficulty && <DifficultyChip difficulty={session.difficulty} />}
          {!completed && (
            <button
              onClick={handleEnd}
              className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              End interview
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="phq-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
        )}

        {messages.length === 0 && !completed && (
          <div className="py-8 text-center text-sm text-slate-500">The interviewer is ready. Answer the first question below.</div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'phq-slide-in-left flex justify-end' : 'phq-slide-in flex justify-start'}>
            <div className={m.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%]'}>
              <div
                className={`flex items-start gap-3 ${
                  m.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'
                      : 'border border-violet-500/40 bg-violet-500/10 text-violet-300'
                  }`}
                >
                  {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white'
                      : 'border border-slate-800 bg-slate-900 text-slate-200'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="phq-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>

              {m.role === 'user' && m.feedback && <FeedbackPanel feedback={m.feedback} />}
            </div>
          </div>
        ))}

        {sending && (
          <div className="phq-slide-in flex justify-start">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300">
                <Bot size={15} />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                <span className="phq-typing-dot" />
                <span className="phq-typing-dot" />
                <span className="phq-typing-dot" />
              </div>
            </div>
          </div>
        )}

        {completed && <CompletionCard score={finalScore} summary={finalSummary} onNew={onBack} />}
      </div>

      {/* Input */}
      {!completed && (
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
              className="phq-scrollbar flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-emerald-500/50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send answer"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

const FeedbackPanel: React.FC<{ feedback: InterviewFeedback }> = ({ feedback }) => {
  const [open, setOpen] = useState(false);
  const axes: { label: string; value: number }[] = [
    { label: 'Confidence', value: feedback.scores.confidence },
    { label: 'Communication', value: feedback.scores.communication },
    { label: 'Grammar', value: feedback.scores.grammar },
    { label: 'Technical Accuracy', value: feedback.scores.technicalAccuracy },
    { label: 'Structure', value: feedback.scores.structure },
    { label: 'Completeness', value: feedback.scores.completeness },
  ];

  return (
    <div className="phq-fade-in mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <Ring value={feedback.score} size={72} stroke={7} gradientId="fbRing" label={`${Math.round(feedback.score)}`} sublabel="score" />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2">
          {axes.map((a) => (
            <ScoreBar key={a.label} label={a.label} value={a.value} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <CheckCircle2 size={13} /> Strengths
          </p>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-sm text-slate-300">· {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
            <XCircle size={13} /> To improve
          </p>
          <ul className="space-y-1">
            {feedback.weaknesses.map((s, i) => (
              <li key={i} className="text-sm text-slate-300">· {s}</li>
            ))}
          </ul>
        </div>
      </div>

      {feedback.improvementTips.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-400">
            <Lightbulb size={13} /> Improvement tips
          </p>
          <ul className="space-y-1">
            {feedback.improvementTips.map((t, i) => (
              <li key={i} className="text-sm text-slate-300">· {t}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.idealAnswer && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-2.5 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet-500/10"
        >
          View ideal answer
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && feedback.idealAnswer && (
        <div className="phq-fade-in mt-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="phq-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback.idealAnswer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

const CompletionCard: React.FC<{ score: number | null; summary: string | null; onNew: () => void }> = ({ score, summary, onNew }) => (
  <div className="phq-fade-up rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-violet-500/10 p-6 text-center">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
      <Trophy size={24} />
    </div>
    <h3 className="text-xl font-extrabold text-slate-100">Interview complete!</h3>
    {score != null && (
      <div className="mt-4 flex justify-center">
        <Ring value={score} size={120} stroke={11} gradientId="completionRing" label={`${Math.round(score)}`} sublabel="final score" />
      </div>
    )}
    {summary && (
      <div className="phq-markdown mt-4 text-left">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
      </div>
    )}
    <button
      onClick={onNew}
      className="mt-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40"
    >
      Start a new interview
    </button>
  </div>
);

export default InterviewChat;
