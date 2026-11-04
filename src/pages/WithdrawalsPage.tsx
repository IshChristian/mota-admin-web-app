import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

type Attempt = { at: string; kind: 'auto' | 'retry'; ok: boolean; paypackRef?: string; reason?: string };
type Request = { _id: string; driverId?: { _id: string; firstName: string; lastName: string; phone: string }; phone: string; amount: number; fee: number; totalHeld: number; status: string; reviewStatus?: string; reviewNote?: string; paypackRef?: string; failureReason?: string; createdAt: string; attempts?: Attempt[]; alertedAt?: string; manual?: { action: 'paid' | 'returned'; at: string; reference?: string; note?: string; by?: { firstName: string; lastName: string } } };
const statuses = ['manual_required', 'provider_pending', 'processing', 'queued', 'successful', 'failed'];
const csvCell = (value: unknown) => {
  const raw = String(value ?? '');
  const safe = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function WithdrawalsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Request[]>([]);
  const [status, setStatus] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Request | null>(null);
  const [reviewStatus, setReviewStatus] = useState('in_review');
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [handling, setHandling] = useState<Request | null>(null);
  const [waiting, setWaiting] = useState(0);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [response, manual] = await Promise.all([adminApi.withdrawals(status), adminApi.withdrawals('manual_required')]);
      setRows(response.data?.data || []); setWaiting((manual.data?.data || []).length); setError('');
    }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not load withdrawals.'); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const interval = window.setInterval(() => { void refresh(); }, 30000); return () => window.clearInterval(interval); }, [refresh]);
  const visibleRows = rows.filter(row => !reviewFilter || (row.reviewStatus || 'new') === reviewFilter);
  const download = () => {
    const columns = ['ID', 'Driver', 'Driver phone', 'Payout phone', 'Amount RWF', 'Fee RWF', 'Reserved RWF', 'Provider status', 'Review status', 'Review note', 'Paypack reference', 'Failure reason', 'Requested'];
    const contents = [columns, ...visibleRows.map(row => [row._id, `${row.driverId?.firstName || ''} ${row.driverId?.lastName || ''}`.trim(), row.driverId?.phone, row.phone, row.amount, row.fee, row.totalHeld, row.status, row.reviewStatus, row.reviewNote, row.paypackRef, row.failureReason, row.createdAt])].map(values => values.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'mota-withdrawals.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const saveReview = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try { await adminApi.reviewWithdrawal(selected._id, reviewStatus, reviewNote.trim()); setSelected(null); setError(''); await refresh(); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not save review.'); }
    finally { setSaving(false); }
  };
  return <section>
    <PageHeader title="Withdrawal requests" description="New requests refresh every 30 seconds. Review driver details and payout status; settlement follows Paypack confirmation." action={<button className={secondaryButtonClass} disabled={!visibleRows.length} onClick={download}>Download CSV</button>} />
    <div className="mb-4 flex flex-wrap items-center gap-3"><label htmlFor="withdrawal-status">Payout status</label><select id="withdrawal-status" className={inputClass} style={{ width: 220 }} value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><label htmlFor="review-status">Review status</label><select id="review-status" className={inputClass} style={{ width: 180 }} value={reviewFilter} onChange={event => setReviewFilter(event.target.value)}><option value="">All reviews</option><option value="new">New</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select><button className={secondaryButtonClass} onClick={() => void refresh()}>Refresh</button></div>
    {error && !selected ? <ErrorBanner message={error} retry={refresh} /> : null}
    {waiting ? <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-950/40 p-4"><p><b>{waiting} withdrawal{waiting === 1 ? '' : 's'} need{waiting === 1 ? 's' : ''} a manual payout.</b> <span className="text-sm text-slate-300">Paypack refused the automatic payout. The money is held until you pay it manually or return it to the wallet.</span></p><button className={secondaryButtonClass} onClick={() => setStatus('manual_required')}>Show them</button></div> : null}
    <RemoteTable heads={['Driver', 'Payout phone', 'Requested', 'Amount', 'Reserved', 'Provider status', 'Staff review', 'Provider reference']} loading={loading} empty={!visibleRows.length}>
      {visibleRows.map(row => <tr key={row._id} className="border-t border-white/5">
        <td className="py-4 pr-4">{row.driverId?._id ? <><Link className="text-lime underline" to={`/drivers/${row.driverId._id}`}>{row.driverId.firstName} {row.driverId.lastName}</Link><span className="block text-xs text-slate-400">{row.driverId.phone}</span></> : 'Unknown driver'}</td>
        <td className="py-4 pr-4">{row.phone}</td><td className="py-4 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
        <td className="py-4 pr-4">{row.amount.toLocaleString()} RWF</td><td className="py-4 pr-4">{row.totalHeld.toLocaleString()} RWF</td>
        <td className="py-4 pr-4 capitalize" title={row.failureReason || ''}>{row.status.replaceAll('_', ' ')}</td>
        <td className="py-4 pr-4" title={row.reviewNote || ''}>{row.reviewStatus?.replaceAll('_', ' ') || 'new'}{row.status === 'manual_required' && can('withdrawal:manage') ? <button className="ml-2 rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white" onClick={() => setHandling(row)}>Handle</button> : null}{can('withdrawal:manage') ? <button className="ml-2 text-lime underline" onClick={() => { setSelected(row); setReviewStatus(row.reviewStatus || 'in_review'); setReviewNote(row.reviewNote || ''); setError(''); }}>Update</button> : null}</td>
        <td className="py-4 pr-4">{row.paypackRef || '—'}</td>
      </tr>)}
    </RemoteTable>
    {selected ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="withdrawal-review-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"><h3 id="withdrawal-review-title" className="text-xl font-semibold">Review withdrawal</h3><p className="mt-2 text-sm text-slate-400">{selected.driverId?.firstName} {selected.driverId?.lastName} · {selected.amount.toLocaleString()} RWF</p><p className="mt-2 text-sm text-slate-400">Provider status: {selected.status.replaceAll('_', ' ')}. Staff review does not change payout settlement.</p><label className="mt-5 block text-sm">Review status<select className={`${inputClass} mt-2`} value={reviewStatus} onChange={e => setReviewStatus(e.target.value)}><option value="new">New</option><option value="in_review">In review</option><option value="resolved" disabled={!['successful', 'failed'].includes(selected.status)}>Resolved after provider result</option></select></label><label className="mt-4 block text-sm">Review note<textarea className={`${inputClass} mt-2 min-h-24`} value={reviewNote} onChange={e => setReviewNote(e.target.value)} maxLength={500} placeholder="Record what was checked or what needs follow-up" /></label>{error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}<div className="mt-6 flex justify-end gap-3"><button className={secondaryButtonClass} disabled={saving} onClick={() => { setSelected(null); setError(''); }}>Cancel</button><button className={buttonClass} disabled={saving || (reviewStatus !== 'new' && reviewNote.trim().length < 5)} onClick={() => void saveReview()}>{saving ? 'Saving…' : 'Save review'}</button></div></div></div> : null}
    {handling ? <ManualPayoutDialog request={handling} onClose={() => setHandling(null)} onDone={async () => { setHandling(null); await refresh(); }} /> : null}
  </section>;
}

