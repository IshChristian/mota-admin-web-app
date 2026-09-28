import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

type Decision = 'approved' | 'correction' | 'rejected';
type Record = { _id: string; userId?: { firstName?: string; lastName?: string; phone?: string }; status: string; remarks?: string; nationalIdFront?: string; nationalIdBack?: string; selfie?: string; drivingLicenseDocument?: string; transportPermitDocument?: string; insuranceDocument?: string; vehicleRegistrationDocument?: string; technicalInspectionDocument?: string; vocationalCardDocument?: string; submittedAt?: string; vehicleType?: string; powertrain?: string; plateNumber?: string };
const message = (e: unknown) => axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : 'Unexpected error';

export function KycPage() {
  const [type, setType] = useState<'driver' | 'passenger'>('driver');
  const [status, setStatus] = useState('submitted');
  const [rows, setRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<{ row: Record; next: Decision } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await adminApi.kycRecords(type, status || undefined); setRows(response.data.data || []); setError(''); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, [type, status]);
  useEffect(() => { void load(); }, [load]);
  const open = (row: Record, next: Decision) => { setDecision({ row, next }); setRemarks(''); setError(''); };
  const review = async () => {
    if (!decision || saving) return;
    if (decision.next !== 'approved' && remarks.trim().length < 5) { setError('Enter a reason of at least 5 characters.'); return; }
    setSaving(true); setError('');
    try { await adminApi.reviewKyc(type, decision.row._id, decision.next, remarks.trim()); setDecision(null); await load(); }
    catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  };
  return <section>
    <PageHeader title="KYC review" description="Review shared identity documents and driver operating documents." />
    <div className="mb-5 flex flex-wrap gap-3"><select aria-label="Account type" className={inputClass} style={{width:180}} value={type} onChange={e => setType(e.target.value as typeof type)}><option className="bg-ink" value="driver">Driver KYC</option><option className="bg-ink" value="passenger">Passenger KYC</option></select><select aria-label="Review status" className={inputClass} style={{width:180}} value={status} onChange={e => setStatus(e.target.value)}><option className="bg-ink" value="">All statuses</option>{['submitted','approved','correction','rejected'].map(value => <option className="bg-ink" key={value}>{value}</option>)}</select></div>
    {error && !decision ? <ErrorBanner message={error} retry={load} /> : null}
    <RemoteTable heads={['Person','Phone','Vehicle','Status','Submitted','Documents','Actions']} loading={loading} empty={!rows.length}>
      {rows.map(row => {
        const links: [string,string|undefined][] = [['ID front',row.nationalIdFront],['ID back',row.nationalIdBack],['Selfie',row.selfie],...(type === 'driver' ? [['Driving licence',row.drivingLicenseDocument],['Transport permit',row.transportPermitDocument],['Insurance',row.insuranceDocument],['Vehicle registration',row.vehicleRegistrationDocument],['Technical inspection',row.technicalInspectionDocument],['Vocational card',row.vocationalCardDocument]] as [string,string|undefined][] : [])];
        return <tr key={row._id} className="border-t border-white/5"><td className="py-4 pr-4">{row.userId?.firstName} {row.userId?.lastName}</td><td className="py-4 pr-4">{row.userId?.phone || '—'}</td><td className="py-4 pr-4 capitalize">{type === 'driver' ? `${row.vehicleType || '—'} ${row.plateNumber || ''} · ${row.powertrain || '—'}` : '—'}</td><td className="py-4 pr-4 capitalize" title={row.remarks || ''}>{row.status}</td><td className="py-4 pr-4">{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td><td className="py-4 pr-4"><div className="flex flex-wrap gap-2">{links.filter(([,url]) => Boolean(url)).map(([label,url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="text-lime underline">{label}</a>)}</div></td><td className="py-4"><div className="flex flex-wrap gap-2">{(['approved','correction','rejected'] as const).map(next => <button key={next} className={secondaryButtonClass} onClick={() => open(row,next)}>{next === 'approved' ? 'Approve' : next === 'correction' ? 'Correction' : 'Reject'}</button>)}</div></td></tr>;
      })}
    </RemoteTable>
    {decision ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div role="dialog" aria-modal="true" aria-labelledby="kyc-decision-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"><h3 id="kyc-decision-title" className="text-xl font-semibold capitalize">{decision.next === 'correction' ? 'Request correction' : decision.next} KYC</h3><p className="mt-2 text-sm text-slate-400">{decision.row.userId?.firstName} {decision.row.userId?.lastName} · {type} account</p>{decision.next === 'approved' ? <p className="mt-4 text-sm text-slate-300">Confirm that you reviewed all required identity and document files.</p> : <label className="mt-4 block text-sm">Reason for {decision.next}<textarea className={`${inputClass} mt-2 min-h-28`} value={remarks} onChange={e => setRemarks(e.target.value)} maxLength={500} placeholder="Explain what must be corrected" /></label>}{error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}<div className="mt-6 flex justify-end gap-3"><button className={secondaryButtonClass} disabled={saving} onClick={() => { setDecision(null); setError(''); }}>Cancel</button><button className={buttonClass} disabled={saving || (decision.next !== 'approved' && remarks.trim().length < 5)} onClick={() => void review()}>{saving ? 'Saving…' : 'Confirm decision'}</button></div></div></div> : null}
  </section>;
}
