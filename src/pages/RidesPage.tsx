import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, secondaryButtonClass } from '../components/RemoteTable';

type Ride = {_id:string;passengerId?:{firstName:string;lastName:string};driverId?:{firstName:string;lastName:string};rideStatus:string;fare?:number;paymentStatus?:string;createdAt:string};
const message = (error:unknown) => axios.isAxiosError(error) ? String(error.response?.data?.message || error.message) : 'Unexpected error';

export function RidesPage() {
  const {can} = useAuth();
  const [rows,setRows] = useState<Ride[]>([]);
  const [page,setPage] = useState(1);
  const [pages,setPages] = useState(1);
  const [status,setStatus] = useState('');
  const [loading,setLoading] = useState(true);
  const [busyId,setBusyId] = useState('');
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.rides({page,limit:50,...(status?{status}:{})});
      setRows(response.data.data || []);
      setPages(response.data.pagination?.pages || 1);
      setError('');
    } catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  },[page,status]);
  useEffect(() => { void load(); },[load]);
  const cancel = async (ride:Ride) => {
    const reason = window.prompt('Cancellation reason (at least 5 characters)');
    if (reason === null) return;
    if (reason.trim().length < 5) { setError('Enter a cancellation reason of at least 5 characters.'); return; }
    if (!window.confirm(`Cancel ride ${ride._id.slice(-8)}?`)) return;
    setBusyId(ride._id); setError(''); setSuccess('');
    try { await adminApi.cancelRide(ride._id,reason.trim()); setSuccess(`Ride ${ride._id.slice(-8)} cancelled.`); await load(); }
    catch (e) { setError(message(e)); }
    finally { setBusyId(''); }
  };
  return <section>
    <PageHeader title="Rides" description="System-wide ride records and authorized cancellation controls."/>
    {error?<ErrorBanner message={error} retry={load}/>:null}
    {success?<p role="status" className="mb-4 rounded-xl border border-lime/30 bg-lime/10 p-4 text-sm text-lime">{success}</p>:null}
    <label className="mb-4 block text-sm">Ride status <select className="ml-2 rounded-lg border border-white/20 bg-panel px-3 py-2" value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">All</option>{['requested','searching','accepted','in_progress','completed','cancelled','expired'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    <RemoteTable heads={['Ride','Passenger','Driver','Status','Payment','Fare','Created','Action']} loading={loading} empty={!rows.length}>{rows.map(ride=><tr key={ride._id} className="border-t border-white/5"><td className="py-4 pr-4">{ride._id.slice(-8)}</td><td className="py-4 pr-4">{ride.passengerId?`${ride.passengerId.firstName} ${ride.passengerId.lastName}`:'—'}</td><td className="py-4 pr-4">{ride.driverId?`${ride.driverId.firstName} ${ride.driverId.lastName}`:'—'}</td><td className="py-4 pr-4">{ride.rideStatus}</td><td className="py-4 pr-4">{ride.paymentStatus||'—'}</td><td className="py-4 pr-4">{ride.fare??'—'}</td><td className="py-4 pr-4">{new Date(ride.createdAt).toLocaleString()}</td><td>{can('ride:cancel')&&!['completed','cancelled','expired'].includes(ride.rideStatus)?<button disabled={busyId===ride._id} className={secondaryButtonClass} onClick={()=>void cancel(ride)}>{busyId===ride._id?'Cancelling…':'Cancel'}</button>:'—'}</td></tr>)}</RemoteTable>
    <div className="mt-4 flex items-center justify-end gap-3 text-sm"><button className={secondaryButtonClass} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {pages}</span><button className={secondaryButtonClass} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button></div>
  </section>;
}
