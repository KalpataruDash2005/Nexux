import React from 'react';
import { FileText, Loader2, CheckCircle2, XCircle, X, Sparkles } from 'lucide-react';

export type UploadStage = 'idle' | 'preparing' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface DocumentUploadProgressProps {
  stage: UploadStage;
  progress: number; // 0 to 100
  fileName?: string;
  fileSize?: number; // bytes
  statusMessage?: string;
  errorMessage?: string;
  onCancel?: () => void;
  className?: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const DocumentUploadProgress: React.FC<DocumentUploadProgressProps> = ({
  stage,
  progress,
  fileName,
  fileSize,
  statusMessage,
  errorMessage,
  onCancel,
  className = '',
}) => {
  if (stage === 'idle') return null;

  const stageBadge = () => {
    switch (stage) {
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
            <Loader2 size={11} className="animate-spin text-amber-600" /> Preparing
          </span>
        );
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 shrink-0">
            <Loader2 size={11} className="animate-spin text-purple-600" /> Uploading {Math.round(progress)}%
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50/90 px-2.5 py-0.5 rounded-full border border-purple-200 shadow-xs shrink-0">
            <Sparkles size={11} className="text-purple-600 animate-pulse" /> AI / RAG Indexing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
            <CheckCircle2 size={11} className="text-emerald-600" /> Ready
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 shrink-0">
            <XCircle size={11} className="text-rose-600" /> Failed
          </span>
        );
    }
  };

  const getProgressWidth = () => {
    if (stage === 'preparing') return 12;
    if (stage === 'uploading') return Math.max(12, Math.min(progress, 95));
    if (stage === 'processing') return 98;
    if (stage === 'completed') return 100;
    return 100;
  };

  const getProgressBarColor = () => {
    if (stage === 'failed') return 'bg-rose-500';
    if (stage === 'completed') return 'bg-emerald-500';
    if (stage === 'processing') return 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600';
    return 'bg-gradient-to-r from-purple-500 to-indigo-600';
  };

  const descriptionText =
    statusMessage ||
    (stage === 'preparing' && 'Validating and reading document...') ||
    (stage === 'uploading' && `Uploading document bytes (${Math.round(progress)}%)...`) ||
    (stage === 'processing' && 'Extracting text and generating vector chunks in background...') ||
    (stage === 'completed' && 'Document indexed and ready for exploration.') ||
    (stage === 'failed' && (errorMessage || 'Upload aborted or failed.'));

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-300 shadow-sm ${
        stage === 'failed'
          ? 'border-rose-200 bg-rose-50/50'
          : stage === 'completed'
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-purple-200 bg-white ring-1 ring-purple-50'
      } ${className}`}
    >
      {/* Top row: Icon + Document Title + Cancel button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              stage === 'failed'
                ? 'bg-rose-100 text-rose-600'
                : stage === 'completed'
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-purple-100 text-purple-600'
            }`}
          >
            {stage === 'processing' ? (
              <Sparkles size={16} className="text-purple-600 animate-pulse" />
            ) : (
              <FileText size={16} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-gray-900" title={fileName}>
              {fileName || 'Document'}
            </p>
            {fileSize != null && fileSize > 0 && (
              <span className="text-[10px] text-gray-400 font-medium">
                {formatBytes(fileSize)}
              </span>
            )}
          </div>
        </div>

        {onCancel && (stage === 'preparing' || stage === 'uploading' || stage === 'processing') && (
          <button
            type="button"
            onClick={onCancel}
            title="Cancel upload"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Middle row: Stage badge and clear status description */}
      <div className="mt-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1.5">
          {stageBadge()}
          {stage === 'uploading' && (
            <span className="text-[11px] font-semibold text-purple-600">
              {Math.round(progress)}%
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 leading-normal line-clamp-2">
          {descriptionText}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full transition-all duration-300 rounded-full ${getProgressBarColor()} ${
              stage === 'processing' ? 'animate-pulse' : ''
            }`}
            style={{ width: `${getProgressWidth()}%` }}
          />
        </div>
      </div>

      {stage === 'failed' && errorMessage && (
        <div className="mt-2 text-[11px] font-medium text-rose-600 break-words">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default DocumentUploadProgress;
