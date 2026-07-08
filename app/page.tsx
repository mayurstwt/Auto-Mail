'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import type { Profile, EmailResult, HistoryEntry } from '@/types';
import { getAllProfiles, upsertProfile, removeProfile, genId, saveResume, getResume, deleteResume, getHistory, addHistoryEntries, clearHistory } from '@/lib/profile-store';
import { validateEmail } from '@/lib/email-utils';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IC = (d: string, s = 16) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const IcMail    = () => IC('M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6');
const IcPlus    = () => IC('M12 5v14M5 12h14');
const IcEdit    = () => IC('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z');
const IcTrash   = () => IC('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6');
const IcSend    = () => IC('m22 2-7 20-4-9-9-4ZM22 2 11 13');
const IcClip    = () => IC('m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48');
const IcCheck   = () => IC('M20 6 9 17l-5-5', 14);
const IcX       = () => IC('M18 6 6 18M6 6l12 12', 14);
const IcLoader  = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IcShuf    = () => IC('M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5');
const IcHistory = () => IC('M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3M3 4v4h4');
const IcCalendar= () => IC('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z');

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'library' | 'send' | 'history';
type SendMode = 'specific' | 'random';

interface ModalState {
  open: boolean;
  profile: Partial<Profile>;
  file: File | null;
  saving: boolean;
  error: string;
}

