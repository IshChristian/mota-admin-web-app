import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

type Request = { _id: string; driverId?: { _id: string; firstName: string; lastName: string; phone: string }; phone: string; amount: number; fee: number; totalHeld: number; status: string; reviewStatus?: string; reviewNote?: string; paypackRef?: string; failureReason?: string; createdAt: string };
const statuses = ['queued', 'processing', 'provider_pending', 'successful', 'failed'];
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
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const response = await adminApi.withdrawals(status); setRows(response.data?.data || []); setError(''); }
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
    <RemoteTable heads={['Driver', 'Payout phone', 'Requested', 'Amount', 'Reserved', 'Provider status', 'Staff review', 'Provider reference']} loading={loading} empty={!visibleRows.length}>
      {visibleRows.map(row => <tr key={row._id} className="border-t border-white/5">
        <td className="py-4 pr-4">{row.driverId?._id ? <><Link className="text-lime underline" to={`/drivers/${row.driverId._id}`}>{row.driverId.firstName} {row.driverId.lastName}</Link><span className="block text-xs text-slate-400">{row.driverId.phone}</span></> : 'Unknown driver'}</td>
        <td className="py-4 pr-4">{row.phone}</td><td className="py-4 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
        <td className="py-4 pr-4">{row.amount.toLocaleString()} RWF</td><td className="py-4 pr-4">{row.totalHeld.toLocaleString()} RWF</td>
        <td className="py-4 pr-4 capitalize" title={row.failureReason || ''}>{row.status.replaceAll('_', ' ')}</td>
        <td className="py-4 pr-4" title={row.reviewNote || ''}>{row.reviewStatus?.replaceAll('_', ' ') || 'new'}{can('transaction:sync') ? <button className="ml-2 text-lime underline" onClick={() => { setSelected(row); setReviewStatus(row.reviewStatus || 'in_review'); setReviewNote(row.reviewNote || ''); setError(''); }}>Update</button> : null}</td>
        <td className="py-4 pr-4">{row.paypackRef || '—'}</td>
      </tr>)}
    </RemoteTable>
    {selected ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="withdrawal-review-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"><h3 id="withdrawal-review-title" className="text-xl font-semibold">Review withdrawal</h3><p className="mt-2 text-sm text-slate-400">{selected.driverId?.firstName} {selected.driverId?.lastName} · {selected.amount.toLocaleString()} RWF</p><p className="mt-2 text-sm text-slate-400">Provider status: {selected.status.replaceAll('_', ' ')}. Staff review does not change payout settlement.</p><label className="mt-5 block text-sm">Review status<select className={`${inputClass} mt-2`} value={reviewStatus} onChange={e => setReviewStatus(e.target.value)}><option value="new">New</option><option value="in_review">In review</option><option value="resolved" disabled={!['successful', 'failed'].includes(selected.status)}>Resolved after provider result</option></select></label><label className="mt-4 block text-sm">Review note<textarea className={`${inputClass} mt-2 min-h-24`} value={reviewNote} onChange={e => setReviewNote(e.target.value)} maxLength={500} placeholder="Record what was checked or what needs follow-up" /></label>{error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}<div className="mt-6 flex justify-end gap-3"><button className={secondaryButtonClass} disabled={saving} onClick={() => { setSelected(null); setError(''); }}>Cancel</button><button className={buttonClass} disabled={saving || (reviewStatus !== 'new' && reviewNote.trim().length < 5)} onClick={() => void saveReview()}>{saving ? 'Saving…' : 'Save review'}</button></div></div></div> : null}
  </section>;
}
