import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, secondaryButtonClass } from '../components/RemoteTable';
import { DriverCell, money, StatusPill, when } from '../components/RecordCells';

type Person = { _id: string; firstName?: string; lastName?: string; phone?: string };
type Fine = { _id: string; fineId: string; driverId: Person | string | null; amount: number; reason?: string; reviewNotes?: string; status: string; createdAt: string };
const errorMessage = (e: unknown) => axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : 'Unexpected error';
const STATUSES = ['', 'pending', 'under_review', 'approved', 'rejected'] as const;
const LABEL: Record<string, string> = { '': 'All', pending: 'Pending', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' };

export function FinesPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Fine[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await adminApi.fines(status || undefined); setRows(response.data.requests || []); setError(''); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const action = async (item: Fine, type: 'review' | 'approve' | 'reject') => {
    let note = '';
    if (type === 'reject') { note = window.prompt('Rejection reason (sent to the driver by SMS)') || ''; if (!note) return; }
    if (type === 'approve') { const answer = window.prompt(`Approve fine ${item.fineId} for ${money(item.amount)}? Optional note:`); if (answer === null) return; note = answer; }
    try {
      if (type === 'review') await adminApi.reviewFine(item._id);
      if (type === 'approve') await adminApi.approveFine(item._id, note);
      if (type === 'reject') await adminApi.rejectFine(item._id, note);
      await load();
    } catch (e) { setError(errorMessage(e)); }
  };
  const canDecide = can('fines:update');
  return <section>
    <PageHeader title="Fine requests" description="Check the ticket against the traffic fine record, then approve it. Once approved, the driver can request a loan for it." action={<Link to="/loans" className={secondaryButtonClass}>Loans</Link>} />
    <div className="mb-4 flex flex-wrap gap-2">{STATUSES.map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? 'bg-lime font-semibold text-ink' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}>{LABEL[s]}</button>)}</div>
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    <RemoteTable heads={['Ticket', 'Driver', 'Amount', 'Details', 'Status', 'Submitted', '']} loading={loading} empty={!rows.length}>
      {rows.map((item) => <tr key={item._id} className="border-t border-white/5 align-top">
        <td className="whitespace-nowrap py-4 pr-4 font-medium">{item.fineId}</td>
        <td className="py-4 pr-4"><DriverCell person={item.driverId} /></td>
        <td className="whitespace-nowrap py-4 pr-4">{money(item.amount)}</td>
        <td className="max-w-xs py-4 pr-4 text-slate-300"><div className="line-clamp-2" title={item.reason}>{item.reason || '—'}</div>{item.reviewNotes ? <div className="mt-1 text-xs text-slate-500">Note: {item.reviewNotes}</div> : null}</td>
        <td className="py-4 pr-4"><StatusPill status={item.status} label={LABEL[item.status]} /></td>
        <td className="whitespace-nowrap py-4 pr-4 text-slate-400">{when(item.createdAt, false)}</td>
        <td className="py-4">{canDecide && ['pending', 'under_review'].includes(item.status) ? <div className="flex gap-2">{item.status === 'pending' ? <button className={secondaryButtonClass} onClick={() => action(item, 'review')}>Start review</button> : null}<button className={secondaryButtonClass} onClick={() => action(item, 'approve')}>Approve</button><button className={secondaryButtonClass} onClick={() => action(item, 'reject')}>Reject</button></div> : null}</td>
      </tr>)}
    </RemoteTable>
  </section>;
}
