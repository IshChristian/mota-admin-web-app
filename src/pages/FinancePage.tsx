// Transactions: MOTA's own ledger (every wallet movement, commission, loan,
// voucher…) and, on a second tab, the raw Paypack provider records.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { adminApi, ledgerApi } from '../api';
import { LiveListPage } from '../components/LiveListPage';
import { ErrorBanner, PageHeader, RemoteTable, inputClass, secondaryButtonClass } from '../components/RemoteTable';
import { DriverCell, money, StatusPill, when } from '../components/RecordCells';

type Person = { _id: string; firstName?: string; lastName?: string; phone?: string; role?: string };
type Entry = { _id: string; driverId: Person | null; amount: number; feeAmount?: number; type: string; status: string; reference?: string; description?: string; createdAt: string };
type Total = { _id: string; count: number; amount: number; fees: number };

export const TYPE_LABEL: Record<string, string> = {
  ride_payment: 'Ride payment', platform_commission: 'Commission', commission: 'Commission', cash_in: 'Wallet top-up', cash_out: 'Withdrawal', cash_out_fee: 'Withdrawal fee',
  cash_out_refund: 'Withdrawal refund', agent_cash_in: 'Agent deposit', fine_payment: 'Fine payment', fine_loan_issued: 'Loan issued', fine_loan_repayment: 'Loan repayment',
  referral_reward: 'Referral reward', admin_credit: 'Admin credit', admin_debit: 'Admin debit', agent_registration_fee: 'Agent registration fee', agent_pay_fine: 'Agent fine payment',
  transaction_fee: 'Transaction fee', p2p_transfer_sent: 'Transfer sent', p2p_transfer_received: 'Transfer received', p2p_transfer_fee: 'Transfer fee', tip: 'Tip', fuel_voucher: 'Fuel support',
};
const ROLE: Record<string, string> = { client: 'Passenger', driver: 'Driver', agent: 'Agent' };
// Stored amounts don't use one sign convention (repayments are positive, withdrawals negative),
// so the direction comes from the type: money leaving the person's wallet, or a loan MOTA paid out directly.
const OUT = new Set(['cash_out', 'cash_out_fee', 'fine_loan_repayment', 'fine_payment', 'p2p_transfer_sent', 'p2p_transfer_fee', 'transaction_fee', 'admin_debit', 'agent_registration_fee', 'agent_pay_fine']);
const NEUTRAL = new Set(['fine_loan_issued', 'platform_commission', 'commission']);
const direction = (r: Entry) => NEUTRAL.has(r.type) ? 'neutral' : OUT.has(r.type) || r.amount < 0 ? 'out' : 'in';

