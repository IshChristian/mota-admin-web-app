import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { ErrorBanner, PageHeader, RemoteTable, inputClass, secondaryButtonClass } from '../components/RemoteTable';

type Request = { _id: string; driverId?: { _id: string; firstName: string; lastName: string; phone: string }; phone: string; amount: number; fee: number; totalHeld: number; status: string; paypackRef?: string; failureReason?: string; createdAt: string };
const statuses = ['queued', 'processing', 'provider_pending', 'successful', 'failed'];
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function WithdrawalsPage() {
  const [rows, setRows] = useState<Request[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const response = await adminApi.withdrawals(status); setRows(response.data?.data || []); setError(''); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not load withdrawals.'); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void refresh(); }, [refresh]);
  const download = () => {
    const columns = ['ID', 'Driver', 'Driver phone', 'Payout phone', 'Amount RWF', 'Fee RWF', 'Reserved RWF', 'Status', 'Paypack reference', 'Failure reason', 'Requested'];
    const contents = [columns, ...rows.map(row => [row._id, `${row.driverId?.firstName || ''} ${row.driverId?.lastName || ''}`.trim(), row.driverId?.phone, row.phone, row.amount, row.fee, row.totalHeld, row.status, row.paypackRef, row.failureReason, row.createdAt])].map(values => values.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'mota-withdrawals.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section>
    <PageHeader title="Withdrawal requests" description="View each driver payout, its reserved amount and provider status. Settlement status follows Paypack confirmation." action={<button className={secondaryButtonClass} disabled={!rows.length} onClick={download}>Download CSV</button>} />
    <div className="mb-4 flex items-center gap-3"><label htmlFor="withdrawal-status">Status</label><select id="withdrawal-status" className={inputClass} style={{ width: 220 }} value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><button className={secondaryButtonClass} onClick={() => void refresh()}>Refresh</button></div>
    {error ? <ErrorBanner message={error} retry={refresh} /> : null}
    <RemoteTable heads={['Driver', 'Payout phone', 'Requested', 'Amount', 'Reserved', 'Status', 'Provider reference']} loading={loading} empty={!rows.length}>
      {rows.map(row => <tr key={row._id} className="border-t border-white/5">
        <td className="py-4 pr-4">{row.driverId?._id ? <Link className="text-lime underline" to={`/drivers/${row.driverId._id}`}>{row.driverId.firstName} {row.driverId.lastName}</Link> : 'Unknown driver'}</td>
        <td className="py-4 pr-4">{row.phone}</td><td className="py-4 pr-4">{new Date(row.createdAt).toLocaleString()}</td>
        <td className="py-4 pr-4">{row.amount.toLocaleString()} RWF</td><td className="py-4 pr-4">{row.totalHeld.toLocaleString()} RWF</td>
        <td className="py-4 pr-4 capitalize" title={row.failureReason || ''}>{row.status.replaceAll('_', ' ')}</td><td className="py-4 pr-4">{row.paypackRef || '—'}</td>
      </tr>)}
    </RemoteTable>
  </section>;
}
