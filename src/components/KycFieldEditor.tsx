import { useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { buttonClass, inputClass, secondaryButtonClass } from './RemoteTable';

type Kind = 'driver' | 'passenger';
const isDate = (key: string) => /ExpiresAt$|^dateOfBirth$/.test(key);
const isDocument = (key: string) => /Document$|^nationalIdFront$|^nationalIdBack$|^selfie$/.test(key);
const CHOICES: Record<string, string[]> = { vehicleType: ['moto', 'car'], powertrain: ['petrol', 'diesel', 'electric'] };
const messageOf = (e: unknown) => (axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : e instanceof Error ? e.message : 'Unexpected error');
const initial = (key: string, value: unknown) => (value == null ? '' : isDate(key) ? String(value).slice(0, 10) : String(value));

/** Inline editor for one KYC field. Saves with a reason; the change is audited and the field needs re-review. */
export function KycFieldEditor({ type, recordId, field, value, updatedAt, canEdit, onSaved }: {
  type: Kind; recordId: string; field: string; value: unknown; updatedAt?: string; canEdit: boolean;
  onSaved: (record: Record<string, any>, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial(field, value));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canEdit) return null;
  if (!open) return <button type="button" className={`${secondaryButtonClass} mt-3`} onClick={() => { setDraft(initial(field, value)); setReason(''); setError(''); setOpen(true); }}>Edit value</button>;

  const save = async () => {
    if (reason.trim().length < 5) { setError('Give a reason of at least 5 characters.'); return; }
    if (draft === initial(field, value)) { setError('The value has not changed.'); return; }
    setBusy(true); setError('');
    try {
      const response = await adminApi.updateKycFields(type, recordId, { [field]: draft }, reason.trim(), updatedAt);
      onSaved(response.data.data, [response.data.message, ...(response.data.warnings || [])].join(' '));
      setOpen(false);
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-lime/30 p-3">
      {CHOICES[field] ? (
        <select aria-label={`New ${field}`} className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)}>
          <option value="">Choose…</option>{CHOICES[field].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <input aria-label={`New ${field}`} className={inputClass} type={isDate(field) ? 'date' : isDocument(field) ? 'url' : 'text'} placeholder={isDocument(field) ? 'https://… link to the new file' : ''} value={draft} onChange={(e) => setDraft(e.target.value)} />
      )}
      <input aria-label="Reason for this change" className={inputClass} placeholder="Reason (saved in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <p className="text-xs text-slate-400">The change is audit-logged, the user is notified, and this field needs a new review decision.</p>
      <div className="flex gap-2">
        <button type="button" className={buttonClass} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save value'}</button>
        <button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
