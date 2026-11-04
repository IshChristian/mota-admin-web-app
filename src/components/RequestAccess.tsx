import { ReactNode, useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { buttonClass, inputClass, secondaryButtonClass } from './RemoteTable';

type AccessRequest = { _id: string; permission: string; targetId?: string | null; status: string; expiresAt?: string };

// One shared copy of the signed-in staff member's own requests, so a table of
// guarded buttons makes one API call, not one per row.
let cache: { at: number; rows: AccessRequest[]; pending?: Promise<AccessRequest[]> } = { at: 0, rows: [] };
const listeners = new Set<() => void>();
async function loadMine(force = false): Promise<AccessRequest[]> {
  if (!force && Date.now() - cache.at < 30_000) return cache.rows;
  if (!cache.pending) {
    cache.pending = adminApi.accessRequests(true)
      .then((r) => { cache = { at: Date.now(), rows: r.data?.data || [] }; listeners.forEach((fn) => fn()); return cache.rows; })
      .catch(() => { cache.pending = undefined; return cache.rows; });
  }
  return cache.pending;
}
/** Call after using an approved action so the button goes back to "Request access". */
export const refreshAccessRequests = () => { cache.at = 0; return loadMine(true); };

function useMyRequests() {
  const [rows, setRows] = useState(cache.rows);
  useEffect(() => {
    const update = () => setRows(cache.rows);
    listeners.add(update);
    void loadMine();
    return () => { listeners.delete(update); };
  }, []);
  return rows;
}

/** True when the staff member holds `permission` or has a live approval for it on this record. */
export function useAllowed(permission: string, targetId?: string) {
  const { can } = useAuth();
  const rows = useMyRequests();
  return can(permission) || rows.some((r) => r.permission === permission && (r.targetId || null) === (targetId || null) && r.status === 'approved' && (!r.expiresAt || new Date(r.expiresAt) > new Date()));
}

/**
 * Shows `children` (the real action) when the staff member has `permission`,
 * or a superadmin approved a single-use request for it on this record.
 * Otherwise shows a "Request access" button that asks the superadmin.
 */
export function Guarded({ permission, targetType, targetId, label, children }: { permission: string; targetType?: string; targetId?: string; label: string; children: ReactNode }) {
  const { can } = useAuth();
  const rows = useMyRequests();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matching = rows.filter((r) => r.permission === permission && (r.targetId || null) === (targetId || null));
  const approved = matching.some((r) => r.status === 'approved' && (!r.expiresAt || new Date(r.expiresAt) > new Date()));
  const pending = matching.some((r) => r.status === 'pending');
  const send = useCallback(async () => {
    if (reason.trim().length < 5 || busy) return;
    setBusy(true); setError('');
    try { await adminApi.createAccessRequest({ permission, targetType, targetId, reason: reason.trim() }); await refreshAccessRequests(); setOpen(false); setReason(''); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not send the request.'); }
    finally { setBusy(false); }
  }, [busy, permission, reason, targetId, targetType]);

  if (can(permission) || approved) return <>{children}</>;
  if (pending) return <span className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400" title={`Waiting for the superadmin to approve ${permission}`}>Access requested</span>;
  return <>
    <button type="button" className={secondaryButtonClass} onClick={() => { setOpen(true); setError(''); }} title={`You need ${permission} for this`}>Request access: {label}</button>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => !busy && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="request-access-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 id="request-access-title" className="text-xl font-semibold">Request access</h3>
        <p className="mt-2 text-sm text-slate-400">The superadmin will be asked to let you <b>{label.toLowerCase()}</b> once{targetId ? ' for this record' : ''}. Approval is valid for 24 hours.</p>
        <p className="mt-1 text-xs text-slate-500"><code>{permission}</code></p>
        <label className="mt-4 block text-sm">Why do you need it?<textarea className={`${inputClass} mt-2 min-h-24`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked to close their duplicate account" /></label>
        {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className={buttonClass} disabled={busy || reason.trim().length < 5} onClick={() => void send()}>{busy ? 'Sending…' : 'Send request'}</button>
        </div>
      </div>
    </div> : null}
  </>;
}
