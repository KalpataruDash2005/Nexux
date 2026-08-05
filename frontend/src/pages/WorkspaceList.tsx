import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Plus, Folder, Loader2, Pencil, Trash2, Sparkles, X } from 'lucide-react';
import { getWorkspaces, createWorkspace, deleteWorkspace, renameWorkspace, Workspace } from '../services/workspaceService';

const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'rename'; target: Workspace | null } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setName('');
    setDescription('');
    setModal({ mode: 'create', target: null });
  };

  const openRename = (ws: Workspace) => {
    setName(ws.name);
    setDescription(ws.description || '');
    setModal({ mode: 'rename', target: ws });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (modal?.mode === 'create') {
        setIsCreating(true);
        const newWs = await createWorkspace(trimmed, description.trim() || 'A new learning workspace');
        setWorkspaces([...workspaces, newWs]);
      } else if (modal?.target) {
        const updated = await renameWorkspace(modal.target.id, trimmed);
        setWorkspaces(workspaces.map((w) => (w.id === updated.id ? updated : w)));
      }
      setModal(null);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to save workspace');
      console.error('Failed to save workspace', error);
    } finally {
      setIsCreating(false);
      setSaving(false);
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
          <button onClick={openCreate} disabled={isCreating} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 shadow-sm transition-colors disabled:opacity-50">
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
                    onClick={() => openRename(ws)}
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !saving && setModal(null)}>
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modal.mode === 'create' ? 'New Workspace' : 'Rename Workspace'}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" title="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Organic Chemistry - Semester 1"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description (optional)"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm resize-none"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || saving}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  <span>{modal.mode === 'create' ? 'Create Workspace' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceList;
