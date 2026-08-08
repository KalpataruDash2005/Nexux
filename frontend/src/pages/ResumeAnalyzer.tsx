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
      const response = await fetch('/api/resume/upload', {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-foreground font-sans">
      <div className="max-w-3xl w-full space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AI Resume Analyzer
          </h1>
          <p className="text-muted text-lg">
            Upload your resume and let Gemini AI evaluate your profile.
          </p>
        </div>

        <div className="bg-white border border-border rounded-3xl p-8 shadow-card transition-all">
          
          <div className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center bg-tag-bg hover:bg-slate-50 transition-colors relative cursor-pointer">
            <input 
              type="file" 
              accept="application/pdf" 
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {file ? (
              <div className="flex flex-col items-center text-emerald-600 space-y-3">
                <CheckCircle size={48} className="animate-bounce" />
                <p className="text-lg font-medium">{file.name}</p>
                <p className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-muted space-y-4">
                <div className="bg-tag-bg p-4 rounded-full">
                  <UploadCloud size={40} className="text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground">Click or drag your PDF here</p>
                <p className="text-sm">Strictly PDF files up to 5MB</p>
              </div>
            )}
          </div>

          {error && <p className="text-error text-sm mt-4 text-center">{error}</p>}

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!file || isLoading}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg
                ${!file || isLoading 
                  ? 'bg-tag-bg text-muted cursor-not-allowed' 
                  : 'bg-primary hover:bg-primary-hover hover:scale-105 shadow-card text-white'}`}
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
          <div className="bg-white border border-border rounded-3xl p-8 shadow-card animate-fade-in-up">
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="text-emerald-600" size={20} />
              AI Analysis Results
            </h3>
            <div className="bg-tag-bg rounded-xl p-4 max-h-[500px] overflow-y-auto border border-border">
              <pre className="text-foreground text-sm whitespace-pre-wrap font-mono">
                {extractedText}
              </pre>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
