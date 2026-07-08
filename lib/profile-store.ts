/**
 * lib/profile-store.ts
 * Client-side persistence.
 *  - Resume binary data  → IndexedDB (handles large ArrayBuffers)
 *  - Profile metadata    → localStorage
 *  - Send history        → localStorage (capped at 1000 entries)
 *
 * Import only in 'use client' components.
 */

import type { Profile, HistoryEntry } from '@/types';

// ── IndexedDB ─────────────────────────────────────────────────────────────────

const DB_NAME = 'automail-db';
const DB_VERSION = 1;
const RESUME_STORE = 'resumes';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(RESUME_STORE))
        db.createObjectStore(RESUME_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function saveResume(profileId: string, buffer: ArrayBuffer, filename: string, mimeType: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESUME_STORE, 'readwrite');
    tx.objectStore(RESUME_STORE).put({ id: profileId, buffer, filename, mimeType });
    tx.oncomplete = () => resolve();
    tx.onerror   = () => reject(tx.error);
  });
}

export async function getResume(profileId: string): Promise<{ buffer: ArrayBuffer; filename: string; mimeType: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESUME_STORE, 'readonly');
    const req = tx.objectStore(RESUME_STORE).get(profileId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteResume(profileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RESUME_STORE, 'readwrite');
    tx.objectStore(RESUME_STORE).delete(profileId);
    tx.oncomplete = () => resolve();
    tx.onerror   = () => reject(tx.error);
  });
}

// ── Profile metadata (localStorage) ──────────────────────────────────────────

const META_KEY = 'automail:profiles';

export function getAllProfiles(): Profile[] {
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? '[]') as Profile[]; }
  catch { return []; }
}

export function upsertProfile(profile: Profile): void {
  const all = getAllProfiles();
  const idx = all.findIndex((p) => p.id === profile.id);
  if (idx >= 0) all[idx] = profile; else all.push(profile);
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

export function removeProfile(id: string): void {
  localStorage.setItem(META_KEY, JSON.stringify(getAllProfiles().filter((p) => p.id !== id)));
}

// ── Send History (localStorage) ───────────────────────────────────────────────

const HISTORY_KEY = 'automail:history';
const HISTORY_MAX = 1000;

export function getHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[]; }
  catch { return []; }
}

/** Prepend new entries (newest first). Caps at HISTORY_MAX. */
export function addHistoryEntries(entries: HistoryEntry[]): void {
  const merged = [...entries, ...getHistory()].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
