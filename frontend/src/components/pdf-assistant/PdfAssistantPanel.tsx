import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Upload,
  Loader2,
  FileText,
  Trash2,
  Send,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Folder,
  Pencil,
  X,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Columns,
  BookOpen,
} from 'lucide-react';
import {
  listPdfDocuments,
  uploadPdfDocument,
  deletePdfDocument,
  askPdfQuestionStream,
  getPdfChatHistory,
  formatFileSize,
  isProcessing,
  getPdfDocumentFileUrl,
  fetchPdfBlob,
  regeneratePdfSummary,
  PdfDocument,
  PdfChatMessage,
} from '../../services/pdfAssistantService';
import Markdown from './Markdown';
import DocumentUploadProgress, { UploadStage } from '../ui/DocumentUploadProgress';
import { useToast } from './Toast';
import { useConfirm } from '../ui/Confirm';
import { getWorkspaceById, renameWorkspace, Workspace } from '../../services/workspaceService';

interface PdfAssistantPanelProps {
  workspaceId: string;
}

type ViewMode = 'split' | 'summary' | 'chat' | 'preview';

const POLL_INTERVAL_MS = 4000;

const SUGGESTIONS = [
  'What are the core concepts and definitions?',
  'Explain the step-by-step methodologies described.',
  'What are the key takeaways and practical applications?',
  'Are there any mathematical formulas or algorithms?',
];

const statusBadge: Record<PdfDocument['status'], { label: string; className: string; icon: React.ReactNode }> = {
  PENDING: {
    label: 'Queued',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock size={12} />,
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <RefreshCw size={12} className="animate-spin" />,
  },
  READY: {
    label: 'Ready',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 size={12} />,
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle size={12} />,
  },
};

