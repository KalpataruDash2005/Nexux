import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, X, FileText, Image as ImageIcon, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { uploadCalendar, CalendarUploadResponse } from '../../services/plannerService';

interface Props {
  onClose: () => void;
  onImported: (result: CalendarUploadResponse) => void;
}

const UploadCalendarModal: React.FC<Props> = ({ onClose, onImported }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (candidate: File) => {
    const lower = candidate.name.toLowerCase();
    if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')
      || lower.endsWith('.webp') || lower.endsWith('.bmp')) {
      setFile(candidate);
      setError(null);
    } else {
      setError('Unsupported file type. Please upload a PDF, PNG, JPG or screenshot of your academic calendar.');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) accept(dropped);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadCalendar(file);
      onImported(result);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-[fadeInUp_0.25s_ease-out]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Upload Academic Calendar</h2>
              <p className="text-sm text-gray-500">AI will extract every event automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
            dragging ? 'border-purple-500 bg-purple-50 scale-[1.01]' : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }`}
        >
          {file ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                {file.name.toLowerCase().endsWith('.pdf') ? <FileText size={28} /> : <ImageIcon size={28} />}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                <UploadCloud size={28} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Drag & drop your calendar here</p>
                <p className="text-sm text-gray-500">or click to browse — PDF, PNG, JPG, screenshot</p>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) accept(picked);
              e.target.value = '';
            }}
          />
        </div>

        {error && (
          <div className="mt-4 flex items-start space-x-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 disabled:opacity-50 transition-all shadow-md"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>{uploading ? 'Extracting with AI...' : 'Upload & Extract'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadCalendarModal;
