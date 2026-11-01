import { useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';

type Ask = (o: { title: string; description: string; fields?: Array<{ name: string; label: string; maxLength?: number }>; confirm: string }) => Promise<Record<string, string> | null>;
const messageOf = (e: unknown) => (axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : e instanceof Error ? e.message : 'Unexpected error');

/** Driver registration fee status. Status only (no money moves); a reason is required and audited. */
export function FeePaidCheckbox({ user, canEdit, ask, onSaved, onError }: {
  user: { _id: string; firstName: string; lastName: string; phone?: string; registrationPaid?: boolean };
  canEdit: boolean; ask: Ask; onSaved: (message: string) => void; onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toggle = async (paid: boolean) => {
    const answer = await ask({
      title: paid ? 'Mark registration fee as paid?' : 'Mark registration fee as unpaid?',
      description: `${user.firstName} ${user.lastName}${user.phone ? ` · ${user.phone}` : ''}. This changes the payment status only (no money moves) and is saved in the audit log.`,
      fields: [{ name: 'reason', label: 'Reason (e.g. paid cash at agent office, receipt number)', maxLength: 300 }],
      confirm: paid ? 'Mark paid' : 'Mark unpaid',
    });
    if (!answer) return;
    const reason = String(answer.reason || '').trim();
    if (reason.length < 5) { onError('Give a reason of at least 5 characters.'); return; }
    setBusy(true);
    try { onSaved((await adminApi.setRegistrationPayment(user._id, paid, reason)).data.message); }
    catch (e) { onError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return (
    <label className="inline-flex items-center gap-2" title={canEdit ? 'Mark the registration fee as paid or unpaid' : 'Needs registration:review'}>
      <input type="checkbox" className="h-4 w-4 accent-lime-400" aria-label="Registration fee paid" checked={Boolean(user.registrationPaid)} disabled={!canEdit || busy} onChange={(e) => void toggle(e.target.checked)} />
      <span>{busy ? 'Saving…' : user.registrationPaid ? 'Paid' : 'Not paid'}</span>
    </label>
  );
}
