import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit, Play, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Timer, RotateCcw, Loader2, AlertTriangle, Award,
} from 'lucide-react';
import {
  createAptitudeTest, submitAptitude, AptitudeTestResponse, AptitudeSubmitResponse,
  AptitudeCategory,
} from '../../services/placementService';
import { Card, Pill, Ring } from './ui';

const CATEGORIES: { value: AptitudeCategory; label: string }[] = [
  { value: 'QUANTITATIVE', label: 'Quantitative' },
  { value: 'LOGICAL', label: 'Logical' },
  { value: 'VERBAL', label: 'Verbal' },
  { value: 'PUZZLE', label: 'Puzzles' },
  { value: 'DI', label: 'Data Interpretation' },
];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const COUNTS = [5, 10, 15];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const AptitudeTest: React.FC = () => {
  const [stage, setStage] = useState<'launch' | 'quiz' | 'result'>('launch');
  const [category, setCategory] = useState<AptitudeCategory>('QUANTITATIVE');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [count, setCount] = useState(10);
  const [starting, setStarting] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const [test, setTest] = useState<AptitudeTestResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [result, setResult] = useState<AptitudeSubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (stage === 'quiz') {
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [stage]);

  const handleStart = async () => {
    setStarting(true);
    setLaunchError(null);
    try {
      const res = await createAptitudeTest({ category, difficulty, count });
      setTest(res);
      setAnswers({});
      setCurrent(0);
      setElapsed(0);
      setResult(null);
      setStage('quiz');
    } catch (err) {
      setLaunchError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!test) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = Object.entries(answers).map(([questionId, selectedIndex]) => ({ questionId, selectedIndex }));
      const res = await submitAptitude(test.sessionId, payload);
      setResult(res);
      setStage('result');
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTest(null);
    setResult(null);
    setStage('launch');
  };

  if (stage === 'launch') {
    return (
      <div className="phq-fade-in mx-auto max-w-2xl">
        <Card>
          <div className="mb-6 flex items-center gap-2 text-emerald-400">
            <BrainCircuit size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Aptitude Arena</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100">Aptitude Test</h2>
          <p className="mt-1 text-sm text-slate-400">Sharpen quantitative, logical, verbal and puzzle-solving skills with timed AI-generated tests.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Category</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                      category === c.value
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {c.label}
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
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Number of questions</label>
              <div className="grid grid-cols-3 gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                      count === c
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {launchError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {launchError}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={starting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:opacity-50"
            >
              {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {starting ? 'Generating test...' : 'Start test'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (stage === 'result' && result) {
    return (
      <div className="phq-fade-in mx-auto max-w-3xl">
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
            <Award size={24} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-100">Test complete!</h2>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-8">
            <Ring value={result.percentage} size={140} stroke={12} gradientId="aptRing" label={`${Math.round(result.percentage)}%`} sublabel="percentage" />
            <div className="space-y-2 text-left">
              <Pill tone="emerald">Score: {result.score} / {result.total}</Pill>
              <Pill tone="slate">Accuracy: {result.total > 0 ? `${Math.round((result.score / result.total) * 100)}%` : '—'}</Pill>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40"
          >
            <RotateCcw size={15} />
            New test
          </button>
        </Card>

        <div className="mt-6 space-y-4">
          {result.detailed.map((d, i) => {
            const question = test?.test.questions.find((q) => q.id === d.questionId);
            return (
              <Card key={d.questionId} className={d.correct ? 'phq-fade-up' : 'phq-fade-up'}>
                <div className="flex items-start gap-3">
                  {d.correct ? (
                    <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={20} className="mt-0.5 shrink-0 text-rose-400" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-100">
                      Q{i + 1}. {question?.text ?? 'Question'}
                    </p>
                    {question?.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={`mt-1.5 rounded-lg border px-3 py-1.5 text-sm ${
                          oi === d.correctAnswerIndex
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : oi === d.yourAnswer
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                              : 'border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span> {opt}
                        {oi === d.correctAnswerIndex && <span className="ml-2 text-[10px] font-bold uppercase text-emerald-400">Correct</span>}
                        {oi === d.yourAnswer && !d.correct && <span className="ml-2 text-[10px] font-bold uppercase text-rose-400">Your answer</span>}
                      </div>
                    ))}
                    {d.explanation && (
                      <p className="mt-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">{d.explanation}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (!test) return null;

  const questions = test.test.questions;
  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="phq-fade-in mx-auto max-w-3xl">
      <Card>
        {/* Progress */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-100">Question {current + 1} / {questions.length}</p>
            <p className="text-xs text-slate-500">{answeredCount} answered</p>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone="slate"><Timer size={12} /> {formatElapsed(elapsed)}</Pill>
            <Pill tone="violet">{category.charAt(0) + category.slice(1).toLowerCase()}</Pill>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Question */}
        <div key={question.id} className="phq-fade-up mt-6">
          <p className="text-lg font-semibold leading-relaxed text-slate-100">{question.text}</p>
          <div className="mt-4 space-y-2.5">
            {question.options.map((opt, oi) => {
              const selected = answers[question.id] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: oi }))}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    selected
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-slate-100 shadow-lg shadow-emerald-500/5'
                      : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800/40'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      selected ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-600 text-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + oi)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {submitError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            disabled={current === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  i === current ? 'bg-emerald-400 scale-125' : answers[questions[i].id] !== undefined ? 'bg-emerald-500/50' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent((i) => Math.min(questions.length - 1, i + 1))}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || answeredCount === 0}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Submit test
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AptitudeTest;
