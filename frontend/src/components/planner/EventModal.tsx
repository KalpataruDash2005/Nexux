import React, { useState } from 'react';
import {
  X, CalendarDays, MapPin, Clock, Layers, Trash2, CheckCircle2, Pencil,
  ShieldCheck, AlertTriangle, Save, Loader2, Sparkles,
} from 'lucide-react';
import {
  PlannerEvent, UpdateEventInput, updateEvent, deleteEvent,
  CATEGORY_META, categoryLabel, countdown,
} from '../../services/plannerService';

interface Props {
  event: PlannerEvent;
  onClose: () => void;
  onUpdated: (event: PlannerEvent) => void;
  onDeleted: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const EventModal: React.FC<Props> = ({ event, onClose, onUpdated, onDeleted, onToast }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateEventInput>({
    title: event.title,
    description: event.description ?? '',
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    category: event.category,
    priority: event.priority,
    color: event.color ?? undefined,
    location: event.location ?? '',
    semester: event.semester ?? '',
    completed: event.completed,
  });

  const set = <K extends keyof UpdateEventInput>(key: K, value: UpdateEventInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateEvent(event.id, {
        ...form,
        location: form.location || null,
        semester: form.semester || null,
        description: form.description || '',
      });
      setEditing(false);
      onUpdated(updated);
      onToast('Event updated.', 'success');
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Could not update event', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async () => {
    try {
      const updated = await updateEvent(event.id, { completed: !event.completed });
      onUpdated(updated);
      onToast(event.completed ? 'Marked as incomplete.' : 'Marked as completed — great work!', 'success');
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Could not update event', 'error');
    }
  };

  const handleVerify = async () => {
    try {
      const updated = await updateEvent(event.id, { needsVerification: false });
      onUpdated(updated);
      onToast('Event verified.', 'success');
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Could not verify event', 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      await deleteEvent(event.id);
      onDeleted(event.id);
      onToast('Event deleted.', 'success');
    } catch (err: any) {
      onToast(err?.response?.data?.message || 'Could not delete event', 'error');
    }
  };

  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.OTHER;
  const inputCls = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeInUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: event.color ?? meta.color }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                  {categoryLabel(event.category)}
                </p>
                <h3 className="text-xl font-bold text-gray-900 leading-tight">{event.title}</h3>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {!editing && (
                <button onClick={() => setEditing(true)} className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Edit">
                  <Pencil size={17} />
                </button>
              )}
              <button onClick={handleDelete} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                <Trash2 size={17} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="Close">
                <X size={17} />
              </button>
            </div>
          </div>

          {event.needsVerification && (
            <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-700 flex items-center space-x-2">
                <AlertTriangle size={15} />
                <span>AI is not fully sure about this event. Please verify the details.</span>
              </p>
              <button onClick={handleVerify} className="text-xs font-bold text-amber-700 hover:underline shrink-0 ml-2">
                Looks right
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              {countdown(event.daysRemaining)}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              event.priority === 'HIGH' ? 'bg-red-50 text-red-600' : event.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
            }`}>
              {event.priority} priority
            </span>
            {event.aiConfidence != null && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 flex items-center space-x-1">
                <Sparkles size={11} />
                <span>AI {Math.round(event.aiConfidence * 100)}% sure</span>
              </span>
            )}
            {event.completed && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-600 flex items-center space-x-1">
                <CheckCircle2 size={11} />
                <span>Completed</span>
              </span>
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          {!editing ? (
            <div className="space-y-3">
              <InfoRow icon={<CalendarDays size={16} />} label="Date"
                value={new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
              {(event.startTime || event.endTime) && (
                <InfoRow icon={<Clock size={16} />} label="Time"
                  value={event.startTime ? `${event.startTime}${event.endTime ? ' – ' + event.endTime : ''}` : event.endTime ?? ''} />
              )}
              {event.location && <InfoRow icon={<MapPin size={16} />} label="Location" value={event.location} />}
              {event.semester && <InfoRow icon={<Layers size={16} />} label="Semester" value={event.semester} />}
              {event.description && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Details</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleToggleComplete}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    event.completed ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  <span>{event.completed ? 'Mark incomplete' : 'Mark completed'}</span>
                </button>
                {event.needsVerification && (
                  <button onClick={handleVerify} className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors">
                    <ShieldCheck size={16} />
                    <span>Verify</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Title">
                <input className={inputCls} value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field label="Description">
                <textarea className={inputCls} rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" className={inputCls} value={form.date ?? ''} onChange={(e) => set('date', e.target.value)} />
                </Field>
                <Field label="Start time">
                  <input type="time" className={inputCls} value={form.startTime ?? ''} onChange={(e) => set('startTime', e.target.value || null)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select className={inputCls} value={form.category ?? ''} onChange={(e) => set('category', e.target.value)}>
                    {Object.entries(CATEGORY_META).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, m]) => (
                      <option key={key} value={key}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={inputCls} value={form.priority ?? 'MEDIUM'} onChange={(e) => set('priority', e.target.value)}>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Location">
                  <input className={inputCls} value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} />
                </Field>
                <Field label="Semester">
                  <input className={inputCls} value={form.semester ?? ''} onChange={(e) => set('semester', e.target.value)} />
                </Field>
              </div>
              <div className="pt-2 flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save changes</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center space-x-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
    <span className="text-purple-500 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">{label}</span>
    {children}
  </label>
);

export default EventModal;
