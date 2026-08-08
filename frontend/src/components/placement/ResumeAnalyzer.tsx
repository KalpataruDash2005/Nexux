import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  UploadCloud, FileText, RefreshCw, ChevronDown, CheckCircle2, XCircle, Sparkles,
  AlertTriangle, Lightbulb, GraduationCap, Award, Target, Loader2,
} from 'lucide-react';
import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  analyzeResume, getResumeLatest, ResumeResponse, ResumeAnalysis,
} from '../../services/placementService';
import { Card, Pill, LoadingSpinner, ErrorBanner, Ring, EmptyState } from './ui';
import { useToast } from '../ui/Toast';

const STEPS = ['Extracting text...', 'Analyzing structure...', 'Scoring ATS...', 'Generating insights...'];

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  color: '#111827',
  fontSize: 12,
};

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <Card hover className="phq-fade-up">
    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
      <span className="text-emerald-600">{icon}</span>
      {title}
    </h3>
    {children}
  </Card>
);

const List: React.FC<{ items: string[]; tone?: 'default' | 'emerald' | 'rose' | 'violet' }> = ({ items, tone = 'default' }) => {
  if (!items || items.length === 0) return <p className="text-sm text-muted">No data available.</p>;
  const dot = tone === 'emerald' ? 'bg-emerald-500' : tone === 'rose' ? 'bg-rose-500' : tone === 'violet' ? 'bg-violet-500' : 'bg-muted';
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

const AnalysisBody: React.FC<{ analysis: ResumeAnalysis }> = ({ analysis }) => {
  const [rawOpen, setRawOpen] = useState(false);

  const radarData = Object.entries(analysis.categoryScores ?? {}).map(([subject, value]) => ({
    subject: subject.replace(/_/g, ' '),
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Overall Score" icon={<Award size={15} />}>
          <div className="flex flex-col items-center py-2">
            <Ring value={analysis.overallScore} size={150} stroke={13} label={`${Math.round(analysis.overallScore)}`} sublabel="Overall" />
            {analysis.candidateName && (
              <p className="mt-4 text-center text-sm font-semibold text-foreground">{analysis.candidateName}</p>
            )}
          </div>
        </Section>
        <Section title="ATS Score" icon={<Target size={15} />}>
          <div className="flex flex-col items-center py-2">
            <Ring value={analysis.atsScore} size={150} stroke={13} gradientId="atsRing" label={`${Math.round(analysis.atsScore)}%`} sublabel="ATS friendly" />
            <p className="mt-4 text-center text-xs leading-relaxed text-muted">
              How well your resume passes automated Applicant Tracking System filters.
            </p>
          </div>
        </Section>
        <Section title="Category Scores" icon={<Sparkles size={15} />}>
          {radarData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Radar dataKey="value" stroke="#444ce7" fill="#444ce7" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">No category scores.</p>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Skills" icon={<CheckCircle2 size={15} />}>
          <div className="flex flex-wrap gap-2">
            {(analysis.skills ?? []).map((s) => <Pill key={s} tone="emerald">{s}</Pill>)}
            {(analysis.missingSkills ?? []).map((s) => (
              <Pill key={`m-${s}`} outline>{s}</Pill>
            ))}
            {(analysis.skills?.length === 0 && analysis.missingSkills?.length === 0) && (
              <p className="text-sm text-muted">No skills extracted.</p>
            )}
          </div>
          {((analysis.missingSkills ?? []).length > 0) && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Outlined tags are skills ATS couldn't find — consider adding them honestly.
            </p>
          )}
        </Section>

        <Section title="Strengths & Weaknesses" icon={<Lightbulb size={15} />}>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">Strengths</p>
              <List items={analysis.strengths} tone="emerald" />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-600">Weaknesses</p>
              <List items={analysis.weaknesses} tone="rose" />
            </div>
          </div>
        </Section>
      </div>

      <Section title="Improvement Suggestions" icon={<AlertTriangle size={15} />}>
        {(analysis.suggestions ?? []).length > 0 ? (
          <div className="space-y-3">
            {analysis.suggestions.map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-tag-bg p-3">
                <p className="text-xs font-semibold text-muted">Line: {s.line}</p>
                <p className="mt-1 text-sm text-foreground">{s.suggestion}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No suggestions generated.</p>
        )}
      </Section>

      <Section title="Rewritten Bullets" icon={<Sparkles size={15} />}>
        {(analysis.rewrittenBullets ?? []).length > 0 ? (
          <div className="space-y-4">
            {analysis.rewrittenBullets.map((b, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-tag-bg p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Original</p>
                  <p className="text-sm text-muted line-through decoration-rose-500/50">{b.original}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Rewritten</p>
                  <p className="text-sm text-foreground">{b.rewritten}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No rewritten bullets.</p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Expected Interview Questions" icon={<Lightbulb size={15} />}>
          <List items={analysis.expectedQuestions} tone="violet" />
        </Section>
        <Section title="Recommended Next Steps" icon={<GraduationCap size={15} />}>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Recommended projects</p>
              <List items={analysis.recommendedProjects} tone="emerald" />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Certifications</p>
              <List items={analysis.recommendedCertifications} tone="violet" />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Action checklist</p>
              <List items={analysis.checklist} tone="emerald" />
            </div>
          </div>
        </Section>
      </div>

      <button
        onClick={() => setRawOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-primary-soft"
      >
        <span className="flex items-center gap-2"><FileText size={15} /> View raw analysis</span>
        <ChevronDown size={16} className={`transition-transform ${rawOpen ? 'rotate-180' : ''}`} />
      </button>
      {rawOpen && (
        <div className="phq-fade-in grid gap-6 lg:grid-cols-2">
          <Section title="Experience" icon={<BriefcaseIcon />}>
            {(analysis.experience ?? []).map((e, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-semibold text-foreground">{e.role} @ {e.company}</p>
                <p className="text-xs text-muted">{e.duration}</p>
                <List items={e.highlights} />
              </div>
            ))}
          </Section>
          <Section title="Projects & Education" icon={<GraduationCap size={15} />}>
            {(analysis.projects ?? []).map((p, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="text-xs text-muted">{p.description}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(p.technologies ?? []).map((t) => <Pill key={t} tone="slate">{t}</Pill>)}
                </div>
              </div>
            ))}
            {(analysis.education ?? []).map((ed, i) => (
              <div key={`ed-${i}`} className="mb-2 rounded-xl border border-border bg-tag-bg p-3">
                <p className="text-sm font-semibold text-foreground">{ed.degree}</p>
                <p className="text-xs text-muted">{ed.institution} · {ed.duration} · {ed.percentage}</p>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
};

const BriefcaseIcon: React.FC = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;

const Dropzone: React.FC<{
  onFile: (file: File) => void;
  busy: boolean;
}> = ({ onFile, busy }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const accept = useCallback((candidate: File) => {
    const lower = candidate.name.toLowerCase();
    if (lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.txt')) {
      onFile(candidate);
    } else {
      toast('Unsupported file type. Please upload a PDF, DOC, DOCX or TXT resume.', 'error');
    }
  }, [onFile]);

  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) accept(dropped);
      }}
      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
        dragging ? 'border-primary bg-primary-tint scale-[1.01]' : 'border-border hover:border-primary-soft hover:bg-primary-tint'
      } ${busy ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
        <UploadCloud size={28} />
      </div>
      <p className="mt-4 font-semibold text-foreground">Drag & drop your resume here</p>
      <p className="mt-1 text-sm text-muted">or click to browse — PDF, DOC, DOCX, TXT</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) accept(picked);
          e.target.value = '';
        }}
      />
    </div>
  );
};

const ResumeAnalyzer: React.FC = () => {
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState<string | null>(null);

  const [current, setCurrent] = useState<ResumeResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const loadLatest = useCallback(async () => {
    setLatestLoading(true);
    setLatestError(null);
    try {
      const data = await getResumeLatest();
      setCurrent(data.analysis ? data : null);
    } catch (err) {
      setLatestError((err as Error).message);
    } finally {
      setLatestLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    if (analyzing) {
      setStepIdx(0);
      intervalRef.current = window.setInterval(() => {
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      }, 1100);
    }
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [analyzing]);

  const handleAnalyze = async (selected: File) => {
    setFile(selected);
    setError(null);
    setAnalyzing(true);
    try {
      const result = await analyzeResume(selected);
      setCurrent(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const analysis = current?.analysis ?? null;

  return (
    <div className="phq-fade-in space-y-6">
      <Card className="relative overflow-hidden">
        <div className="phq-shimmer absolute inset-0 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 text-emerald-600">
            <Sparkles size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">AI Resume Analyst</span>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Resume Analyzer</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Upload your resume and get an ATS score, category breakdown, and actionable rewrite suggestions from the AI.
          </p>
          <div className="mt-5">
            <Dropzone onFile={handleAnalyze} busy={analyzing} />
          </div>
        </div>
      </Card>

      {analyzing && (
        <Card className="phq-fade-up">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <FileText size={26} className="phq-pulse-soft" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{file?.name}</p>
              <div className="mt-3 space-y-2">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    {i < stepIdx ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : i === stepIdx ? (
                      <Loader2 size={14} className="animate-spin text-emerald-600" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border border-border" />
                    )}
                    <span className={`text-sm ${i <= stepIdx ? 'text-foreground' : 'text-muted'}`}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <ErrorBanner message={error} onRetry={() => file && handleAnalyze(file)} />
      )}

      {!analyzing && analysis && current && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <FileText size={18} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{current.fileName}</p>
                <p className="text-xs text-muted">
                  {current.textLength ? `${current.textLength.toLocaleString()} characters extracted` : 'Analysis complete'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (file) handleAnalyze(file);
                else window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 rounded-xl border border-primary-soft bg-primary-tint px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary-soft"
            >
              <RefreshCw size={15} />
              Re-analyze
            </button>
          </div>
          <AnalysisBody analysis={analysis} />
        </>
      )}

      {!analyzing && !analysis && !error && latestLoading && (
        <Card>
          <LoadingSpinner label="Checking for a previous analysis..." />
        </Card>
      )}

      {!analyzing && !analysis && !error && !latestLoading && (
        <Card>
          <EmptyState
            icon={<XCircle size={26} />}
            title="No analysis yet"
            subtitle="Upload your resume above to get an instant AI-powered ATS review."
          />
        </Card>
      )}

      {!analyzing && !analysis && latestError && (
        <div className="flex items-start gap-2 text-sm text-muted">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
          {latestError} — you can still upload a fresh resume above.
        </div>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
