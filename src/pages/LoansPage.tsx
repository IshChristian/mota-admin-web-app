import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { ErrorBanner, PageHeader, RemoteTable, secondaryButtonClass } from '../components/RemoteTable';

type Loan = {_id:string; driverId:unknown; loanAmount:number; loanStatus:string; remainingBalance:number; createdAt:string};
const errorMessage = (error: unknown) => axios.isAxiosError(error) ? String(error.response?.data?.message || error.message) : 'Unexpected error';

export function LoansPage() {
  const [rows, setRows] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.loans();
      setRows(response.data.loans || []);
      setError('');
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const decide = async (id:string, action:'approve'|'reject') => {
    if (!window.confirm(`${action} this loan?`)) return;
    try { await adminApi.decideLoan(id, action); await load(); }
    catch (requestError) { setError(errorMessage(requestError)); }
  };
  return <section><PageHeader title="Loans" description="Review and decide real loan applications." />{error?<ErrorBanner message={error} retry={load}/>:null}<RemoteTable heads={['Loan','Driver','Amount','Balance','Status','Created','Actions']} loading={loading} empty={!rows.length}>{rows.map(row=><tr key={row._id} className="border-t border-white/5"><td className="py-4 pr-4">{row._id.slice(-8)}</td><td className="py-4 pr-4">{typeof row.driverId==='object'?JSON.stringify(row.driverId):String(row.driverId)}</td><td className="py-4 pr-4">{row.loanAmount}</td><td className="py-4 pr-4">{row.remainingBalance}</td><td className="py-4 pr-4">{row.loanStatus}</td><td className="py-4 pr-4">{new Date(row.createdAt).toLocaleDateString()}</td><td>{row.loanStatus==='pending'?<div className="flex gap-2"><button className={secondaryButtonClass} onClick={()=>decide(row._id,'approve')}>Approve</button><button className={secondaryButtonClass} onClick={()=>decide(row._id,'reject')}>Reject</button></div>:'—'}</td></tr>)}</RemoteTable></section>;
}
