import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Upload,
  Loader2,
  FileText,
  Trash2,
  Send,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Folder,
  Pencil,
  X,
} from 'lucide-react';
import {
  listPdfDocuments,
  uploadPdfDocument,
  deletePdfDocument,
  askPdfQuestion,
  getPdfChatHistory,
  formatFileSize,
  isProcessing,
  PdfDocument,
  PdfChatMessage,
} from '../../services/pdfAssistantService';
import Markdown from './Markdown';
import { useToast } from './Toast';
import { useConfirm } from '../ui/Confirm';
import { getWorkspaceById, renameWorkspace, Workspace } from '../../services/workspaceService';

interface PdfAssistantPanelProps {
  workspaceId: string;
}

const POLL_INTERVAL_MS = 4000;

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
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
          const ready = docs.find((d) => d.status === 'READY');
          return ready ?? null;
        }
        const updated = docs.find((d) => d.id === prev.id);
        return updated ?? prev;
      });
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to load PDF documents.', 'error');
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast('Only PDF files are supported.', 'error');
      return;
    }
    setIsUploading(true);
    try {
      const res = await uploadPdfDocument(workspaceId, file);
      toast(`Uploaded "${res.fileName}". Processing started.`, 'success');
      await loadDocuments();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Upload failed. Check backend logs.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: PdfDocument) => {
    const ok = await confirm({
      title: 'Delete document',
      message: `Delete "${doc.fileName}"? This removes its index and chat history.`,
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

  const handleSend = async () => {
    const question = input.trim();
    if (!question || !selected) return;
    const userMsg: PdfChatMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);
    try {
      const res = await askPdfQuestion(workspaceId, selected.id, question);
      const answerMsg: PdfChatMessage = {
        id: `local-${Date.now() + 1}`,
        role: 'AI',
        content: res.answer,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, answerMsg]);
      if (selected.summary === null) {
        await loadDocuments();
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Sorry, I ran into an error answering that.';
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now() + 1}`, role: 'AI', content: errMsg, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const renderDocumentList = () => (
    <aside className="w-72 border-r border-gray-200 flex flex-col shrink-0 bg-gray-50 h-full">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full border-2 border-dashed border-purple-300 hover:border-purple-500 bg-white rounded-xl p-4 text-center transition-colors disabled:opacity-50"
        >
          <Upload size={20} className="mx-auto mb-2 text-purple-600" />
          <p className="text-sm font-semibold text-gray-700">
            {isUploading ? 'Uploading...' : 'Upload a PDF'}
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF only, up to 25 MB</p>
        </button>
        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoadingList ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-400" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-gray-500 italic px-2 py-6 text-center">
            No PDFs uploaded yet.
          </p>
        ) : (
          documents.map((doc) => {
            const badge = statusBadge[doc.status];
            return (
              <div
                key={doc.id}
                className={
                  'group border rounded-xl p-3 cursor-pointer transition-colors ' +
                  (selected?.id === doc.id
                    ? 'bg-white border-purple-300 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-gray-300')
                }
                onClick={() => setSelected(doc)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className="text-purple-600 shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc);
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    aria-label="Delete document"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ' + badge.className}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  <span className="text-[11px] text-gray-400">{formatFileSize(doc.fileSize)}</span>
                </div>
                {doc.status === 'FAILED' && doc.errorMessage && (
                  <p className="text-[11px] text-red-600 mt-1.5 line-clamp-2">{doc.errorMessage}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );

  const renderDetail = () => {
    if (!selected) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
          <FileText size={48} className="mb-4 opacity-50" />
          <p className="text-sm text-center">Upload a PDF to generate a summary<br />and ask questions about it.</p>
        </div>
      );
    }

    if (isProcessing(selected.status)) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
          <Loader2 size={40} className="animate-spin mb-4 text-purple-600" />
          <p className="text-sm font-medium">
            {selected.status === 'PENDING' ? 'Queued for processing...' : 'Extracting, indexing and summarizing...'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {selected.processingSource === 'N8N' ? 'n8n pipeline' : 'This can take a few seconds.'}
          </p>
        </div>
      );
    }

    if (selected.status === 'FAILED') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
          <XCircle size={40} className="mb-4 text-red-500" />
          <p className="text-sm font-medium text-gray-700">This PDF could not be processed.</p>
          <p className="text-xs text-gray-400 mt-2 max-w-md text-center">{selected.errorMessage || 'No details available.'}</p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-h-[280px]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <Sparkles size={16} className="text-purple-600" />
              <h3 className="font-bold text-gray-900">AI Summary</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-5 max-h-[420px]">
              {selected.summary ? (
                <Markdown content={selected.summary} />
              ) : (
                <p className="text-sm text-gray-400">No summary available.</p>
              )}
              <p className="text-[11px] text-gray-400 mt-3">
                {selected.chunkCount != null ? `${selected.chunkCount} chunks indexed` : ''}
                {selected.processingSource ? ` · processed via ${selected.processingSource}` : ''}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-h-[280px]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <MessageSquare size={16} className="text-purple-600" />
              <h3 className="font-bold text-gray-900">Ask about this document</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[420px]">
              {messages.length === 0 && !isSending ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                  <MessageSquare size={40} className="mb-3 opacity-50" />
                  <p className="text-sm text-center">Ask anything about this PDF.<br />I've read the whole document.</p>
                </div>
              ) : (
                messages.map((msg) =>
                  msg.role === 'USER' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="bg-purple-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex justify-start gap-3 max-w-[92%]">
                      <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
                        <Sparkles size={15} className="text-purple-600" />
                      </div>
                      <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm">
                        <Markdown content={msg.content} />
                      </div>
                    </div>
                  )
                )
              )}
              {isSending && (
                <div className="flex justify-start gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
                    <Sparkles size={15} className="text-purple-600" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 px-5 py-4 rounded-2xl flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-gray-100">
              <div className="bg-gray-50 border border-gray-200 rounded-full flex items-center px-4 py-2 focus-within:ring-1 focus-within:ring-purple-500 transition-all">
                <input
                  type="text"
                  placeholder="Ask a question about the PDF..."
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-2 text-gray-900 placeholder-gray-400"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || !input.trim()}
                  className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send size={14} className="-ml-0.5 mt-0.5" />
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {renderDocumentList()}
      <section className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Folder size={20} className="text-purple-600 shrink-0" />
              <h1 className="text-lg font-bold text-gray-900 truncate" title={workspace?.name}>
                {workspace?.name || 'Workspace'}
              </h1>
              <button
                onClick={openRename}
                className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                title="Rename workspace"
              >
                <Pencil size={15} />
              </button>
            </div>
            <div className="hidden sm:block border-l border-gray-200 h-6"></div>
            <div className="hidden sm:block">
              <span className="text-xs text-gray-500 font-medium">PDF Assistant</span>
            </div>
          </div>
          {selected?.status === 'READY' && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <AlertCircle size={13} />
              Answers are grounded in this document only.
            </span>
          )}
        </header>
        {renderDetail()}
      </section>

      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !savingWorkspace && setRenameOpen(false)}>
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Rename Workspace</h2>
              <button onClick={() => setRenameOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" title="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitRename} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
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
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {savingWorkspace && <Loader2 size={15} className="animate-spin" />}
                  <span>Save</span>
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