/** Pay a refused withdrawal manually, return it to the wallet, or retry Paypack. Every step is recorded. */
function ManualPayoutDialog({ request, onClose, onDone }: { request: Request; onClose: () => void; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'paid' | 'return'>('paid');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); await onDone(); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not update this withdrawal.'); }
    finally { setBusy(false); }
  };
  const valid = mode === 'paid' ? reference.trim().length >= 3 : note.trim().length >= 5;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="manual-payout-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl">
      <h3 id="manual-payout-title" className="text-xl font-semibold">Manual payout needed</h3>
      <p className="mt-2 text-sm text-slate-300">{request.driverId?.firstName} {request.driverId?.lastName} · user {request.driverId?._id} · pay <b>{request.amount.toLocaleString()} RWF</b> to <b>{request.phone}</b>. Held: {request.totalHeld.toLocaleString()} RWF (fee {request.fee.toLocaleString()} RWF).</p>
      <h4 className="mt-5 text-sm font-semibold text-slate-300">Paypack attempts</h4>
      <ol className="mt-2 space-y-2 text-sm">{(request.attempts || []).map((a, i) => <li key={i} className="rounded-lg border border-white/10 p-3"><span className={a.ok ? 'text-lime' : 'text-red-300'}>{a.ok ? 'Accepted' : 'Refused'}</span> · {a.kind === 'retry' ? 'retry' : 'automatic'} · {new Date(a.at).toLocaleString()}{a.reason ? <span className="block text-slate-400">{a.reason}</span> : null}</li>)}</ol>
      {request.alertedAt ? <p className="mt-2 text-xs text-slate-500">Staff alerted {new Date(request.alertedAt).toLocaleString()}</p> : null}
      <div className="mt-5 flex gap-2" role="tablist">
        <button role="tab" aria-selected={mode === 'paid'} className={mode === 'paid' ? buttonClass : secondaryButtonClass} onClick={() => setMode('paid')}>I paid it manually</button>
        <button role="tab" aria-selected={mode === 'return'} className={mode === 'return' ? buttonClass : secondaryButtonClass} onClick={() => setMode('return')}>Return to wallet</button>
      </div>
      {mode === 'paid'
        ? <label className="mt-4 block text-sm">MoMo reference<input className={`${inputClass} mt-2`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID from the MoMo receipt" /></label>
        : <p className="mt-4 text-sm text-slate-400">The held {request.totalHeld.toLocaleString()} RWF goes back to the user's wallet and they are notified.</p>}
      <label className="mt-4 block text-sm">Note{mode === 'return' ? ' (required)' : ' (optional)'}<textarea className={`${inputClass} mt-2 min-h-20`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button className={secondaryButtonClass} disabled={busy} onClick={() => void run(() => adminApi.retryWithdrawal(request._id))}>Retry automatic payout</button>
        <div className="flex gap-3">
          <button className={secondaryButtonClass} disabled={busy} onClick={onClose}>Cancel</button>
          <button className={buttonClass} disabled={busy || !valid} onClick={() => void run(() => mode === 'paid' ? adminApi.manualPaidWithdrawal(request._id, reference.trim(), note.trim()) : adminApi.returnWithdrawal(request._id, note.trim()))}>{busy ? 'Saving…' : mode === 'paid' ? 'Mark as paid' : 'Return the money'}</button>
        </div>
      </div>
    </div>
  </div>;
}
