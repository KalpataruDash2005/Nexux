import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Code2, Play, ChevronDown, Lightbulb, Layers, RotateCcw, Loader2, AlertTriangle, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { createCodingSession, submitCoding, CodingProblem, CodingEvaluation, CodingTestResult } from '../../services/placementService';
import { Card, SectionTitle, Pill, Ring, ScoreBar } from './ui';

const TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Graphs',
  'Dynamic Programming', 'Hashing', 'Sorting & Searching', 'Recursion & Backtracking', 'Math',
];

const LANGUAGES = ['Java', 'Python', 'C++', 'JavaScript'];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

const STARTER_CODE: Record<string, string> = {
  Java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}',
  Python: 'import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    # Write your solution here\n    pass\n\nsolve()',
  'C++': '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
  JavaScript: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on("line", (line) => {\n  // Write your solution here\n});',
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
  const [passed, setPassed] = useState<boolean | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<CodingTestResult[]>([]);
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
      setPassed(null);
      setTotalScore(null);
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
      setPassed(res.passed);
      setTotalScore(res.totalScore);
      setTestResults(res.testResults ?? []);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setEvaluation(null);
    setPassed(null);
    setTotalScore(null);
    setTestResults([]);
    setProblem(null);
    setSessionId(null);
    setStartError(null);
    setSubmitError(null);
  };

  if (!problem) {
    return (
      <div className="phq-fade-in mx-auto max-w-2xl">
        <Card>
          <div className="mb-6 flex items-center gap-2 text-emerald-600">
            <Code2 size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Coding Arena</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Coding Practice</h2>
          <p className="mt-1 text-sm text-muted">Get an AI-generated DSA problem tailored to your target role, then submit and receive a detailed evaluation.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Target role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Backend Engineer"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Topic</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                      topic === t
                        ? 'border-primary-soft bg-primary-soft text-primary'
                        : 'border-border text-muted hover:border-primary-soft'
                    }`}
                  >
                    {t}
                  </button>
                ))}
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
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">{problem.title}</h2>
            <Pill tone={diffTone}>{problem.difficulty}</Pill>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(problem.topics ?? []).map((t) => <Pill key={t} tone="slate">{t}</Pill>)}
          </div>
        </div>
        <button
          onClick={handleNext}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary-soft"
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
            <div className="rounded-xl border border-border bg-tag-bg p-4">
              <p className="whitespace-pre-wrap text-sm text-foreground">{problem.statement}</p>
            </div>
            {(problem.examples ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Examples</p>
                <div className="space-y-2">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="rounded-xl border border-border bg-tag-bg p-3">
                      <div className="text-xs font-semibold text-muted">Input</div>
                      <pre className="mt-1 overflow-x-auto font-mono text-sm text-emerald-700">{ex.input}</pre>
                      <div className="mt-2 text-xs font-semibold text-muted">Output</div>
                      <pre className="mt-1 overflow-x-auto font-mono text-sm text-cyan-700">{ex.output}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {problem.constraints && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Constraints</p>
                <pre className="rounded-xl border border-border bg-tag-bg p-3 font-mono text-sm text-foreground">{problem.constraints}</pre>
              </div>
            )}
          </div>
        </Card>

        {/* Editor + result */}
        <Card className="flex flex-col p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
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
                    language === lang ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-tag-bg'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted"><Code2 size={13} /> {language}</span>
          </div>

          {evaluation ? (
            <EvaluationPanel
              evaluation={evaluation}
              passed={passed}
              totalScore={totalScore}
              testResults={testResults}
              onNext={handleNext}
              altOpen={altOpen}
              onToggleAlt={() => setAltOpen((o) => !o)}
            />
          ) : (
            <>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="phq-scrollbar h-72 flex-1 resize-none bg-tag-bg p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
              />
              <div className="border-t border-border p-4">
                {submitError && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={resetEditor}
                    className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-primary-soft"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !code.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-bold text-white shadow-card transition-all hover:shadow-lg disabled:opacity-50"
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
  passed: boolean | null;
  totalScore: number | null;
  testResults: CodingTestResult[];
  onNext: () => void;
  altOpen: boolean;
  onToggleAlt: () => void;
}> = ({ evaluation, passed, totalScore, testResults, onNext, altOpen, onToggleAlt }) => {
  const axes: { label: string; value: number }[] = [
    { label: 'Correctness', value: evaluation.correctness },
    { label: 'Code quality', value: evaluation.codeQuality },
    { label: 'Naming', value: evaluation.naming },
    { label: 'Optimization', value: evaluation.optimization },
  ];
  const alternatives = evaluation.alternativeSolutions ?? [];
  const followUps = evaluation.expectedQuestions ?? [];
  const passedCount = testResults.filter((t) => t.passed).length;

  return (
    <div className="phq-fade-in phq-scrollbar max-h-[36rem] overflow-y-auto p-5">
      <div className="flex items-center gap-5">
        <Ring value={evaluation.correctness} size={96} stroke={9} gradientId="codRing" label={`${Math.round(evaluation.correctness)}%`} sublabel="correctness" />
        <div className="flex-1 space-y-2.5">
          {axes.map((a) => <ScoreBar key={a.label} label={a.label} value={a.value} />)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {passed != null && (
          <Pill tone={passed ? 'emerald' : 'rose'}>
            {passed ? 'Passed' : 'Needs work'} {totalScore != null && `· ${Math.round(totalScore)}/100`}
          </Pill>
        )}
        <Pill tone="violet">Time: {evaluation.timeComplexity || '—'}</Pill>
        <Pill tone="cyan">Space: {evaluation.spaceComplexity || '—'}</Pill>
      </div>

      {testResults.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <Terminal size={13} /> Test cases
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <div>
                <div className="text-lg font-bold leading-tight text-emerald-700">{passedCount}</div>
                <div className="text-xs font-medium text-emerald-600">Passed</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3">
              <XCircle size={18} className="shrink-0 text-rose-600" />
              <div>
                <div className="text-lg font-bold leading-tight text-rose-700">{testResults.length - passedCount}</div>
                <div className="text-xs font-medium text-rose-600">Failed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <Lightbulb size={13} /> Detailed feedback
        </p>
        <div className="phq-markdown rounded-xl border border-border bg-tag-bg p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{evaluation.feedback || 'No detailed feedback.'}</ReactMarkdown>
        </div>
      </div>

      {alternatives.length > 0 && (
        <button
          onClick={onToggleAlt}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-primary-soft"
        >
          Alternative solutions
          <ChevronDown size={16} className={`transition-transform ${altOpen ? 'rotate-180' : ''}`} />
        </button>
      )}
      {altOpen && (
        <div className="phq-fade-in mt-3 space-y-2">
          {alternatives.map((s, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-tag-bg p-3 text-sm text-foreground">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {s}
            </div>
          ))}
        </div>
      )}

      {followUps.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <Lightbulb size={13} /> Expected interviewer questions
          </p>
          <div className="space-y-2">
            {followUps.map((q, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-tint p-3 text-sm text-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-3 text-sm font-bold text-white shadow-card transition-all hover:shadow-lg"
      >
        <CheckCircle2 size={16} />
        Next problem
      </button>
    </div>
  );
};

export default CodingPractice;
