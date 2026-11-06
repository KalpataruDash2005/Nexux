import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Editor from '@monaco-editor/react';
import {
  Code2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Sparkles,
  Clock,
  Terminal,
  FileCode,
  History,
  BookOpen,
  Layers,
  Lightbulb,
  Send,
  Check,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import {
  createCodingSession,
  runCoding,
  submitCoding,
  getCodingSubmissions,
  CodingProblem,
  CodingRunResponse,
  CodingSubmitResponse,
  SubmissionHistoryItem
} from '../../services/placementService';
import { Card, Pill } from './ui';

const TOPICS = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks & Queues', 'Trees & Graphs',
  'Dynamic Programming', 'Hashing', 'Sorting & Searching', 'Recursion & Backtracking', 'Math'
];

const LANGUAGES = ['Python', 'Java', 'C++', 'JavaScript'];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

const MONACO_LANG_MAP: Record<string, string> = {
  Python: 'python',
  JavaScript: 'javascript',
  'C++': 'cpp',
  Java: 'java'
};

const STARTER_CODE: Record<string, string> = {
  Python: `# LeetCode / competitive style:
# Read input from standard input or implement your solution.

import sys

def solve():
    input_data = sys.stdin.read().strip()
    if not input_data:
        return
    # Write your solution logic here
    pass

if __name__ == "__main__":
    solve()
`,
  JavaScript: `// Read standard input and print output
const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Write your solution here
}

solve();
`,
  'C++': `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    return 0;
}
`,
  Java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
    }
}
`
};

export const CodingPractice: React.FC = () => {
  // Setup state
  const [role, setRole] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Active Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [language, setLanguage] = useState('Python');
  const [code, setCode] = useState(STARTER_CODE.Python);

  // Workspace navigation
  const [leftTab, setLeftTab] = useState<'problem' | 'submissions'>('problem');
  const [consoleTab, setConsoleTab] = useState<'testcases' | 'custom' | 'run' | 'submit'>('testcases');
  const [selectedTestCaseIdx, setSelectedTestCaseIdx] = useState(0);
  const [customInput, setCustomInput] = useState('');

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [runResponse, setRunResponse] = useState<CodingRunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<CodingSubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Submissions history
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Hints drawer
  const [showHints, setShowHints] = useState(false);

  const loadSubmissions = useCallback(async (sid: string) => {
    setLoadingHistory(true);
    try {
      const items = await getCodingSubmissions(sid);
      setSubmissions(items);
    } catch {
      // Ignore background history fetch errors
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await createCodingSession({
        role: role.trim() || 'Software Engineer',
        topic,
        difficulty
      });
      setSessionId(res.sessionId);
      setProblem(res.problem);
      setLanguage('Python');
      setCode(STARTER_CODE.Python);
      setLeftTab('problem');
      setConsoleTab('testcases');
      setSelectedTestCaseIdx(0);
      setRunResponse(null);
      setSubmitResponse(null);
      setRunError(null);
      setSubmitError(null);
      setSubmissions([]);
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setCode(STARTER_CODE[newLang] || STARTER_CODE.Python);
  };

  const handleResetCode = () => {
    if (window.confirm('Reset code to starter template? Your current edits will be discarded.')) {
      setCode(STARTER_CODE[language] || STARTER_CODE.Python);
    }
  };

  const handleRunCode = async () => {
    if (!sessionId || isRunning || isSubmitting) return;
    setIsRunning(true);
    setRunError(null);
    setConsoleTab('run');
    try {
      const res = await runCoding(sessionId, {
        language,
        code,
        customInput: customInput.trim() ? customInput : undefined
      });
      setRunResponse(res);
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId || isRunning || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setConsoleTab('submit');
    try {
      const res = await submitCoding(sessionId, { language, code });
      setSubmitResponse(res);
      // Refresh submissions history
      loadSubmissions(sessionId);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut listener: Ctrl+Enter (Run) & Ctrl+Shift+Enter (Submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSubmit();
        } else {
          handleRunCode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionId, language, code, customInput, isRunning, isSubmitting]);

  // Load submissions whenever Submissions tab is opened
  useEffect(() => {
    if (leftTab === 'submissions' && sessionId) {
      loadSubmissions(sessionId);
    }
  }, [leftTab, sessionId, loadSubmissions]);

  // Render Arena Setup View
  if (!problem) {
    return (
      <div className="phq-fade-in mx-auto max-w-3xl py-6">
        <Card className="p-8 shadow-lg border border-border/70">
          <div className="mb-6 flex items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Code2 size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">Nexora Coding Arena</h1>
                <p className="text-xs text-muted-foreground">
                  Dual-layer sandboxed algorithmic evaluation with real-time feedback & complexity analysis
                </p>
              </div>
            </div>
            <Pill tone="emerald">Live Execution Sandbox</Pill>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Full Stack Engineer, Backend Specialist"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tailors problem difficulty and algorithmic topics to real interview benchmarks.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`rounded-lg py-2 text-xs font-bold transition-all ${
                      difficulty === d
                        ? d === 'EASY'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : d === 'MEDIUM'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-rose-600 text-white shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Core Algorithmic Domain
            </label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    topic === t
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'border border-border/80 bg-background text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>Leadfoot Platform Security Guarantee</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Execution runs in an isolated ephemeral sandbox with strict 3-second timeouts. Hidden test cases are strictly guarded server-side and never leaked to the client.
            </p>
          </div>

          {startError && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle size={16} />
              <span>{startError}</span>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleStart}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer"
            >
              {starting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Configuring Arena...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Start Challenge</span>
                </>
              )}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Active Coding Workspace Layout
  const visibleTestCases = problem.testCases || [];

  return (
    <div className="phq-fade-in flex flex-col h-[calc(100vh-80px)] min-h-[640px] gap-2 pb-2">
      {/* Top Workspace Header Bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm('Leave current challenge and choose another?')) {
                setProblem(null);
                setSessionId(null);
              }
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <Code2 size={15} />
            <span>Problem List</span>
          </button>
          <span className="text-border">/</span>
          <h2 className="text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md">
            {problem.title}
          </h2>
          <Pill
            tone={
              problem.difficulty === 'EASY'
                ? 'emerald'
                : problem.difficulty === 'HARD'
                ? 'rose'
                : 'amber'
            }
          >
            {problem.difficulty}
          </Pill>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
              Language:
            </span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleResetCode}
            title="Reset to starter code"
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 min-h-0">
        {/* Left Panel: Problem Statement & Submissions */}
        <div className="lg:col-span-5 flex flex-col rounded-lg border border-border bg-surface overflow-hidden shadow-xs h-full">
          {/* Left Panel Tabs Header */}
          <div className="flex items-center border-b border-border bg-muted/20 px-2 pt-1 gap-1">
            <button
              onClick={() => setLeftTab('problem')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                leftTab === 'problem'
                  ? 'border-emerald-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen size={14} />
              <span>Description</span>
            </button>
            <button
              onClick={() => setLeftTab('submissions')}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                leftTab === 'submissions'
                  ? 'border-emerald-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <History size={14} />
              <span>Submissions</span>
              {submissions.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold">
                  {submissions.length}
                </span>
              )}
            </button>
          </div>

          {/* Left Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {leftTab === 'problem' ? (
              <>
                {/* Problem Statement */}
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-foreground leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {problem.statement}
                  </ReactMarkdown>
                </div>

                {/* Examples */}
                {problem.examples && problem.examples.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Examples
                    </h3>
                    {problem.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/80 bg-muted/20 p-3 text-xs space-y-1.5"
                      >
                        <div className="font-semibold text-foreground">Example {i + 1}:</div>
                        <div className="font-mono text-[11px] bg-background/80 p-2 rounded border border-border/50">
                          <div>
                            <span className="text-muted-foreground">Input: </span>
                            <span className="text-foreground">{ex.input}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-muted-foreground">Output: </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{ex.output}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Constraints */}
                {problem.constraints && (
                  <div className="pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Constraints
                    </h3>
                    <div className="rounded-lg border border-border/80 bg-muted/10 p-2.5 text-xs font-mono text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {problem.constraints}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Topics / Tags */}
                {problem.topics && problem.topics.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Topics
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {problem.topics.map((t) => (
                        <span
                          key={t}
                          className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hints Accordion */}
                <div className="pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setShowHints(!showHints)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-amber-500" />
                      <span>Need a hint?</span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transform transition-transform ${showHints ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showHints && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-foreground space-y-1">
                      <p>• Identify the optimal data structure (e.g. hash map or sliding window).</p>
                      <p>• Consider edge cases: empty strings, single-element arrays, and negative inputs.</p>
                      <p>• Aim for O(N) linear time complexity where possible.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Submissions History Tab */
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Submission History
                  </span>
                  <button
                    onClick={() => sessionId && loadSubmissions(sessionId)}
                    className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Refresh
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span>Loading past submissions...</span>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No submissions recorded yet for this session. Submit your code to see results here!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((sub, idx) => (
                      <div
                        key={sub.id || idx}
                        className="rounded-lg border border-border bg-background p-3 flex items-center justify-between text-xs shadow-2xs hover:border-emerald-500/40 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          {sub.status === 'Accepted' ? (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle size={16} className="text-rose-500 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-foreground">
                              {sub.status}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {sub.language} • {sub.passedTests}/{sub.totalTests} tests passed
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-foreground">
                            {sub.score}/100
                          </div>
                          {sub.executionTimeMs != null && (
                            <div className="text-[10px] text-muted-foreground">
                              {sub.executionTimeMs.toFixed(1)} ms
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Editor (Top) + Interactive Console (Bottom) */}
        <div className="lg:col-span-7 flex flex-col gap-2 h-full min-h-0">
          {/* Monaco Editor Container */}
          <div className="flex-1 flex flex-col rounded-lg border border-border bg-[#1e1e1e] overflow-hidden shadow-xs min-h-[300px]">
            {/* Editor Mini Header */}
            <div className="flex items-center justify-between bg-[#252526] px-3 py-1.5 border-b border-[#333] text-xs text-[#cccccc]">
              <div className="flex items-center gap-2">
                <FileCode size={13} className="text-emerald-400" />
                <span className="font-mono text-[11px]">
                  solution.{language === 'Python' ? 'py' : language === 'JavaScript' ? 'js' : language === 'C++' ? 'cpp' : 'java'}
                </span>
              </div>
              <span className="text-[11px] text-[#888]">
                Ctrl+Enter to Run • Ctrl+Shift+Enter to Submit
              </span>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 w-full h-full relative">
              <Editor
                height="100%"
                language={MONACO_LANG_MAP[language] || 'python'}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: 13,
                  fontFamily: "Fira Code, Menlo, Monaco, 'Courier New', monospace",
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  cursorBlinking: 'smooth',
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  padding: { top: 8, bottom: 8 }
                }}
              />
            </div>
          </div>

          {/* Interactive Console & Execution Panel */}
          <div className="h-[260px] flex flex-col rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
            {/* Console Tabs Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConsoleTab('testcases')}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                    consoleTab === 'testcases'
                      ? 'border-emerald-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers size={13} />
                  <span>Test Cases</span>
                </button>
                <button
                  onClick={() => setConsoleTab('custom')}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                    consoleTab === 'custom'
                      ? 'border-emerald-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Terminal size={13} />
                  <span>Custom Input</span>
                </button>
                <button
                  onClick={() => setConsoleTab('run')}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                    consoleTab === 'run'
                      ? 'border-emerald-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Play size={13} />
                  <span>Run Result</span>
                  {runResponse && (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        runResponse.passed ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                  )}
                </button>
                <button
                  onClick={() => setConsoleTab('submit')}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                    consoleTab === 'submit'
                      ? 'border-emerald-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Send size={13} />
                  <span>Submission</span>
                  {submitResponse && (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        submitResponse.passed ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 py-1 pr-1">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/40 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                >
                  {isRunning ? (
                    <Loader2 size={13} className="animate-spin text-emerald-500" />
                  ) : (
                    <Play size={13} className="text-emerald-500 fill-emerald-500" />
                  )}
                  <span>Run</span>
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isRunning || isSubmitting}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                >
                  {isSubmitting ? (
                    <Loader2 size={13} className="animate-spin text-white" />
                  ) : (
                    <Check size={13} />
                  )}
                  <span>Submit</span>
                </button>
              </div>
            </div>

            {/* Console Tab Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {/* TAB 1: Visible Test Cases */}
              {consoleTab === 'testcases' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    {visibleTestCases.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedTestCaseIdx(i)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                          selectedTestCaseIdx === i
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'border border-border/60 bg-background text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        Case {i + 1}
                      </button>
                    ))}
                  </div>

                  {visibleTestCases[selectedTestCaseIdx] && (
                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="mb-1 block font-semibold text-muted-foreground text-[11px] uppercase">
                          Input:
                        </span>
                        <pre className="rounded border border-border bg-muted/20 p-2 font-mono text-[11px] overflow-x-auto text-foreground whitespace-pre-wrap">
                          {visibleTestCases[selectedTestCaseIdx].input || '(No input)'}
                        </pre>
                      </div>
                      <div>
                        <span className="mb-1 block font-semibold text-muted-foreground text-[11px] uppercase">
                          Expected Output:
                        </span>
                        <pre className="rounded border border-border bg-muted/20 p-2 font-mono text-[11px] overflow-x-auto text-emerald-600 dark:text-emerald-400 font-bold whitespace-pre-wrap">
                          {visibleTestCases[selectedTestCaseIdx].expectedOutput}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Custom Input */}
              {consoleTab === 'custom' && (
                <div className="h-full flex flex-col gap-2">
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Provide custom input to pass into your code's standard input or driver:</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Available on Run Code</span>
                  </div>
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter custom input string here..."
                    className="flex-1 w-full rounded border border-border bg-background p-2 font-mono text-xs text-foreground focus:border-emerald-500 focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* TAB 3: Run Result */}
              {consoleTab === 'run' && (
                <div>
                  {isRunning ? (
                    <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                      <Loader2 size={20} className="animate-spin text-emerald-500" />
                      <span>Compiling and executing in sandbox...</span>
                    </div>
                  ) : runError ? (
                    <div className="rounded border border-rose-300 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Execution Error
                      </div>
                      <pre className="font-mono text-[11px] whitespace-pre-wrap">{runError}</pre>
                    </div>
                  ) : !runResponse ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Click <strong className="text-foreground">Run</strong> to execute your code against visible sample test cases.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Status Banner */}
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              runResponse.status === 'Accepted'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {runResponse.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {runResponse.passedTests} / {runResponse.totalTests} tests passed
                          </span>
                        </div>
                        {runResponse.executionTimeMs != null && (
                          <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                            <Clock size={12} /> {runResponse.executionTimeMs.toFixed(1)} ms
                          </span>
                        )}
                      </div>

                      {/* Compilation or Runtime Error Display */}
                      {runResponse.compilationError && (
                        <div className="rounded border border-rose-300 bg-rose-50 dark:bg-rose-950/20 p-2 text-xs font-mono text-rose-700 dark:text-rose-300 whitespace-pre-wrap">
                          {runResponse.compilationError}
                        </div>
                      )}

                      {/* Test Cases Results Grid */}
                      <div className="space-y-2">
                        {runResponse.testResults.map((tr, idx) => (
                          <div
                            key={idx}
                            className={`rounded border p-2 text-xs space-y-1 ${
                              tr.passed
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-rose-500/30 bg-rose-500/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">Case {idx + 1}</span>
                              <span
                                className={`font-bold text-[11px] ${
                                  tr.passed ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {tr.passed ? 'Passed' : 'Failed'}
                              </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 font-mono text-[11px]">
                              <div>
                                <span className="text-muted-foreground text-[10px]">Expected:</span>
                                <div className="text-foreground">{tr.expectedOutput}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-[10px]">Actual Output:</span>
                                <div className={tr.passed ? 'text-emerald-600' : 'text-rose-600'}>
                                  {tr.actualOutput || '(Empty)'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Custom Input Result */}
                        {runResponse.customResult && (
                          <div className="rounded border border-sky-500/30 bg-sky-500/5 p-2 text-xs space-y-1">
                            <div className="flex items-center justify-between font-semibold text-sky-700 dark:text-sky-300">
                              <span>Custom Input Result</span>
                              <span className="text-[10px] font-mono">
                                {runResponse.customResult.executionTimeMs?.toFixed(1)} ms
                              </span>
                            </div>
                            <div className="font-mono text-[11px]">
                              <span className="text-muted-foreground text-[10px]">Output:</span>
                              <div className="text-foreground">{runResponse.customResult.actualOutput}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Submission Result */}
              {consoleTab === 'submit' && (
                <div>
                  {isSubmitting ? (
                    <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                      <Loader2 size={20} className="animate-spin text-emerald-500" />
                      <span>Evaluating all test cases and analyzing complexity...</span>
                    </div>
                  ) : submitError ? (
                    <div className="rounded border border-rose-300 bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Submission Failed
                      </div>
                      <pre className="font-mono text-[11px] whitespace-pre-wrap">{submitError}</pre>
                    </div>
                  ) : !submitResponse ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Click <strong className="text-emerald-600">Submit</strong> to run against all test cases (including hidden tests) and record your score.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Big Verdict Banner */}
                      <div
                        className={`rounded-xl p-4 border flex items-center justify-between ${
                          submitResponse.passed
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                            : 'border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {submitResponse.passed ? (
                            <CheckCircle2 size={28} className="text-emerald-500" />
                          ) : (
                            <XCircle size={28} className="text-rose-500" />
                          )}
                          <div>
                            <div className="text-base font-extrabold">
                              {submitResponse.status || (submitResponse.passed ? 'Accepted' : 'Wrong Answer')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Passed {submitResponse.passedTests || 0} of {submitResponse.totalTests || 0} test cases
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-black text-foreground">
                            {submitResponse.totalScore}<span className="text-xs font-normal text-muted-foreground">/100</span>
                          </div>
                          {submitResponse.executionTimeMs != null && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Runtime: {submitResponse.executionTimeMs.toFixed(1)} ms
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Complexity & Analysis Metrics */}
                      {submitResponse.evaluation && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="rounded-lg border border-border bg-muted/20 p-2">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                              Time Complexity
                            </span>
                            <span className="text-xs font-mono font-bold text-foreground">
                              {submitResponse.evaluation.timeComplexity || 'O(N)'}
                            </span>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/20 p-2">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                              Space Complexity
                            </span>
                            <span className="text-xs font-mono font-bold text-foreground">
                              {submitResponse.evaluation.spaceComplexity || 'O(1)'}
                            </span>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/20 p-2">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                              Code Quality
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {submitResponse.evaluation.codeQuality || 75}%
                            </span>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/20 p-2">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                              Optimization
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {submitResponse.evaluation.optimization || 70}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Test Case Breakdown (with masked hidden test cases) */}
                      {submitResponse.testResults && submitResponse.testResults.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Test Cases Summary
                          </span>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {submitResponse.testResults.map((tr, idx) => (
                              <div
                                key={idx}
                                className={`rounded border p-2 text-xs flex items-center justify-between ${
                                  tr.passed
                                    ? 'border-emerald-500/20 bg-emerald-500/5'
                                    : 'border-rose-500/20 bg-rose-500/5'
                                }`}
                              >
                                <span className="font-medium text-foreground">
                                  {tr.hidden ? `Hidden Test Case #${idx + 1}` : `Sample Case #${idx + 1}`}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    tr.passed
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}
                                >
                                  {tr.passed ? 'Passed' : 'Failed'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Algorithmic Feedback */}
                      {submitResponse.evaluation?.feedback && (
                        <div className="rounded-lg border border-border bg-muted/15 p-3 text-xs space-y-1">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles size={13} className="text-emerald-500" /> Interviewer Feedback
                          </span>
                          <p className="text-muted-foreground leading-relaxed">
                            {submitResponse.evaluation.feedback}
                          </p>
                        </div>
                      )}

                      {/* Alternative Solutions */}
                      {submitResponse.evaluation?.alternativeSolutions &&
                        submitResponse.evaluation.alternativeSolutions.length > 0 && (
                          <div className="rounded-lg border border-border bg-muted/15 p-3 text-xs space-y-1">
                            <span className="font-bold text-foreground">Alternative Approaches:</span>
                            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                              {submitResponse.evaluation.alternativeSolutions.map((alt, i) => (
                                <li key={i}>{alt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodingPractice;
