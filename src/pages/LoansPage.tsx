import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, secondaryButtonClass } from '../components/RemoteTable';
import { DriverCell, money, StatusPill, when } from '../components/RecordCells';

type Person = { _id: string; firstName?: string; lastName?: string; phone?: string };
type Loan = { _id: string; driverId: Person | string | null; loanAmount: number; totalWithInterest?: number; interestRate?: number; loanStatus: string; remainingBalance: number; ticketNumber?: string; tinNumber?: string; dueDate?: string; createdAt: string };
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? String(error.response?.data?.message || error.message) : 'Unexpected error';
const STATUSES = ['', 'pending', 'active', 'overdue', 'successful', 'defaulted', 'rejected'] as const;
const LABEL: Record<string, string> = { '': 'All', pending: 'Pending', active: 'Repaying', overdue: 'Overdue', successful: 'Repaid', defaulted: 'Defaulted', rejected: 'Rejected' };

export function LoansPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Loan[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.loans(status || undefined);
      setRows(response.data.loans || []);
      setError('');
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (loan: Loan, action: 'approve' | 'reject') => {
    const text = action === 'approve'
      ? `Approve this loan? MOTA pays the fine (${money(loan.loanAmount)}) and the driver repays ${money(loan.totalWithInterest ?? loan.remainingBalance)}.`
      : 'Reject this loan request?';
    if (!window.confirm(text)) return;
    try { await adminApi.decideLoan(loan._id, action); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
  };
  return <section>
    <PageHeader title="Loans" description="Fine loans: approving one means MOTA pays the driver's approved fine; the driver repays from the wallet." action={<Link to="/fines" className={secondaryButtonClass}>Fine requests</Link>} />
    <div className="mb-4 flex flex-wrap gap-2">{STATUSES.map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? 'bg-lime font-semibold text-ink' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}>{LABEL[s]}</button>)}</div>
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    <RemoteTable heads={['Driver', 'Ticket', 'Loan', 'To repay', 'Balance', 'Status', 'Due', 'Requested', '']} loading={loading} empty={!rows.length}>
      {rows.map((row) => <tr key={row._id} className="border-t border-white/5 align-top">
        <td className="py-4 pr-4"><DriverCell person={row.driverId} /></td>
        <td className="py-4 pr-4"><div>{row.ticketNumber || '—'}</div>{row.tinNumber ? <div className="text-xs text-slate-500">TIN {row.tinNumber}</div> : null}</td>
        <td className="whitespace-nowrap py-4 pr-4">{money(row.loanAmount)}</td>
        <td className="whitespace-nowrap py-4 pr-4">{row.totalWithInterest != null ? money(row.totalWithInterest) : '—'}{row.interestRate != null ? <div className="text-xs text-slate-500">{row.interestRate}% interest</div> : null}</td>
        <td className="whitespace-nowrap py-4 pr-4">{money(row.remainingBalance)}</td>
        <td className="py-4 pr-4"><StatusPill status={row.loanStatus} label={LABEL[row.loanStatus]} /></td>
        <td className="whitespace-nowrap py-4 pr-4 text-slate-400">{row.dueDate ? when(row.dueDate, false) : '—'}</td>
        <td className="whitespace-nowrap py-4 pr-4 text-slate-400">{when(row.createdAt, false)}</td>
        <td className="py-4">{row.loanStatus === 'pending' && can('loan:approve') ? <div className="flex gap-2"><button className={secondaryButtonClass} onClick={() => decide(row, 'approve')}>Approve</button><button className={secondaryButtonClass} onClick={() => decide(row, 'reject')}>Reject</button></div> : null}</td>
      </tr>)}
    </RemoteTable>
  </section>;
}
