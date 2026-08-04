import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, Pencil, Folder } from 'lucide-react';
import { getWorkspaceById, renameWorkspace, Workspace } from '../services/workspaceService';
import { useAuth } from '../context/AuthContext';
import PdfAssistantPanel from '../components/pdf-assistant/PdfAssistantPanel';
import { ToastProvider, useToast } from '../components/pdf-assistant/Toast';

const AcademicHeader: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    getWorkspaceById(workspaceId)
      .then(setWorkspace)
      .catch(() => setWorkspace(null));
  }, [workspaceId]);

  const handleRename = async () => {
    if (!workspace) return;
    const name = window.prompt(`Rename "${workspace.name}"`, workspace.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const updated = await renameWorkspace(workspace.id, trimmed);
      setWorkspace(updated);
      toast(`Renamed to "${updated.name}".`, 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to rename workspace.', 'error');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Folder size={20} className="text-purple-600 shrink-0" />
        <h1 className="text-lg font-bold text-gray-900 truncate">
          {workspace?.name || 'Workspace'}
        </h1>
        <button
          onClick={handleRename}
          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
          title="Rename workspace"
        >
          <Pencil size={15} />
        </button>
      </div>
      <button
        onClick={() => {
          logout();
          navigate('/auth');
        }}
        className="flex items-center space-x-2 px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors font-medium text-sm"
      >
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </header>
  );
};

const AcademicWorkspace: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <ToastProvider>
        <AcademicHeader workspaceId={workspaceId!} />
        <PdfAssistantPanel workspaceId={workspaceId!} />
      </ToastProvider>
    </div>
  );
};

export default AcademicWorkspace;
