import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Mic, Send, X, Loader2, MessageSquare } from 'lucide-react';
import { sendAssistantMessage, errorMessage } from '../../services/taskService';
import { assistantBus } from '../../services/assistantBus';

interface Props {
  activeTaskId?: string | null;
  activeTaskTitle?: string | null;
  openRequest?: number;
  onTasksChanged?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chunkCount?: number;
  error?: boolean;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0?: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
}

const GREETING =
  'Hi! I\'m your AI Task Assistant. Tell me things like "Pause this and split it into 4 days", or ask me to resume a task.';

const AiAssistantWidget: React.FC<Props> = ({
  activeTaskId,
  activeTaskTitle,
  openRequest = 0,
  onTasksChanged,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'greeting', role: 'assistant', content: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const sendingRef = useRef(false);
  const activeTaskIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Sync with the global assistant bus so any page can focus a task and open the widget.
  const [busTask, setBusTask] = useState(() => assistantBus.getState());
  useEffect(() => {
    return assistantBus.subscribe(() => {
      setBusTask(assistantBus.getState());
      setOpen(true);
    });
  }, []);

  const effectiveTaskId = busTask.taskId ?? activeTaskId ?? null;
  const effectiveTaskTitle = busTask.taskTitle ?? activeTaskTitle ?? null;

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  useEffect(() => {
    activeTaskIdRef.current = effectiveTaskId;
  }, [effectiveTaskId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sendingRef.current) return;
    setInput('');
    setMicError(null);
    sendingRef.current = true;
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `user-${idRef.current++}`, role: 'user', content: text },
    ]);
    try {
      const res = await sendAssistantMessage({
        taskId: activeTaskIdRef.current,
        message: text,
        pageContext: effectiveTaskTitle ? `Active task: ${effectiveTaskTitle}` : 'No task selected on the page.',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${idRef.current++}`,
          role: 'assistant',
          content: res.replyMessage,
          chunkCount: res.newChunks.length,
        },
      ]);
      onTasksChanged?.();
      assistantBus.notifyTasksChanged();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${idRef.current++}`,
          role: 'assistant',
          content: errorMessage(err, 'Sorry, something went wrong. Please try again.'),
          error: true,
        },
      ]);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const startListening = () => {
    const win = window as WindowWithSpeech;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) {
      setMicError('Voice input is not supported in this browser.');
      return;
    }
    setMicError(null);
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0]?.transcript ?? '';
      }
      if (final) setInput((prev) => (prev ? `${prev.trimEnd()} ${final}` : final));
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setMicError('Microphone access was denied. Check your browser permissions.');
      } else if (event.error === 'no-speech') {
        setMicError('No speech detected. Please try again.');
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    startListening();
  };

  const suggestedPrompts = effectiveTaskTitle
    ? ['Split this task into 4 days', 'Pause this for today, resume tomorrow', "I'm done for today"]
    : ['What should I focus on next?', 'Show me my upcoming deadlines', "I'm done for today"];

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 hover:bg-primary-hover"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[560px] max-h-[80vh] w-[400px] max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-500 text-white shadow-lg shadow-violet-500/30">
                <Bot size={18} />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-extrabold tracking-tight text-foreground">AI Task Assistant</p>
                <p className="truncate text-xs text-muted">
                  {effectiveTaskTitle ? `Active: ${effectiveTaskTitle}` : 'No active task'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close AI assistant"
              className="rounded-full p-1.5 text-muted transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.role === 'user'
                        ? 'bg-primary text-white'
                        : m.error
                          ? 'border border-rose-200 bg-rose-50 text-rose-700'
                          : 'border border-border bg-slate-50 text-foreground'
                    }`}
                  >
                    {m.role === 'user' || m.error ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <div className="markdown-body text-sm leading-relaxed text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="mb-3 mt-3 text-base font-extrabold text-foreground">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="mb-2 mt-3 text-sm font-bold text-foreground">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="mb-1 mt-2 text-sm font-bold text-foreground">{children}</h3>
                            ),
                            p: ({ children }) => <p className="my-1.5 text-foreground">{children}</p>,
                            ul: ({ children }) => (
                              <ul className="my-1.5 list-disc space-y-0.5 pl-5 text-foreground">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="my-1.5 list-decimal space-y-0.5 pl-5 text-foreground">{children}</ol>
                            ),
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            strong: ({ children }) => (
                              <strong className="font-bold text-emerald-600">{children}</strong>
                            ),
                            em: ({ children }) => <em className="italic text-muted">{children}</em>,
                            blockquote: ({ children }) => (
                              <blockquote className="my-2 border-l-4 border-primary-soft pl-3 italic text-muted">
                                {children}
                              </blockquote>
                            ),
                            code: ({ children }) => (
                              <code className="rounded bg-tag-bg px-1.5 py-0.5 font-mono text-xs text-primary">
                                {children}
                              </code>
                            ),
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {m.role === 'assistant' && !m.error && m.chunkCount != null && m.chunkCount > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5 pl-1 text-xs text-emerald-600">
                      <MessageSquare size={13} />
                      <span>
                        {m.chunkCount} {m.chunkCount === 1 ? 'chunk added' : 'chunks added'} to your calendar
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-slate-50 px-3.5 py-2.5 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  disabled={sending}
                  className="rounded-full border border-primary-soft bg-primary-tint px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {listening && (
            <div className="flex items-center gap-2 border-t border-border bg-rose-50 px-4 py-2 text-xs text-rose-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              <span>Listening... speak now</span>
            </div>
          )}

          <div className="border-t border-border p-3">
            {micError && <p className="mb-2 text-xs text-rose-600">{micError}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleListening}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  listening
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-primary-tint text-primary hover:bg-primary-soft'
                }`}
              >
                <Mic size={17} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask your assistant..."
                className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiAssistantWidget;
