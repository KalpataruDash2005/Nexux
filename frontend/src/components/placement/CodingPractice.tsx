import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Code2, Play, ChevronDown, Lightbulb, Layers, Timer, RotateCcw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createCodingSession, submitCoding, CodingProblem, CodingEvaluation } from '../../services/placementService';
import { Card, SectionTitle, Pill, Ring, ScoreBar } from './ui';

const TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Graphs',
  'Dynamic Programming', 'Hashing', 'Sorting & Searching', 'Recursion & Backtracking', 'Math',
];

const LANGUAGES = ['Java', 'Python', 'C++', 'JavaScript'];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

const STARTER_CODE: Record<string, string> = {
  Java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}',
  Python: 'def solution():\n    # Write your solution here\n    pass',
  'C++': '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
  JavaScript: 'function solution() {\n  // Write your solution here\n}',
};

const CodingPractice: React.FC = () => {
  const [role, setRole] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [language, setLanguage] = useState('Python');
  const [code, setCode] = useState(STARTER_CODE.Python);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<CodingEvaluation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [altOpen, setAltOpen] = useState(false);

  const resetEditor = () => {
    setCode(STARTER_CODE[language] ?? STARTER_CODE.Python);
  };

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await createCodingSession({ role: role.trim() || 'Software Engineer', topic, difficulty });
      setSessionId(res.sessionId);
      setProblem(res.problem);
      setLanguage('Python');
      setCode(STARTER_CODE.Python);
      setEvaluation(null);
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitCoding(sessionId, { language, code });
      setEvaluation(res.evaluation);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setEvaluation(null);
    setProblem(null);
    setSessionId(null);
    setStartError(null);
    setSubmitError(null);
  };

  if (!problem) {
    return (
      <div className="phq-fade-in mx-auto max-w-2xl">
        <Card>
          <div className="mb-6 flex items-center gap-2 text-emerald-400">
            <Code2 size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Coding Arena</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100">Coding Practice</h2>
          <p className="mt-1 text-sm text-slate-400">Get an AI-generated DSA problem tailored to your target role, then submit and receive a detailed evaluation.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Target role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Backend Engineer"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Topic</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                      topic === t
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                      difficulty === d
                        ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {startError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {startError}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={starting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:opacity-50"
            >
              {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {starting ? 'Generating problem...' : 'Start coding'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const diffTone = difficulty === 'EASY' ? 'emerald' : difficulty === 'HARD' ? 'rose' : 'amber';

  return (
    <div className="phq-fade-in space-y-6">
      {/* Problem header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-100">{problem.title}</h2>
            <Pill tone={diffTone}>{problem.difficulty}</Pill>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {problem.topics.map((t) => <Pill key={t} tone="slate">{t}</Pill>)}
          </div>
        </div>
        <button
          onClick={handleNext}
          className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600"
        >
          <RotateCcw size={15} />
          New problem
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Statement */}
        <Card>
          <SectionTitle icon={<Layers size={16} />} title="Problem" />
          <div className="phq-markdown space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="whitespace-pre-wrap text-sm text-slate-300">{problem.statement}</p>
            </div>
            {problem.examples.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Examples</p>
                <div className="space-y-2">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs font-semibold text-slate-400">Input</div>
                      <pre className="mt-1 overflow-x-auto font-mono text-sm text-emerald-300">{ex.input}</pre>
                      <div className="mt-2 text-xs font-semibold text-slate-400">Output</div>
                      <pre className="mt-1 overflow-x-auto font-mono text-sm text-cyan-300">{ex.output}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {problem.constraints && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Constraints</p>
                <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-slate-300">{problem.constraints}</pre>
              </div>
            )}
          </div>
        </Card>

        {/* Editor + result */}
        <Card className="flex flex-col p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex gap-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    if (!evaluation) {
                      setLanguage(lang);
                      setCode((prev) => (language === lang ? prev : STARTER_CODE[lang] ?? prev));
                    }
                  }}
                  disabled={!!evaluation}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    language === lang ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500 hover:bg-slate-800'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><Timer size={13} /> {language}</span>
          </div>

          {evaluation ? (
            <EvaluationPanel evaluation={evaluation} onNext={handleNext} altOpen={altOpen} onToggleAlt={() => setAltOpen((o) => !o)} />
          ) : (
            <>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="phq-scrollbar h-72 flex-1 resize-none bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-200 outline-none"
              />
              <div className="border-t border-slate-800 p-4">
                {submitError && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={resetEditor}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !code.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    {submitting ? 'Evaluating...' : 'Run & submit'}
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

const EvaluationPanel: React.FC<{
  evaluation: CodingEvaluation;
  onNext: () => void;
  altOpen: boolean;
  onToggleAlt: () => void;
}> = ({ evaluation, onNext, altOpen, onToggleAlt }) => {
  const axes: { label: string; value: number }[] = [
    { label: 'Correctness', value: evaluation.correctness },
    { label: 'Code quality', value: evaluation.codeQuality },
    { label: 'Naming', value: evaluation.naming },
    { label: 'Optimization', value: evaluation.optimization },
  ];

  return (
    <div className="phq-fade-in phq-scrollbar max-h-[36rem] overflow-y-auto p-5">
      <div className="flex items-center gap-5">
        <Ring value={evaluation.correctness} size={96} stroke={9} gradientId="codRing" label={`${Math.round(evaluation.correctness)}%`} sublabel="correctness" />
        <div className="flex-1 space-y-2.5">
          {axes.map((a) => <ScoreBar key={a.label} label={a.label} value={a.value} />)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill tone="violet">Time: {evaluation.timeComplexity || '—'}</Pill>
        <Pill tone="cyan">Space: {evaluation.spaceComplexity || '—'}</Pill>
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Lightbulb size={13} /> Detailed feedback
        </p>
        <div className="phq-markdown rounded-xl border border-slate-800 bg-slate-950 p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluation.feedback || 'No detailed feedback.'}</ReactMarkdown>
        </div>
      </div>

      {evaluation.alternativeSolutions.length > 0 && (
        <button
          onClick={onToggleAlt}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600"
        >
          Alternative solutions
          <ChevronDown size={16} className={`transition-transform ${altOpen ? 'rotate-180' : ''}`} />
        </button>
      )}
      {altOpen && (
        <div className="phq-fade-in mt-3 space-y-2">
          {evaluation.alternativeSolutions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {s}
            </div>
          ))}
        </div>
      )}

      {evaluation.expectedQuestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Lightbulb size={13} /> Expected interviewer questions
          </p>
          <div className="space-y-2">
            {evaluation.expectedQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm text-slate-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40"
      >
        <CheckCircle2 size={16} />
        Next problem
      </button>
    </div>
  );
};

export default CodingPractice;
