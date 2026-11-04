import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

type AccessRequest = {
  _id: string; permission: string; targetType?: string; targetId?: string | null; reason: string; status: string;
  requesterId?: { _id: string; firstName: string; lastName: string; role: string };
  decidedBy?: { firstName: string; lastName: string }; decidedAt?: string; decisionNote?: string; expiresAt?: string; usedAt?: string; createdAt: string;
};
const targetLink = (r: AccessRequest) => r.targetType === 'User' && r.targetId ? <Link className="text-lime underline" to={`/users/${r.targetId}`}>{r.targetId}</Link> : r.targetId || 'Any record';

/** Superadmin: approve or decline staff requests for one action on one record. */
export function AccessRequestsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | ''>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState<{ row: AccessRequest; decision: 'approve' | 'decline' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const r = await adminApi.accessRequests(false, filter || undefined); setRows(r.data?.data || []); setError(''); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not load access requests.'); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const t = window.setInterval(() => { void refresh(); }, 30000); return () => window.clearInterval(t); }, [refresh]);
  if (!can('access_request:approve')) return <div role="alert" className="rounded-2xl border border-white/10 p-5">Only the superadmin decides access requests.</div>;
  const decide = async () => {
    if (!deciding || busy) return;
    setBusy(true);
    try { await adminApi.decideAccessRequest(deciding.row._id, deciding.decision, note.trim()); setDeciding(null); setNote(''); await refresh(); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not save the decision.'); setDeciding(null); }
    finally { setBusy(false); }
  };
  return <section>
    <PageHeader title="Access requests" description="Staff ask for one action on one record. An approval works once, within 24 hours. Every request and decision is in the audit trail." />
    <div className="mb-4 flex gap-2">
      <button className={filter === 'pending' ? buttonClass : secondaryButtonClass} onClick={() => setFilter('pending')}>Waiting</button>
      <button className={filter === '' ? buttonClass : secondaryButtonClass} onClick={() => setFilter('')}>All</button>
    </div>
    {error ? <ErrorBanner message={error} retry={refresh} /> : null}
    <RemoteTable heads={['Staff member', 'Wants to', 'Record', 'Reason', 'Asked', 'Status', '']} loading={loading} empty={!rows.length}>
      {rows.map((r) => <tr key={r._id} className="border-t border-white/5 align-top">
        <td className="py-4 pr-4">{r.requesterId ? <>{r.requesterId.firstName} {r.requesterId.lastName}<span className="block text-xs text-slate-400">{r.requesterId.role}</span></> : '—'}</td>
        <td className="py-4 pr-4"><code className="text-xs">{r.permission}</code></td>
        <td className="py-4 pr-4 text-xs">{r.targetType ? <span className="block text-slate-400">{r.targetType}</span> : null}{targetLink(r)}</td>
        <td className="max-w-xs py-4 pr-4 text-sm">{r.reason}</td>
        <td className="py-4 pr-4 text-xs">{new Date(r.createdAt).toLocaleString()}</td>
        <td className="py-4 pr-4 text-sm capitalize">{r.status}{r.decidedBy ? <span className="block text-xs text-slate-400">by {r.decidedBy.firstName} {r.decidedBy.lastName}{r.decisionNote ? `: ${r.decisionNote}` : ''}</span> : null}{r.usedAt ? <span className="block text-xs text-slate-400">used {new Date(r.usedAt).toLocaleString()}</span> : null}</td>
        <td className="py-4 pr-4">{r.status === 'pending' ? <div className="flex gap-2"><button className={buttonClass} onClick={() => { setDeciding({ row: r, decision: 'approve' }); setNote(''); }}>Approve</button><button className={secondaryButtonClass} onClick={() => { setDeciding({ row: r, decision: 'decline' }); setNote(''); }}>Decline</button></div> : null}</td>
      </tr>)}
    </RemoteTable>
    {deciding ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="decide-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl">
      <h3 id="decide-title" className="text-xl font-semibold">{deciding.decision === 'approve' ? 'Approve request' : 'Decline request'}</h3>
      <p className="mt-2 text-sm text-slate-400">{deciding.row.requesterId?.firstName} wants <code>{deciding.row.permission}</code>{deciding.row.targetId ? ` on ${deciding.row.targetType || 'record'} ${deciding.row.targetId}` : ''}. {deciding.decision === 'approve' ? 'They can do it once, within 24 hours.' : ''}</p>
      <label className="mt-4 block text-sm">Note (optional)<textarea className={`${inputClass} mt-2 min-h-20`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="mt-5 flex justify-end gap-3"><button className={secondaryButtonClass} disabled={busy} onClick={() => setDeciding(null)}>Cancel</button><button className={buttonClass} disabled={busy} onClick={() => void decide()}>{busy ? 'Saving…' : deciding.decision === 'approve' ? 'Approve' : 'Decline'}</button></div>
    </div></div> : null}
  </section>;
}
