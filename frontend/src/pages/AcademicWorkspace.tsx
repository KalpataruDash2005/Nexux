import React from 'react';
import { useParams } from 'react-router-dom';
import PdfAssistantPanel from '../components/pdf-assistant/PdfAssistantPanel';
import { ToastProvider } from '../components/pdf-assistant/Toast';

const AcademicWorkspace: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <ToastProvider>
        <PdfAssistantPanel workspaceId={workspaceId!} />
      </ToastProvider>
    </div>
  );
};

export default AcademicWorkspace;
