import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Loader2, X, AlertTriangle } from 'lucide-react';
import { generateAiPlan, errorMessage } from '../../services/taskService';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AiPlanModal: React.FC<Props> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPlan('');
    generateAiPlan()
      .then((res) => setPlan(res.plan))
      .catch((err) => setError(errorMessage(err, 'Could not generate an AI plan.')))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-100">AI Task Planner</h2>
              <p className="text-xs text-slate-400">A step-by-step plan for your pending tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
            aria-label="Close AI plan"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 size={32} className="animate-spin text-emerald-400" />
              <p className="text-sm font-medium text-slate-400">Crafting your optimized plan...</p>
            </div>
          )}
          {!loading && error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-400" />
              <p className="text-sm text-rose-200">{error}</p>
            </div>
          )}
          {!loading && !error && (
            <div className="ai-plan-markdown text-sm leading-relaxed text-slate-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="mb-3 mt-4 text-xl font-extrabold text-slate-100 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold text-slate-100">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-1 mt-3 text-base font-bold text-slate-100">{children}</h3>,
                  p: ({ children }) => <p className="my-2 text-slate-300">{children}</p>,
                  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-slate-300">{children}</ul>,
                  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-slate-300">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="font-bold text-emerald-300">{children}</strong>,
                  em: ({ children }) => <em className="italic text-slate-400">{children}</em>,
                  blockquote: ({ children }) => (
                    <blockquote className="my-3 border-l-4 border-emerald-500/50 pl-4 italic text-slate-400">{children}</blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-emerald-300">{children}</code>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
                      {children}
                    </a>
                  ),
                }}
              >
                {plan}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiPlanModal;