// ── Upload Button ─────────────────────────────────────────────────────────────
function UploadBtn({ file, existing, onChange }: { file: File | null; existing?: string; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const label = file ? file.name : existing ? `${existing} (click to replace)` : 'Upload Resume (PDF / DOCX)';
  return (
    <div>
      <input ref={ref} type="file" accept=".pdf,.doc,.docx" className="sr-only"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => ref.current?.click()}
        className={`upload-zone w-full text-left ${file || existing ? 'upload-zone-active' : ''}`}>
        <IcClip />
        <span className="flex-1 truncate text-sm">{label}</span>
        {file && <span className="text-xs text-[#555] shrink-0">{(file.size / 1024).toFixed(0)} KB</span>}
      </button>
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ state, onSave, onClose }: {
  state: ModalState;
  onSave: (p: Partial<Profile>, file: File | null) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Profile>>(state.profile);
  const [file, setFile] = useState<File | null>(state.file);
  const isEdit = !!state.profile.id;

  useEffect(() => { setForm(state.profile); setFile(null); }, [state.profile]);

  const valid = form.name?.trim() && form.subject?.trim() && form.body?.trim() && (isEdit || file);

  return (
    <div className="modal-overlay animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Profile' : 'New Profile'}</h2>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[#888] mb-1.5">Profile Name *</label>
            <input className="form-control" placeholder="e.g. Frontend Engineer SDE-2"
              value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1.5">Email Subject *</label>
            <input className="form-control" placeholder="Application for Frontend Engineer Role"
              value={form.subject ?? ''} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1.5">Email Body *</label>
            <textarea className="form-control resize-y" rows={7}
              placeholder={'Hi,\n\nI came across your opening and I\'m excited to apply...\n\nBest,\nYour Name'}
              value={form.body ?? ''} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1.5">Resume {isEdit ? '(optional — keep existing if blank)' : '*'}</label>
            <UploadBtn file={file} existing={isEdit ? form.resumeName : undefined} onChange={setFile} />
          </div>
        </div>

        {state.error && <p className="text-xs text-[#888] mt-1">{state.error}</p>}

        <div className="flex gap-3 pt-1">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-[2]" disabled={!valid || state.saving}
            onClick={() => onSave(form, file)}>
            {state.saving ? <><IcLoader /> Saving…</> : isEdit ? 'Update Profile' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, onEdit, onDelete }: {
  profile: Profile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card card-hover p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{profile.name}</h3>
        <div className="flex gap-1 shrink-0">
          <button className="btn-ghost px-2 py-1 text-xs" onClick={onEdit} title="Edit"><IcEdit /></button>
          <button className="btn-danger px-2 py-1 text-xs" onClick={onDelete} title="Delete"><IcTrash /></button>
        </div>
      </div>
      <div className="text-xs text-[#555] truncate">📧 {profile.subject}</div>
      <div className="text-xs text-[#444] line-clamp-2 leading-relaxed">{profile.body}</div>
      <div className="flex items-center gap-1.5 text-xs text-[#555] pt-1 border-t border-[#1a1a1a]">
        <IcClip />
        <span className="truncate">{profile.resumeName}</span>
      </div>
    </div>
  );
}

// ── Library Tab ───────────────────────────────────────────────────────────────
function LibraryTab({ profiles, onAdd, onEdit, onDelete }: {
  profiles: Profile[];
  onAdd: () => void;
  onEdit: (p: Profile) => void;
  onDelete: (p: Profile) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Profile Library</h2>
          <p className="text-xs text-[#555] mt-0.5">Pre-written email templates + resumes for each role</p>
        </div>
        <button id="add-profile-btn" className="btn-primary" onClick={onAdd}>
          <IcPlus /> New Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="card p-10 text-center flex flex-col items-center gap-3">
          <IcMail />
          <p className="text-sm text-[#555]">No profiles yet. Add one to get started.</p>
          <button className="btn-ghost mt-1" onClick={onAdd}><IcPlus /> Add Profile</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profiles.map(p => (
            <ProfileCard key={p.id} profile={p}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Results Panel ─────────────────────────────────────────────────────────────
function ResultsPanel({ results }: { results: EmailResult[] }) {
  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  return (
    <div className="card p-4 flex flex-col gap-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Results</h3>
        <div className="flex gap-2">
          {sent > 0 && <span className="badge-sent"><IcCheck /> {sent} sent</span>}
          {failed > 0 && <span className="badge-failed"><IcX /> {failed} failed</span>}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {results.map((r, i) => (
          <li key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
            r.status === 'sent' ? 'bg-[#141414] border border-[#222]' : 'bg-[#0f0f0f] border border-[#1a1a1a]'
          }`}>
            <span className={r.status === 'sent' ? 'text-white' : 'text-[#555]'}>
              {r.status === 'sent' ? <IcCheck /> : <IcX />}
            </span>
            <span className={`flex-1 font-mono truncate ${r.status === 'sent' ? 'text-[#ccc]' : 'text-[#555]'}`}>{r.email}</span>
            {r.profileName && <span className="text-[#444] shrink-0">{r.profileName}</span>}
            {r.error && <span className="text-[#555] shrink-0 truncate max-w-[120px]" title={r.error}>{r.error}</span>}
            <span className={`shrink-0 font-semibold uppercase tracking-wide ${r.status === 'sent' ? 'text-[#888]' : 'text-[#333]'}`}>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  const totalSent   = history.filter(h => h.status === 'sent').length;
  const totalFailed = history.filter(h => h.status === 'failed').length;

  // Group entries by calendar date
  const groups = new Map<string, HistoryEntry[]>();
  history.forEach(h => {
    const d = new Date(h.sentAt);
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  });

  const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Send History</h2>
          <p className="text-xs text-[#555] mt-0.5">Every email dispatched from AutoMail</p>
        </div>
        {history.length > 0 && (
          <button className="btn-ghost text-xs px-3 py-1.5"
            onClick={() => { if (confirm('Clear all history?')) onClear(); }}>
            <IcTrash /> Clear All
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[['Total Emails', history.length], ['Sent', totalSent], ['Failed', totalFailed]].map(([label, val]) => (
          <div key={label as string} className="card p-3 text-center">
            <div className="text-xl font-bold">{val}</div>
            <div className="text-xs text-[#555] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {history.length === 0 ? (
        <div className="card p-10 text-center flex flex-col items-center gap-3">
          <IcHistory />
          <p className="text-sm text-[#555]">No emails sent yet. Head to the Send tab to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([date, entries]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <IcCalendar />
                <span className="text-xs font-medium text-[#666]">{date}</span>
                <span className="text-xs text-[#333]">{entries.length} email{entries.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {entries.map(h => (
                  <div key={h.id}
                    className={`card px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs ${
                      h.status === 'sent' ? 'border-[#1e1e1e]' : 'border-[#1a1a1a] opacity-60'
                    }`}>
                    <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                      h.status === 'sent' ? 'bg-white text-black' : 'bg-[#222] text-[#666]'
                    }`}>
                      {h.status === 'sent' ? <IcCheck /> : <IcX />}
                    </span>
                    <span className="font-mono text-[#ccc] flex-1 truncate">{h.email}</span>
                    <span className="text-[#555] shrink-0 hidden sm:block">{h.subject.length > 35 ? h.subject.slice(0,35)+'…' : h.subject}</span>
                    <span className="text-[#444] shrink-0">{h.profileName}</span>
                    <span className="text-[#333] shrink-0 flex items-center gap-1"><IcClip />{h.resumeName.length > 20 ? h.resumeName.slice(0,20)+'…' : h.resumeName}</span>
                    <span className="text-[#333] shrink-0">{fmtTime(h.sentAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Send Tab ──────────────────────────────────────────────────────────────────
function SendTab({ profiles, onSent }: { profiles: Profile[]; onSent: (entries: HistoryEntry[]) => void }) {
  const [emails, setEmails] = useState('');
  const [mode, setMode] = useState<SendMode>('specific');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EmailResult[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (profiles.length > 0 && !selectedId) setSelectedId(profiles[0].id);
  }, [profiles, selectedId]);

  const emailCount = emails.split('\n').map(e => e.trim()).filter(Boolean).length;
  const canSend = emailCount > 0 && profiles.length > 0 && (mode === 'random' || selectedId);

  const sendGroup = async (profile: Profile, groupEmails: string[]): Promise<EmailResult[]> => {
    const resumeData = await getResume(profile.id);
    if (!resumeData) return groupEmails.map(email => ({ email, status: 'failed' as const, error: 'Resume not found for this profile.' }));
    const blob = new Blob([resumeData.buffer], { type: resumeData.mimeType });
    const fd = new FormData();
    fd.append('subject', profile.subject);
    fd.append('body', profile.body);
    fd.append('emails', groupEmails.join('\n'));
    fd.append('resume', blob, resumeData.filename);
    const res = await fetch('/api/send-emails', { method: 'POST', body: fd });
    const data = await res.json();
    return (data.results ?? []).map((r: EmailResult) => ({ ...r, profileName: profile.name }));
  };

  const handleSend = async () => {
    const emailList = emails.split('\n').map(e => e.trim()).filter(Boolean);
    if (emailList.length === 0) { setError('Please enter at least one email address.'); return; }
    if (profiles.length === 0) { setError('Add at least one profile first.'); return; }

    setLoading(true); setError(''); setResults(null);

    const toHistoryEntries = (results: EmailResult[], profile: Profile): HistoryEntry[] =>
      results.map(r => ({
        id: genId(),
        sentAt: Date.now(),
        email: r.email,
        profileName: profile.name,
        resumeName: profile.resumeName,
        subject: profile.subject,
        status: r.status,
        error: r.error,
      }));

    try {
      if (mode === 'specific') {
        const profile = profiles.find(p => p.id === selectedId);
        if (!profile) { setError('Selected profile not found.'); return; }
        setStatus(`Sending via "${profile.name}"…`);
        const res = await sendGroup(profile, emailList);
        setResults(res);
        onSent(toHistoryEntries(res, profile));
      } else {
        const groups = new Map<string, string[]>();
        emailList.forEach(email => {
          const p = profiles[Math.floor(Math.random() * profiles.length)];
          if (!groups.has(p.id)) groups.set(p.id, []);
          groups.get(p.id)!.push(email);
        });
        const all: EmailResult[] = [];
        const histEntries: HistoryEntry[] = [];
        let i = 0;
        for (const [pid, grpEmails] of groups) {
          i++;
          const profile = profiles.find(p => p.id === pid)!;
          setStatus(`Sending batch ${i} of ${groups.size} via "${profile.name}"…`);
          const res = await sendGroup(profile, grpEmails);
          all.push(...res);
          histEntries.push(...toHistoryEntries(res, profile));
        }
        setResults(all);
        onSent(histEntries);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setLoading(false); setStatus('');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">Send Emails</h2>
        <p className="text-xs text-[#555] mt-0.5">Paste recruiter emails and pick which profile to send</p>
      </div>

      {profiles.length === 0 && (
        <div className="card p-4 text-sm text-[#555]">
          ⚠ No profiles found — go to <strong className="text-[#888]">Library</strong> and add at least one profile first.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Email list */}
        <div>
          <label htmlFor="emails-input" className="block text-xs text-[#888] mb-1.5">
            Recruiter Emails (one per line)
            {emailCount > 0 && <span className="ml-2 text-[#555]">{emailCount} address{emailCount !== 1 ? 'es' : ''}</span>}
          </label>
          <textarea id="emails-input" rows={8}
            className="form-control font-mono text-sm resize-y"
            placeholder={'hr@company.com\nrecruiter@startup.io\njobs@bigtech.com'}
            value={emails} onChange={e => setEmails(e.target.value)} />
        </div>

        {/* Profile selection */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="text-xs text-[#888] font-medium">Profile Selection</p>
          <div className="flex gap-2 flex-wrap">
            <button id="mode-specific"
              className={`btn text-sm px-4 py-2 ${mode === 'specific' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('specific')}>
              Specific Profile
            </button>
            <button id="mode-random"
              className={`btn text-sm px-4 py-2 flex items-center gap-2 ${mode === 'random' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('random')}>
              <IcShuf /> Random per Email
            </button>
          </div>

          {mode === 'specific' && profiles.length > 0 && (
            <select id="profile-select" className="form-control"
              value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.subject}</option>
              ))}
            </select>
          )}

          {mode === 'random' && (
            <p className="text-xs text-[#555]">
              Each recruiter email will be assigned a random profile from your library ({profiles.length} available).
            </p>
          )}
        </div>

        {error && (
          <div className="text-xs text-[#888] p-3 card" role="alert">{error}</div>
        )}

        {loading && status && (
          <div className="flex items-center gap-2 text-xs text-[#666]">
            <IcLoader />{status}
          </div>
        )}

        <button id="send-btn" className="btn-primary w-full py-3" disabled={!canSend || loading} onClick={handleSend}>
          {loading ? <><IcLoader /> Sending…</> : <><IcSend /> Send {emailCount > 0 ? `(${emailCount})` : ''}</>}
        </button>
      </div>

      {results && <ResultsPanel results={results} />}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<Tab>('library');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false, profile: {}, file: null, saving: false, error: '' });

  useEffect(() => {
    setProfiles(getAllProfiles());
    setHistory(getHistory());
  }, []);

  const openAdd  = () => setModal({ open: true, profile: {}, file: null, saving: false, error: '' });
  const openEdit = (p: Profile) => setModal({ open: true, profile: { ...p }, file: null, saving: false, error: '' });

  const handleDelete = async (p: Profile) => {
    if (!confirm(`Delete profile "${p.name}"? This cannot be undone.`)) return;
    removeProfile(p.id);
    await deleteResume(p.id);
    setProfiles(getAllProfiles());
  };

  const handleSent = (entries: HistoryEntry[]) => {
    addHistoryEntries(entries);
    setHistory(getHistory());
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const handleSave = async (form: Partial<Profile>, file: File | null) => {
    setModal(m => ({ ...m, saving: true, error: '' }));
    try {
      const isEdit = !!form.id;
      const id = form.id ?? genId();
      const now = Date.now();

      if (file) {
        const buf = await file.arrayBuffer();
        await saveResume(id, buf, file.name, file.type || 'application/octet-stream');
      }

      const profile: Profile = {
        id,
        name: form.name!,
        subject: form.subject!,
        body: form.body!,
        resumeName: file ? file.name : form.resumeName ?? '',
        resumeMimeType: file ? (file.type || 'application/octet-stream') : form.resumeMimeType ?? '',
        createdAt: form.createdAt ?? now,
        updatedAt: now,
      };

      upsertProfile(profile);
      setProfiles(getAllProfiles());
      setModal(m => ({ ...m, open: false }));
    } catch (e) {
      setModal(m => ({ ...m, saving: false, error: (e as Error).message }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between sticky top-0 z-10 max-w-3xl mx-auto w-full" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="black" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6" stroke="white" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">AutoMail</span>
        </div>

        <nav className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
          <button id="tab-library" onClick={() => setTab('library')} className={`tab text-xs px-3 py-1.5 ${tab === 'library' ? 'tab-active' : ''}`}>
            Library {profiles.length > 0 && <span className="ml-1 text-[#444]">({profiles.length})</span>}
          </button>
          <button id="tab-send" onClick={() => setTab('send')} className={`tab text-xs px-3 py-1.5 ${tab === 'send' ? 'tab-active' : ''}`}>
            Send
          </button>
          <button id="tab-history" onClick={() => setTab('history')} className={`tab text-xs px-3 py-1.5 flex items-center gap-1 ${tab === 'history' ? 'tab-active' : ''}`}>
            <IcHistory />
            {history.length > 0 && <span className="text-[#444]">{history.length}</span>}
          </button>
        </nav>
      </header>


      {/* Main content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 animate-fade-in">
        {tab === 'library' && <LibraryTab profiles={profiles} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />}
        {tab === 'send'    && <SendTab profiles={profiles} onSent={handleSent} />}
        {tab === 'history' && <HistoryTab history={history} onClear={handleClearHistory} />}
      </main>

      <footer className="text-center text-xs text-[#333] py-4 border-t border-[#111]">
        AutoMail · Emails sent via Gmail SMTP · Resumes stored locally in your browser
      </footer>

      {modal.open && (
        <ProfileModal state={modal} onSave={handleSave} onClose={() => setModal(m => ({ ...m, open: false }))} />
      )}
    </div>
  );
}