const PdfAssistantPanel: React.FC<PdfAssistantPanelProps> = ({ workspaceId }) => {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [selected, setSelected] = useState<PdfDocument | null>(null);
  const [messages, setMessages] = useState<PdfChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [splitTab, setSplitTab] = useState<'summary' | 'chat'>('summary');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadPdfBlob = useCallback(async () => {
    if (!selected || selected.status !== 'READY') {
      setPdfBlobUrl(null);
      return;
    }
    setPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await fetchPdfBlob(workspaceId, selected.id);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err: any) {
      console.error('Failed to load PDF preview blob:', err);
      let errorMsg = 'Failed to load PDF preview.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorMsg = json.message || json.detail || errorMsg;
        } catch {
          // not json
        }
      } else if (err?.response?.data?.message || err?.response?.data?.detail) {
        errorMsg = err.response.data.message || err.response.data.detail;
      }
      setPdfError(errorMsg);
    } finally {
      setPdfLoading(false);
    }
  }, [workspaceId, selected?.id, selected?.status]);

  useEffect(() => {
    loadPdfBlob();
    return () => {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadPdfBlob]);

  useEffect(() => {
    getWorkspaceById(workspaceId)
      .then(setWorkspace)
      .catch(() => setWorkspace(null));
  }, [workspaceId]);

  const openRename = () => {
    if (!workspace) return;
    setRenameName(workspace.name);
    setRenameOpen(true);
  };

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    const trimmed = renameName.trim();
    if (!trimmed) return;
    setSavingWorkspace(true);
    try {
      const updated = await renameWorkspace(workspace.id, trimmed);
      setWorkspace(updated);
      setRenameOpen(false);
      toast(`Renamed to "${updated.name}".`, 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to rename workspace.', 'error');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await listPdfDocuments(workspaceId);
      setDocuments(docs);
      setSelected((prev) => {
        if (!prev) {
          const ready = docs.find((d) => d.status === 'READY') || docs[0];
          return ready ?? null;
        }
        const updated = docs.find((d) => d.id === prev.id);
        return updated ?? prev;
      });
      return docs;
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to load PDF documents.', 'error');
      return [];
    } finally {
      setIsLoadingList(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const anyProcessing = documents.some((d) => isProcessing(d.status));
    if (!anyProcessing) return;
    const timer = window.setInterval(() => {
      loadDocuments();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [documents, loadDocuments]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (selected && selected.status === 'READY' && historyLoadedFor !== selected.id) {
      setHistoryLoadedFor(selected.id);
      setMessages([]);
      getPdfChatHistory(workspaceId, selected.id)
        .then((history) => setMessages(history))
        .catch(() => setMessages([]));
    }
  }, [selected, historyLoadedFor, workspaceId]);

  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      setUploadStage('failed');
      setUploadError('Upload cancelled by user.');
      setIsUploading(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.txt')) {
      toast('Only PDF and TXT files are supported.', 'error');
      return;
    }
    if (isUploading) {
      toast('An upload is already in progress. Please wait.', 'error');
      return;
    }
    setUploadFile(file);
    setUploadProgress(0);
    setUploadStage('preparing');
    setUploadError(null);
    setIsUploading(true);

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    try {
      setUploadStage('uploading');
      const res = await uploadPdfDocument(workspaceId, file, {
        signal: controller.signal,
        onProgress: (pct) => {
          setUploadProgress(pct);
          if (pct >= 100) {
            setUploadStage('processing');
          }
        },
      });
      setUploadStage('completed');
      setUploadProgress(100);
      toast(`Uploaded "${res.fileName}". Generating AI overview...`, 'success');
      const latestDocs = await loadDocuments();
      if (res?.id && latestDocs?.length) {
        const found = latestDocs.find((d) => d.id === res.id);
        if (found) setSelected(found);
      }
      setTimeout(() => {
        setUploadStage('idle');
        setUploadFile(null);
      }, 3500);
    } catch (err: any) {
      if (controller.signal.aborted) {
        setUploadStage('failed');
        setUploadError('Upload cancelled.');
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Upload failed. Check backend logs.';
        setUploadStage('failed');
        setUploadError(msg);
        toast(msg, 'error');
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleDelete = async (doc: PdfDocument) => {
    const ok = await confirm({
      title: 'Delete document',
      message: `Delete "${doc.fileName}"? This removes its vector index and chat history.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePdfDocument(workspaceId, doc.id);
      toast(`Deleted "${doc.fileName}".`, 'success');
      if (selected?.id === doc.id) {
        setSelected(null);
        setMessages([]);
        setHistoryLoadedFor(null);
      }
      await loadDocuments();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Delete failed.', 'error');
    }
  };

  const handleCopySummary = () => {
    if (!selected?.summary) return;
    navigator.clipboard.writeText(selected.summary);
    setCopiedSummary(true);
    toast('Summary copied to clipboard.', 'info');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!selected || isRegenerating) return;
    setIsRegenerating(true);
    try {
      toast('Synthesizing comprehensive academic summary...', 'info');
      const updated = await regeneratePdfSummary(workspaceId, selected.id);
      setSelected(updated);
      toast('Summary successfully refreshed!', 'success');
      await loadDocuments();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to refresh summary.', 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSend = async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim();
    if (!question || !selected || isSending) return;
    const userMsg: PdfChatMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    const aiMessageId = `local-${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      { id: aiMessageId, role: 'AI', content: '', createdAt: new Date().toISOString() },
    ]);

    try {
      let fullAnswer = '';
      await askPdfQuestionStream(workspaceId, selected.id, question, (token) => {
        fullAnswer += token;
        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: fullAnswer } : msg))
        );
      });
      if (!selected.summary) {
        await loadDocuments();
      }
    } catch (err: any) {
      const errMsg =
        err?.message || err?.response?.data?.message || 'Sorry, I ran into an error generating that response.';
      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: errMsg } : msg))
      );
    } finally {
      setIsSending(false);
    }
  };

  const renderDocumentList = () => (
    <aside className="w-80 border-r border-gray-200 flex flex-col shrink-0 bg-gray-50 h-full">
      <div className="p-4 border-b border-gray-200 bg-white">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200'
              : 'border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/70'
          } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2 shadow-sm">
            <Upload size={18} />
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {isUploading ? 'Uploading file...' : 'Drop PDF here or Browse'}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">PDF or TXT up to 4.5 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf,text/plain,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploadStage !== 'idle' && (
          <div className="mt-3">
            <DocumentUploadProgress
              stage={uploadStage}
              progress={uploadProgress}
              fileName={uploadFile?.name}
              fileSize={uploadFile?.size}
              errorMessage={uploadError || undefined}
              onCancel={handleCancelUpload}
            />
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
        <span>Documents ({documents.length})</span>
        <button
          onClick={() => loadDocuments()}
          className="hover:text-purple-600 transition-colors"
          title="Refresh document list"
        >
          <RefreshCw size={12} className={isLoadingList ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoadingList ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-purple-600" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-10 px-4">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-500 font-medium">No documents uploaded yet.</p>
            <p className="text-[11px] text-gray-400 mt-1">Upload course slides, syllabus, or research papers.</p>
          </div>
        ) : (
          documents.map((doc) => {
            const badge = statusBadge[doc.status];
            const isSel = selected?.id === doc.id;
            return (
              <div
                key={doc.id}
                className={`group border rounded-xl p-3 cursor-pointer transition-all ${
                  isSel
                    ? 'bg-white border-purple-500 ring-2 ring-purple-100 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                }`}
                onClick={() => setSelected(doc)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className={isSel ? 'text-purple-600' : 'text-gray-400'} />
                    <span className="text-xs font-semibold text-gray-800 truncate" title={doc.fileName}>
                      {doc.fileName}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc);
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100 p-1"
                    aria-label="Delete document"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatFileSize(doc.fileSize)}</span>
                  {doc.chunkCount != null && doc.chunkCount > 0 && (
                    <span className="text-[10px] text-gray-400 ml-auto">{doc.chunkCount} chunks</span>
                  )}
                </div>
                {doc.status === 'FAILED' && doc.errorMessage && (
                  <p className="text-[10px] text-red-600 mt-1.5 line-clamp-2">{doc.errorMessage}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );

  const renderSummaryCard = () => (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <h3 className="text-sm font-bold text-gray-900">Academic Overview & Structured Summary</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            title="Copy summary"
          >
            {copiedSummary ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copiedSummary ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Regenerate academic summary"
          >
            <RefreshCw size={14} className={isRegenerating ? 'animate-spin text-purple-600' : ''} />
            <span className="hidden sm:inline">{isRegenerating ? 'Analyzing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {selected?.summary && selected.summary.length < 450 && (
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between gap-2">
            <span>This document currently has a concise preview summary. Click <strong>Refresh</strong> above to generate the exhaustive 9-section analysis.</span>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-semibold shrink-0 disabled:opacity-50"
            >
              Generate Full 9 Sections
            </button>
          </div>
        )}
        {selected?.summary ? (
          <div className="prose prose-sm max-w-none prose-purple text-gray-800">
            <Markdown content={selected.summary} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <Sparkles size={36} className="text-gray-300 mb-2" />
            <p className="text-sm font-medium">No structured summary generated yet.</p>
            <button
              onClick={handleRegenerate}
              className="mt-3 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Generate Summary
            </button>
          </div>
        )}
      </div>
      <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/40 text-[11px] text-gray-400 flex items-center justify-between shrink-0">
        <span>{selected?.chunkCount != null ? `${selected.chunkCount} vector segments indexed` : ''}</span>
        <span>Grounded strictly in source document</span>
      </div>
    </div>
  );

  const renderChatCard = () => (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xs flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-purple-600" />
          <h3 className="text-sm font-bold text-gray-900">Ask Document Assistant</h3>
        </div>
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 size={11} />
          Verified Citations
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && !isSending ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <Sparkles size={22} />
            </div>
            <h4 className="text-sm font-bold text-gray-800">Ask anything about this PDF</h4>
            <p className="text-xs text-gray-500 max-w-sm mt-1">
              I have indexed the complete text and can explain concepts, solve problems, or quote exact formulas with citations.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 border border-gray-200 text-gray-700 rounded-full text-xs text-left transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) =>
            msg.role === 'USER' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-purple-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%] text-sm shadow-xs">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-start gap-3 max-w-[94%]">
                <div className="w-7 h-7 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 mt-1 shadow-xs">
                  <Sparkles size={13} className="text-purple-600" />
                </div>
                <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-xs text-sm shadow-xs overflow-x-auto">
                  <Markdown content={msg.content} />
                </div>
              </div>
            )
          )
        )}
        {isSending && (
          <div className="flex justify-start gap-3 max-w-[85%]">
            <div className="w-7 h-7 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 mt-1 shadow-xs">
              <Sparkles size={13} className="text-purple-600" />
            </div>
            <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">Synthesizing answer</span>
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl flex items-center px-4 py-2 focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition-all">
          <input
            type="text"
            placeholder="Ask a question about this document..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm px-1 text-gray-900 placeholder-gray-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            disabled={isSending}
          />
          <button
            onClick={() => handleSend()}
            disabled={isSending || !input.trim()}
            className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-all disabled:opacity-40 disabled:hover:bg-purple-600 shrink-0 shadow-xs"
            aria-label="Send"
          >
            <Send size={14} className="-ml-0.5 mt-0.5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderPdfViewer = () => {
    if (!selected) return null;
    const directFileUrl = getPdfDocumentFileUrl(workspaceId, selected.id);
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs flex flex-col h-full overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-purple-600" />
            <span className="text-xs font-bold text-gray-800 truncate max-w-sm">{selected.fileName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadPdfBlob}
              disabled={pdfLoading}
              title="Reload preview"
              className="text-xs text-gray-500 hover:text-purple-600 flex items-center gap-1 font-medium transition-colors"
            >
              <RefreshCw size={12} className={pdfLoading ? 'animate-spin' : ''} />
              Reload
            </button>
            <a
              href={directFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium hover:underline"
            >
              <ExternalLink size={12} />
              Open in new tab
            </a>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 relative min-h-0 flex flex-col">
          {pdfLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-500">
              <Loader2 size={32} className="animate-spin text-purple-600 mb-2" />
              <p className="text-xs font-medium">Loading document preview...</p>
            </div>
          ) : pdfError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-500 text-center">
              <XCircle size={32} className="text-red-500 mb-2" />
              <p className="text-xs text-red-600 font-semibold mb-1">Failed to load PDF preview</p>
              <p className="text-[11px] text-gray-400 max-w-xs mb-3">{pdfError}</p>
              <button
                onClick={loadPdfBlob}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Retry Loading
              </button>
            </div>
          ) : pdfBlobUrl ? (
            <object
              key={pdfBlobUrl}
              data={pdfBlobUrl}
              type="application/pdf"
              className="w-full h-full border-0 bg-white"
            >
              <iframe
                src={pdfBlobUrl}
                title={selected.fileName}
                className="w-full h-full border-0 bg-white"
              />
            </object>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-400">
              <FileText size={36} className="text-gray-300 mb-2" />
              <p className="text-xs">Preview unavailable.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDetail = () => {
    if (!selected) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
          <FileText size={56} className="mb-4 text-gray-300" />
          <h3 className="text-base font-semibold text-gray-700">No Document Selected</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            Select an existing PDF from the left sidebar or upload a new syllabus, lecture notes, or textbook.
          </p>
        </div>
      );
    }

    if (isProcessing(selected.status)) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
          <Loader2 size={44} className="animate-spin mb-4 text-purple-600" />
          <h3 className="text-base font-bold text-gray-800">
            {selected.status === 'PENDING' ? 'Queued for processing...' : 'Analyzing & Indexing Document...'}
          </h3>
          <p className="text-xs text-gray-400 mt-2 max-w-md">
            FastEmbed is embedding text segments, Qdrant is indexing vectors, and AI is generating your 9-section structured overview.
          </p>
        </div>
      );
    }

    if (selected.status === 'FAILED') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
          <XCircle size={44} className="mb-4 text-red-500" />
          <h3 className="text-base font-bold text-gray-800">Processing Failed</h3>
          <p className="text-xs text-red-500 mt-2 max-w-md">{selected.errorMessage || 'Unknown error occurred.'}</p>
          <button
            onClick={() => handleRegenerate()}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700"
          >
            Retry Analysis
          </button>
        </div>
      );
    }

    // View Modes Render
    if (viewMode === 'summary') {
      return <div className="flex-1 p-6 overflow-hidden min-h-0">{renderSummaryCard()}</div>;
    }

    if (viewMode === 'chat') {
      return <div className="flex-1 p-6 overflow-hidden min-h-0">{renderChatCard()}</div>;
    }

    if (viewMode === 'preview') {
      return <div className="flex-1 p-6 overflow-hidden min-h-0">{renderPdfViewer()}</div>;
    }

    // Split View (Default): Document on Left, Tabbed Assistant on Right
    return (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 p-6 overflow-hidden min-h-0">
        <div className="h-full min-h-0 flex flex-col">
          {renderPdfViewer()}
        </div>
        <div className="h-full min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <button
              onClick={() => setSplitTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                splitTab === 'summary'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Sparkles size={13} />
              AI Summary
            </button>
            <button
              onClick={() => setSplitTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                splitTab === 'chat'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <MessageSquare size={13} />
              Ask Document
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {splitTab === 'summary' ? renderSummaryCard() : renderChatCard()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 h-full">
      {renderDocumentList()}
      <section className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        <header className="px-6 py-3.5 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Folder size={18} className="text-purple-600 shrink-0" />
              <h1 className="text-base font-bold text-gray-900 truncate" title={workspace?.name}>
                {workspace?.name || 'Workspace'}
              </h1>
              <button
                onClick={openRename}
                className="p-1 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                title="Rename workspace"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>

          {selected?.status === 'READY' && (
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'split' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Side-by-side view"
              >
                <Columns size={13} />
                <span className="hidden md:inline">Split View</span>
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'summary' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Full summary"
              >
                <Sparkles size={13} />
                <span className="hidden md:inline">Summary</span>
              </button>
              <button
                onClick={() => setViewMode('chat')}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'chat' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Full chat"
              >
                <MessageSquare size={13} />
                <span className="hidden md:inline">Chat</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                  viewMode === 'preview' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="PDF reader"
              >
                <Eye size={13} />
                <span className="hidden md:inline">PDF Reader</span>
              </button>
            </div>
          )}
        </header>
        {renderDetail()}
      </section>

      {renameOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => !savingWorkspace && setRenameOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Rename Workspace</h2>
              <button
                onClick={() => setRenameOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitRename} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Workspace Title</label>
                <input
                  autoFocus
                  type="text"
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameName.trim() || savingWorkspace}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {savingWorkspace && <Loader2 size={15} className="animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfAssistantPanel;
