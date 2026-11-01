import { useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { buttonClass, inputClass, secondaryButtonClass } from './RemoteTable';

type Kind = 'driver' | 'passenger';
const isDate = (key: string) => /ExpiresAt$|^dateOfBirth$/.test(key);
const isDocument = (key: string) => /Document$|^nationalIdFront$|^nationalIdBack$|^selfie$/.test(key);
const CHOICES: Record<string, string[]> = { vehicleType: ['moto', 'car'], powertrain: ['petrol', 'diesel', 'electric'] };
// A document and its expiry date are renewed together.
const EXPIRY_OF: Record<string, string> = {
  drivingLicenseDocument: 'drivingLicenseExpiresAt', transportPermitDocument: 'transportPermitExpiresAt', insuranceDocument: 'insuranceExpiresAt',
  vehicleRegistrationDocument: 'vehicleRegistrationExpiresAt', technicalInspectionDocument: 'technicalInspectionExpiresAt', vocationalCardDocument: 'vocationalCardExpiresAt',
};
const messageOf = (e: unknown) => (axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : e instanceof Error ? e.message : 'Unexpected error');
const initial = (key: string, value: unknown) => (value == null ? '' : isDate(key) ? String(value).slice(0, 10) : String(value));

/** Inline editor for one KYC field (plus its expiry date for documents). Saves with a reason; audited; needs re-review. */
export function KycFieldEditor({ type, recordId, field, value, record, updatedAt, canEdit, onSaved }: {
  type: Kind; recordId: string; field: string; value: unknown; record: Record<string, any>; updatedAt?: string; canEdit: boolean;
  onSaved: (record: Record<string, any>, message: string) => void;
}) {
  const expiryField = EXPIRY_OF[field];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial(field, value));
  const [expiry, setExpiry] = useState(expiryField ? initial(expiryField, record[expiryField]) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'' | 'upload' | 'save'>('');
  const [error, setError] = useState('');
  if (!canEdit) return null;
  const reset = () => { setDraft(initial(field, value)); setExpiry(expiryField ? initial(expiryField, record[expiryField]) : ''); setReason(''); setError(''); };
  if (!open) return <button type="button" className={`${secondaryButtonClass} mt-3`} onClick={() => { reset(); setOpen(true); }}>{isDocument(field) ? 'Replace file / edit' : 'Edit value'}</button>;

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy('upload'); setError('');
    try { setDraft(await adminApi.uploadSignedFile(file)); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(''); }
  };

  const save = async () => {
    const updates: Record<string, string> = {};
    if (draft !== initial(field, value)) updates[field] = draft;
    if (expiryField && expiry !== initial(expiryField, record[expiryField])) updates[expiryField] = expiry;
    if (!Object.keys(updates).length) { setError('Nothing has changed.'); return; }
    if (reason.trim().length < 5) { setError('Give a reason of at least 5 characters.'); return; }
    setBusy('save'); setError('');
    try {
      const response = await adminApi.updateKycFields(type, recordId, updates, reason.trim(), updatedAt);
      onSaved(response.data.data, [response.data.message, ...(response.data.warnings || [])].join(' '));
      setOpen(false);
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(''); }
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-lime/30 p-3">
      {CHOICES[field] ? (
        <select aria-label={`New ${field}`} className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)}>
          <option value="">Choose…</option>{CHOICES[field].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : isDocument(field) ? (
        <>
          <label className="block text-sm">Upload new file (photo or PDF, max 20 MB)
            <input type="file" accept="image/*,application/pdf" disabled={!!busy} className={`${inputClass} mt-1`} onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          {busy === 'upload' ? <p role="status" className="text-sm text-slate-300">Uploading…</p> : null}
          {draft && draft !== initial(field, value) ? <a href={draft} target="_blank" rel="noopener noreferrer" className="block text-sm text-lime underline">Preview new file ↗</a> : null}
          <input aria-label={`Link for ${field}`} className={inputClass} type="url" placeholder="…or paste an https:// link" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </>
      ) : (
        <input aria-label={`New ${field}`} className={inputClass} type={isDate(field) ? 'date' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} />
      )}
      {expiryField ? (
        <label className="block text-sm">Expiry date
          <input type="date" className={`${inputClass} mt-1`} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      ) : null}
      <input aria-label="Reason for this change" className={inputClass} placeholder="Reason (saved in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <p className="text-xs text-slate-400">The change is audit-logged, the user is notified, and changed fields need a new review decision.</p>
      <div className="flex gap-2">
        <button type="button" className={buttonClass} disabled={!!busy} onClick={() => void save()}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        <button type="button" className={secondaryButtonClass} disabled={!!busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
