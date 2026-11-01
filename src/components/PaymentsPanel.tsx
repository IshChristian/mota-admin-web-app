import { useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { buttonClass, inputClass, secondaryButtonClass } from './RemoteTable';

type Item = Record<string, any>;
// Resolves to the dialog values when confirmed, or null when cancelled.
type Ask = (o: { title: string; description: string; confirm: string }) => Promise<unknown>;
const STATUSES = ['pending', 'successful', 'failed'] as const;
const messageOf = (e: unknown) => (axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : e instanceof Error ? e.message : 'Unexpected error');
const tone = (s: string) => (s === 'successful' || s === 'cash_collected' ? 'text-lime' : s === 'failed' ? 'text-red-300' : 'text-amber-300');

/**
 * Payment status corrections for one user: the driver registration fee and the
 * payment status of their finished rides. Status only — no money moves here.
 */
export function PaymentsPanel({ user, rides, can, ask, onSaved, onError, onSuccess }: {
  user: Item; rides: Item[]; can: (p: string) => boolean; ask: Ask;
  onSaved: () => void; onError: (m: string) => void; onSuccess: (m: string) => void;
}) {
  const [regReason, setRegReason] = useState('');
  const [busy, setBusy] = useState('');
  const [edits, setEdits] = useState<Record<string, { status: string; reason: string }>>({});
  const finished = rides.filter((r) => ['awaiting_payment', 'completed', 'cancelled'].includes(String(r.rideStatus)));

  const saveRegistration = async (paid: boolean) => {
    if (regReason.trim().length < 5) { onError('Give a reason of at least 5 characters.'); return; }
    if (!await ask({ title: paid ? 'Mark registration fee as paid?' : 'Mark registration fee as unpaid?', description: `${user.firstName} ${user.lastName}. No money moves; this changes the status and is audit-logged.`, confirm: paid ? 'Mark paid' : 'Mark unpaid' })) return;
    setBusy('registration');
    try { const r = await adminApi.setRegistrationPayment(String(user._id), paid, regReason.trim()); onSuccess(r.data.message); setRegReason(''); onSaved(); }
    catch (e) { onError(messageOf(e)); }
    finally { setBusy(''); }
  };

  const saveRide = async (ride: Item) => {
    const edit = edits[String(ride._id)];
    if (!edit || edit.status === ride.paymentStatus) return;
    if (edit.reason.trim().length < 5) { onError('Give a reason of at least 5 characters.'); return; }
    if (!await ask({ title: `Change ride payment to "${edit.status}"?`, description: `Ride ${String(ride._id).slice(-6)} · ${Number(ride.fare || 0).toLocaleString()} RWF · ${ride.paymentMethod || 'unknown method'}. No money moves.`, confirm: 'Save status' })) return;
    setBusy(String(ride._id));
    try {
      const r = await adminApi.setRidePayment(String(ride._id), edit.status as any, edit.reason.trim());
      onSuccess([r.data.message, ...(r.data.warnings || [])].join(' '));
      setEdits((all) => { const next = { ...all }; delete next[String(ride._id)]; return next; });
      onSaved();
    } catch (e) { onError(messageOf(e)); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">Corrections change payment <b>status</b> only and are written to the audit log. To move money, use the wallet adjustment on the Overview tab.</p>
      {user.role === 'driver' ? (
        <div className="rounded-2xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold">Registration fee</h3>
          <p className="mt-1 text-sm">Status: <span className={user.registrationPaid ? 'text-lime' : 'text-amber-300'}>{user.registrationPaid ? 'Paid' : 'Not paid'}</span>{user.registrationPaypackRef ? <span className="text-slate-400"> · Paypack ref {String(user.registrationPaypackRef)}</span> : null}</p>
          {can('registration:review') ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input className={inputClass} value={regReason} onChange={(e) => setRegReason(e.target.value)} placeholder="Reason (e.g. paid cash at agent office, receipt #123)" aria-label="Reason for registration payment change" />
              <button className={buttonClass} disabled={!!busy || user.registrationPaid} onClick={() => void saveRegistration(true)}>{busy === 'registration' ? 'Saving…' : 'Mark paid'}</button>
              <button className={secondaryButtonClass} disabled={!!busy || !user.registrationPaid} onClick={() => void saveRegistration(false)}>Mark unpaid</button>
            </div>
          ) : <p className="mt-2 text-xs text-slate-400">Changing this needs registration:review.</p>}
        </div>
      ) : null}
      <div className="rounded-2xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold">Ride payments</h3>
        {!finished.length ? <p className="mt-2 text-sm text-slate-400">No finished rides.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="text-slate-500"><th className="p-2">Ride</th><th className="p-2">Trip</th><th className="p-2">Fare</th><th className="p-2">Method</th><th className="p-2">Payment</th>{can('ride:manage') ? <th className="p-2">Correct to</th> : null}</tr></thead>
              <tbody>
                {finished.map((ride) => {
                  const id = String(ride._id); const edit = edits[id];
                  return (
                    <tr key={id} className="border-t border-white/5 align-top">
                      <td className="p-2 font-mono text-xs">{id.slice(-8)}<br /><span className="text-slate-500">{new Date(String(ride.createdAt)).toLocaleDateString()}</span></td>
                      <td className="p-2">{String(ride.rideStatus)}</td>
                      <td className="p-2">{Number(ride.fare || 0).toLocaleString()} RWF</td>
                      <td className="p-2">{String(ride.paymentMethod || '—')}</td>
                      <td className={`p-2 font-semibold ${tone(String(ride.paymentStatus))}`}>{String(ride.paymentStatus || '—')}</td>
                      {can('ride:manage') ? (
                        <td className="p-2">
                          <div className="flex flex-col gap-2">
                            <select aria-label={`New payment status for ride ${id}`} className={inputClass} value={edit?.status ?? String(ride.paymentStatus)} onChange={(e) => setEdits({ ...edits, [id]: { status: e.target.value, reason: edit?.reason || '' } })}>
                              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {edit && edit.status !== ride.paymentStatus ? (
                              <>
                                <input aria-label="Reason" className={inputClass} placeholder="Reason" value={edit.reason} onChange={(e) => setEdits({ ...edits, [id]: { ...edit, reason: e.target.value } })} />
                                <button className={buttonClass} disabled={!!busy} onClick={() => void saveRide(ride)}>{busy === id ? 'Saving…' : 'Save'}</button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
