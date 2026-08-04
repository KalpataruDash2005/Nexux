import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle, Loader2 } from 'lucide-react';

export default function ResumeAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please upload a valid PDF file.');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8080/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract text from PDF');
      }

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        setExtractedText(JSON.stringify(json, null, 2));
      } catch (e) {
        setExtractedText(text);
      }
      
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
      <div className="max-w-3xl w-full space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            AI Resume Analyzer
          </h1>
          <p className="text-slate-400 text-lg">
            Upload your resume and let Gemini AI evaluate your profile.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl transition-all">
          
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-10 flex flex-col items-center justify-center bg-slate-800/50 hover:bg-slate-800/80 transition-colors relative cursor-pointer">
            <input 
              type="file" 
              accept="application/pdf" 
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {file ? (
              <div className="flex flex-col items-center text-emerald-400 space-y-3">
                <CheckCircle size={48} className="animate-bounce" />
                <p className="text-lg font-medium">{file.name}</p>
                <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-400 space-y-4">
                <div className="bg-slate-800 p-4 rounded-full">
                  <UploadCloud size={40} className="text-blue-400" />
                </div>
                <p className="text-lg font-medium text-slate-300">Click or drag your PDF here</p>
                <p className="text-sm">Strictly PDF files up to 5MB</p>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!file || isLoading}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg
                ${!file || isLoading 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-500 to-emerald-500 hover:scale-105 hover:shadow-emerald-500/25 text-white'}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  Analyzing with Gemini AI...
                </>
              ) : (
                <>
                  <FileText size={24} />
                  Analyze Resume
                </>
              )}
            </button>
          </div>
        </div>

        {extractedText && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl animate-fade-in-up">
            <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
              <FileText className="text-emerald-400" size={20} />
              AI Analysis Results
            </h3>
            <div className="bg-slate-950 rounded-xl p-4 max-h-[500px] overflow-y-auto border border-slate-800">
              <pre className="text-emerald-300 text-sm whitespace-pre-wrap font-mono">
                {extractedText}
              </pre>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
