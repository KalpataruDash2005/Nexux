import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Plus, Folder, Loader2, Pencil, Trash2, Sparkles } from 'lucide-react';
import { getWorkspaces, createWorkspace, deleteWorkspace, renameWorkspace, Workspace } from '../services/workspaceService';

const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await getWorkspaces();
      setWorkspaces(data);
    } catch (error) {
      console.error('Failed to fetch workspaces', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = window.prompt('Name your new workspace (e.g. "Organic Chemistry - Semester 1")');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Workspace name cannot be empty.');
      return;
    }
    const description = window.prompt('Add a short description (optional):') || 'A new learning workspace';
    try {
      setIsCreating(true);
      const newWs = await createWorkspace(trimmed, description.trim() || 'A new learning workspace');
      setWorkspaces([...workspaces, newWs]);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to create workspace');
      console.error('Failed to create workspace', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (ws: Workspace) => {
    const name = window.prompt(`Rename "${ws.name}"`, ws.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const updated = await renameWorkspace(ws.id, trimmed);
      setWorkspaces(workspaces.map((w) => (w.id === ws.id ? updated : w)));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to rename workspace');
      console.error('Failed to rename workspace', error);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    if (!window.confirm(`Delete "${ws.name}"? This permanently removes the workspace, its PDFs, chats and study data.`)) {
      return;
    }
    try {
      await deleteWorkspace(ws.id);
      setWorkspaces(workspaces.filter((w) => w.id !== ws.id));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to delete workspace. Please try again.');
      console.error('Failed to delete workspace', error);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Academic Workspaces</h1>
            <p className="text-sm text-gray-500">
              {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
            </p>
          </div>
          <button onClick={handleCreate} disabled={isCreating} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition-colors disabled:opacity-50">
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} <span>New Workspace</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48 text-gray-400">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <div key={ws.id} className="bg-white border rounded-2xl p-6 hover:shadow-md transition-all cursor-pointer group relative">
                <NavLink to={`/workspaces/${ws.id}`} className="block">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{ws.name}</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {new Date(ws.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                  <div className="flex items-center space-x-4 text-xs font-semibold text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Folder size={14} /> <span className="line-clamp-1">{ws.description}</span>
                    </div>
                  </div>
                </NavLink>
                <div className="absolute top-4 right-4 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRename(ws)}
                    className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    title="Rename workspace"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(ws)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete workspace"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {workspaces.length === 0 && (
              <div className="col-span-3 text-center text-gray-500 py-12 border-2 border-dashed rounded-2xl">
                <Sparkles size={32} className="mx-auto mb-3 text-gray-300" />
                No workspaces yet. Click "New Workspace" to create your first study space.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceList;
