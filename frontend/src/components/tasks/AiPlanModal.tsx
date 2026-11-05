import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Loader2, X, AlertTriangle, CheckCircle2, BookmarkCheck, Calendar } from 'lucide-react';
import { generateAiPlan, persistAiPlan, errorMessage } from '../../services/taskService';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenCreateTask?: () => void;
}

const AiPlanModal: React.FC<Props> = ({ open, onClose, onOpenCreateTask }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>('');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPlan('');
    setSaveSuccess(null);
    setSaveError(null);
    generateAiPlan()
      .then((res) => {
        setPlan(res.plan);
        setPendingCount(res.pendingCount ?? (res.plan.includes('No Pending Tasks') ? 0 : 1));
      })
      .catch((err) => setError(errorMessage(err, 'Could not generate an AI plan.')))
      .finally(() => setLoading(false));
  }, [open]);

  const handlePersist = async () => {
    if (!plan || isSaving || saveSuccess) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await persistAiPlan(plan, true);
      setSaveSuccess(res.message || 'Plan successfully applied and saved!');
    } catch (err: any) {
      setSaveError(errorMessage(err, 'Could not save the plan. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  const isZeroTasks = pendingCount === 0 || plan.includes('No Pending Tasks');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl shadow-black/10">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight text-foreground">AI Task Planner</h2>
                {!loading && !isZeroTasks && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    {saveSuccess ? 'Persisted Plan' : 'Generated Preview'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">A step-by-step grounded plan for your pending tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
            aria-label="Close AI plan"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm font-medium text-muted">Crafting your grounded action plan...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {!loading && !error && isZeroTasks && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
                <Calendar size={26} />
              </div>
              <h3 className="text-base font-extrabold text-foreground">No Pending Tasks</h3>
              <p className="max-w-md text-xs text-muted leading-relaxed">
                You have no pending tasks on your board right now! To generate an optimized, time-blocked daily action plan, create your tasks first.
              </p>
              <button
                onClick={() => {
                  onClose();
                  if (onOpenCreateTask) onOpenCreateTask();
                }}
                className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-card transition-all hover:bg-primary-hover"
              >
                + Create a Task
              </button>
            </div>
          )}

          {!loading && !error && !isZeroTasks && (
            <div className="space-y-4">
              {saveSuccess && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                  <BookmarkCheck size={18} className="shrink-0 text-emerald-600" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                  <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="ai-plan-markdown text-sm leading-relaxed text-foreground">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="mb-3 mt-4 text-xl font-extrabold text-foreground first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold text-foreground">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-1 mt-3 text-base font-bold text-foreground">{children}</h3>,
                    p: ({ children }) => <p className="my-2 text-foreground">{children}</p>,
                    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-foreground">{children}</ul>,
                    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-foreground">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-bold text-emerald-700">{children}</strong>,
                    em: ({ children }) => <em className="italic text-muted">{children}</em>,
                    blockquote: ({ children }) => (
                      <blockquote className="my-3 border-l-4 border-primary-soft pl-4 italic text-muted">{children}</blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-tag-bg px-1.5 py-0.5 font-mono text-xs text-primary">{children}</code>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {plan}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-xs text-muted">
            {!loading && !isZeroTasks ? `${pendingCount} pending task${pendingCount === 1 ? '' : 's'} included` : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-slate-100"
            >
              Close
            </button>
            {!loading && !error && !isZeroTasks && (
              <button
                onClick={handlePersist}
                disabled={isSaving || !!saveSuccess}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition-all shadow-card ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-primary text-white hover:bg-primary-hover disabled:opacity-50'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Applying Plan...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Plan Saved</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck size={14} />
                    <span>Apply & Save Plan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPlanModal;