export function FinancePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'paypack' ? 'paypack' : 'ledger';
  return <section>
    <PageHeader title="Transactions" description="Every money movement on MOTA. Amounts are from the person’s point of view: + into their wallet, − out of it." />
    <div role="tablist" className="mb-5 flex gap-2">{[['ledger', 'MOTA ledger'], ['paypack', 'Paypack provider records']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })} className={`rounded-xl px-4 py-2 text-sm ${tab === key ? 'bg-lime font-semibold text-ink' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}>{label}</button>)}</div>
    {tab === 'ledger' ? <Ledger /> : <LiveListPage title="Paypack records" description="Raw MoMo collections and payouts from the provider. Use “Sync pending” if a payment looks stuck." load={() => adminApi.transactions({ limit: 100 })} action={{ label: 'Sync pending', run: () => adminApi.syncTransactions() }} columns={[{ key: 'ref', label: 'Reference' }, { key: 'client', label: 'Client' }, { key: 'kind', label: 'Type' }, { key: 'amount', label: 'Amount' }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Created' }]} />}
  </section>;
}

function Ledger() {
  const [filters, setFilters] = useState({ type: '', status: '', q: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Total[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await ledgerApi.list({ ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), ...(applied.to ? { to: `${applied.to}T23:59:59` } : {}), page });
      setRows(r.data.data || []); setTotals(r.data.totals || []); setPages(r.data.pagination?.pages || 1); setTotal(r.data.pagination?.total || 0);
    } catch (e) { setError(axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : 'Unexpected error'); }
    finally { setLoading(false); }
  }, [applied, page]);
  useEffect(() => { void load(); }, [load]);
  const commission = totals.filter((t) => ['platform_commission', 'commission'].includes(t._id)).reduce((s, t) => s + Math.abs(t.amount), 0) + totals.reduce((s, t) => s + (t._id === 'ride_payment' ? t.fees : 0), 0);
  const topUps = totals.find((t) => t._id === 'cash_in');
  const withdrawals = totals.find((t) => t._id === 'cash_out');
  const loans = totals.find((t) => t._id === 'fine_loan_issued');
  return <>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="MOTA commission" value={money(commission)} hint="from ride fares" />
      <Tile label="Wallet top-ups" value={money(topUps?.amount || 0)} hint={`${topUps?.count || 0} successful`} />
      <Tile label="Withdrawals" value={money(Math.abs(withdrawals?.amount || 0))} hint={`${withdrawals?.count || 0} successful`} />
      <Tile label="Loans issued" value={money(loans?.amount || 0)} hint={`${loans?.count || 0} loans`} />
    </div>
    <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }} className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-panel p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
      <input type="search" placeholder="Name, phone or reference" className={inputClass} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search" />
      <select className={inputClass} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} aria-label="Type"><option value="">All types</option>{Object.entries(TYPE_LABEL).filter(([k]) => k !== 'commission').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="Status"><option value="">All statuses</option><option value="successful">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
      <input type="date" className={inputClass} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="From date" />
      <input type="date" className={inputClass} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="To date" />
      <button className={secondaryButtonClass}>Apply</button>
    </form>
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    <RemoteTable heads={['When', 'Person', 'Type', 'Amount', 'Fee', 'Status', 'Details']} loading={loading} empty={!rows.length}>
      {rows.map((r) => <tr key={r._id} className="border-t border-white/5 align-top">
        <td className="whitespace-nowrap py-3 pr-4 text-slate-400">{when(r.createdAt)}</td>
        <td className="py-3 pr-4"><DriverCell person={r.driverId} to={r.driverId && typeof r.driverId === 'object' && r.driverId.role === 'driver' ? 'drivers' : 'users'} />{r.driverId && typeof r.driverId === 'object' && r.driverId.role ? <div className="text-[11px] text-slate-500">{ROLE[r.driverId.role] || r.driverId.role}</div> : null}</td>
        <td className="whitespace-nowrap py-3 pr-4">{TYPE_LABEL[r.type] || r.type}</td>
        <td className={`whitespace-nowrap py-3 pr-4 font-medium ${direction(r) === 'out' ? 'text-red-300' : direction(r) === 'in' ? 'text-emerald-300' : 'text-slate-200'}`}>{direction(r) === 'out' ? '−' : direction(r) === 'in' ? '+' : ''}{money(Math.abs(r.amount))}{r.type === 'fine_loan_issued' ? <div className="text-[11px] font-normal text-slate-500">paid to the fine</div> : null}</td>
        <td className="whitespace-nowrap py-3 pr-4 text-slate-400">{r.feeAmount ? money(r.feeAmount) : '—'}</td>
        <td className="py-3 pr-4"><StatusPill status={r.status} label={r.status} /></td>
        <td className="max-w-xs py-3 pr-4 text-slate-400"><div className="line-clamp-2" title={r.description}>{r.description || '—'}</div>{r.reference ? <div className="font-mono text-[11px] text-slate-500">{r.reference}</div> : null}</td>
      </tr>)}
    </RemoteTable>
    <div className="mt-4 flex items-center justify-end gap-3 text-sm"><span className="text-slate-400">{total.toLocaleString()} records · page {page} of {pages}</span><button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className={secondaryButtonClass} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
  </>;
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-2xl border border-white/10 bg-panel p-5"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></div>;
}
