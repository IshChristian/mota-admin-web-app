import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminApi, type PromoInput, type PromoRecord, type PromoRedemptionRecord } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';
import { fromDateInput, toDateInput } from '../utils/localDateTime';

// Promo codes: MOTA pays the discount (drivers still earn on the full fare). A use counts
// only when its payment succeeds; "MOTA cost" is the part of a ride discount the commission didn't cover.

const STATUSES = ['', 'active', 'scheduled', 'expired', 'used_up', 'off', 'archived'];
const STATUS_LABEL: Record<string, string> = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', used_up: 'Used up', off: 'Switched off', archived: 'Archived' };
const STATUS_STYLE: Record<string, string> = { active: 'bg-lime/15 text-lime', scheduled: 'bg-sky-400/15 text-sky-300', expired: 'bg-white/10 text-slate-300', used_up: 'bg-amber-400/15 text-amber-300', off: 'bg-white/10 text-slate-400', archived: 'bg-white/5 text-slate-500' };
const FOR_LABEL = { ride: 'Ride (passengers)', registration_fee: 'Registration fee (drivers)' } as const;
const rwf = (n: number) => `${Math.round(n || 0).toLocaleString()} RWF`;
const message = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const discountLabel = (p: Pick<PromoInput, 'discountType' | 'value' | 'maxDiscount'>) =>
  p.discountType === 'percent' ? `${p.value}%${p.maxDiscount ? ` (max ${rwf(p.maxDiscount)})` : ''}` : rwf(p.value);

type Draft = { code: string; appliesTo: PromoInput['appliesTo']; discountType: PromoInput['discountType']; value: string; maxDiscount: string; minAmount: string; startsAt: string; endsAt: string; maxUsers: string; perUserLimit: string; active: boolean; note: string };
const EMPTY: Draft = { code: '', appliesTo: 'ride', discountType: 'percent', value: '10', maxDiscount: '', minAmount: '', startsAt: '', endsAt: '', maxUsers: '', perUserLimit: '1', active: true, note: '' };
const draftOf = (p: PromoRecord): Draft => ({ code: p.code, appliesTo: p.appliesTo, discountType: p.discountType, value: String(p.value), maxDiscount: p.maxDiscount ? String(p.maxDiscount) : '', minAmount: p.minAmount ? String(p.minAmount) : '', startsAt: toDateInput(p.startsAt), endsAt: toDateInput(p.endsAt), maxUsers: p.maxUsers ? String(p.maxUsers) : '', perUserLimit: String(p.perUserLimit || 1), active: p.active, note: p.note || '' });
const optional = (value: string) => (value.trim() === '' ? null : Number(value));
const inputOf = (d: Draft): PromoInput => ({
  code: d.code.trim().toUpperCase(), appliesTo: d.appliesTo, discountType: d.discountType, value: Number(d.value),
  maxDiscount: d.discountType === 'percent' ? optional(d.maxDiscount) : null, minAmount: optional(d.minAmount),
  startsAt: fromDateInput(d.startsAt), endsAt: fromDateInput(d.endsAt),
  maxUsers: optional(d.maxUsers), perUserLimit: Number(d.perUserLimit || 1), active: d.active, note: d.note.trim(),
});
/** Live example so staff see what a passenger or driver would actually pay. */
const example = (d: Draft) => {
  const sample = d.appliesTo === 'ride' ? 2000 : 5000;
  const value = Number(d.value) || 0;
  let off = d.discountType === 'percent' ? Math.round((sample * value) / 100) : value;
  if (d.discountType === 'percent' && d.maxDiscount) off = Math.min(off, Number(d.maxDiscount));
  off = Math.max(0, Math.min(off, sample));
  // The registration fee is never free: drivers always pay at least 100 RWF.
  if (d.appliesTo === 'registration_fee') off = Math.min(off, sample - 100);
  return `On a ${rwf(sample)} ${d.appliesTo === 'ride' ? 'ride' : 'registration fee'}: ${rwf(off)} off, pays ${rwf(sample - off)}.`;
};

export function PromoCodesPage() {
  const { can } = useAuth();
  const canManage = can('promo:manage');
  const [rows, setRows] = useState<PromoRecord[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<PromoRecord | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [detail, setDetail] = useState<{ promo: PromoRecord; redemptions: PromoRedemptionRecord[]; page: number; pages: number } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRows((await adminApi.promos.list({ status: status || undefined, q: q.trim() || undefined })).data?.data || []); setError(''); }
    catch (e) { setError(message(e, 'Could not load promo codes.')); }
    finally { setLoading(false); }
  }, [status, q]);
  useEffect(() => { void refresh(); }, [refresh]);

  const used = (p: PromoRecord) => p.reservedCount + p.redeemedCount > 0;
  const openNew = () => { setDraft(EMPTY); setFormError(''); setEditing('new'); };
  const openEdit = (p: PromoRecord) => { setDraft(draftOf(p)); setFormError(''); setEditing(p); };
  const openDetail = async (p: PromoRecord, page = 1) => {
    try { setDetail((await adminApi.promos.get(p._id, page)).data.data); }
    catch (e) { setNotice({ ok: false, text: message(e, 'Could not load this code.') }); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setFormError('');
    try {
      if (editing === 'new') await adminApi.promos.create(inputOf(draft));
      else if (editing) await adminApi.promos.update(editing._id, inputOf(draft));
      setNotice({ ok: true, text: editing === 'new' ? `Created ${draft.code.trim().toUpperCase()}.` : `Saved ${draft.code.trim().toUpperCase()}.` });
      setEditing(null);
      await refresh();
    } catch (e) { setFormError(message(e, 'Could not save the code.')); }
    finally { setSaving(false); }
  };

  const toggle = async (p: PromoRecord) => {
    try { await adminApi.promos.update(p._id, { active: !p.active }); setNotice({ ok: true, text: `${p.code} switched ${p.active ? 'off' : 'on'}.` }); await refresh(); }
    catch (e) { setNotice({ ok: false, text: message(e, 'Could not change the code.') }); }
  };

  const remove = async (p: PromoRecord) => {
    const question = used(p)
      ? `${p.code} has been used, so it will be archived: switched off and hidden, with its history kept. Continue?`
      : `Delete ${p.code}? It has never been used, so it is removed for good.`;
    if (!window.confirm(question)) return;
    try {
      const result = (await adminApi.promos.remove(p._id)).data;
      setNotice({ ok: true, text: result.archived ? `${p.code} archived (it was used).` : `${p.code} deleted.` });
      if (detail?.promo._id === p._id) setDetail(null);
      await refresh();
    } catch (e) { setNotice({ ok: false, text: message(e, 'Could not delete the code.') }); }
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const locked = editing !== 'new' && editing !== null && used(editing);

  return (
    <section className="space-y-6">
      <PageHeader title="Promo codes" description="Discounts on MoMo and wallet ride payments and the driver registration fee. MOTA pays the discount; drivers still earn on the full fare." action={canManage ? <button className={buttonClass} onClick={openNew}>New code</button> : undefined} />
      {notice ? <p role="status" className={notice.ok ? 'text-lime' : 'text-red-300'}>{notice.text}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Status <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s ? STATUS_LABEL[s] : 'All (not archived)'}</option>)}</select></label>
        <label className="text-sm">Search <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code" /></label>
        <button className={secondaryButtonClass} onClick={() => void refresh()}>Refresh</button>
      </div>
      {error ? <ErrorBanner message={error} retry={() => void refresh()} /> : null}

      <RemoteTable heads={['Code', 'For', 'Discount', 'People', 'Uses', 'Discount given', 'MOTA cost', 'Status', '']} loading={loading} empty={!rows.length}>
        {rows.map((p) => (
          <tr key={p._id} className="border-t border-white/5 align-top">
            <td className="p-3"><button className="font-mono text-sm text-lime hover:underline" onClick={() => void openDetail(p)}>{p.code}</button>{p.note ? <span className="block text-xs text-slate-400">{p.note}</span> : null}</td>
            <td className="p-3 text-xs">{FOR_LABEL[p.appliesTo]}</td>
            <td className="p-3">{discountLabel(p)}{p.minAmount ? <span className="block text-xs text-slate-400">min {rwf(p.minAmount)}</span> : null}</td>
            <td className="p-3">{p.usersCount}{p.maxUsers ? ` of ${p.maxUsers}` : ''}<span className="block text-xs text-slate-400">{p.perUserLimit}× each</span></td>
            <td className="p-3">{p.redeemedCount}{p.reservedCount ? <span className="block text-xs text-slate-400">{p.reservedCount} pending</span> : null}</td>
            <td className="p-3">{rwf(p.totalDiscount)}</td>
            <td className="p-3">{rwf(p.subsidyTotal)}</td>
            <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
            <td className="p-3 whitespace-nowrap text-right">
              {canManage && p.status !== 'archived' ? (
                <span className="inline-flex gap-2">
                  <button className={secondaryButtonClass} onClick={() => openEdit(p)}>Edit</button>
                  <button className={secondaryButtonClass} onClick={() => void toggle(p)}>{p.active ? 'Switch off' : 'Switch on'}</button>
                  <button className={`${secondaryButtonClass} text-red-300`} onClick={() => void remove(p)}>Delete</button>
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </RemoteTable>

      {editing ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <form onSubmit={save} className="mt-10 w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-panel p-6">
            <h3 className="text-lg font-semibold">{editing === 'new' ? 'New promo code' : `Edit ${editing.code}`}</h3>
            {locked ? <p className="text-sm text-amber-300">This code has been used, so its text and type can't change.</p> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">Code<input className={`${inputClass} font-mono uppercase`} value={draft.code} disabled={locked} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) })} placeholder="MOTA20" required /><span className="mt-1 block text-xs text-slate-400">3–20 letters, numbers or dashes.</span></label>
              <label className="text-sm">For<select className={inputClass} value={draft.appliesTo} disabled={locked} onChange={(e) => set({ appliesTo: e.target.value as Draft['appliesTo'] })}><option value="ride">{FOR_LABEL.ride}</option><option value="registration_fee">{FOR_LABEL.registration_fee}</option></select>{draft.appliesTo === 'registration_fee' ? <span className="mt-1 block text-xs text-slate-400">Drivers always pay at least 100 RWF.</span> : null}</label>
              <label className="text-sm">Discount type<select className={inputClass} value={draft.discountType} onChange={(e) => set({ discountType: e.target.value as Draft['discountType'] })}><option value="percent">Percentage</option><option value="fixed">Fixed amount (RWF)</option></select></label>
              <label className="text-sm">{draft.discountType === 'percent' ? 'Percentage off' : 'Amount off (RWF)'}<input type="number" min={1} max={draft.discountType === 'percent' ? 100 : undefined} className={inputClass} value={draft.value} onChange={(e) => set({ value: e.target.value })} required /></label>
              {draft.discountType === 'percent' ? <label className="text-sm">Maximum discount (RWF, optional)<input type="number" min={1} className={inputClass} value={draft.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} placeholder="No cap" /></label> : null}
              <label className="text-sm">Minimum fare / fee (RWF, optional)<input type="number" min={0} className={inputClass} value={draft.minAmount} onChange={(e) => set({ minAmount: e.target.value })} placeholder="Any amount" /></label>
              <label className="text-sm">Number of people who can use it<input type="number" min={1} className={inputClass} value={draft.maxUsers} onChange={(e) => set({ maxUsers: e.target.value })} placeholder="No limit" /><span className="mt-1 block text-xs text-slate-400">Different people. Empty means no limit.</span></label>
              <label className="text-sm">Uses per person<input type="number" min={1} className={inputClass} value={draft.perUserLimit} onChange={(e) => set({ perUserLimit: e.target.value })} required /></label>
              <label className="text-sm">Starts (optional)<input type="datetime-local" className={inputClass} value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></label>
              <label className="text-sm">Ends (optional)<input type="datetime-local" className={inputClass} value={draft.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></label>
              <label className="text-sm md:col-span-2">Internal note (optional)<input className={inputClass} value={draft.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Kigali marathon weekend" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
            </div>
            <p className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">{example(draft)}{draft.maxUsers ? ` Up to ${Number(draft.maxUsers).toLocaleString()} people × ${draft.perUserLimit || 1} use(s) each.` : ''}</p>
            {formError ? <p role="alert" className="text-red-300">{formError}</p> : null}
            <div className="flex justify-end gap-3">
              <button type="button" className={secondaryButtonClass} onClick={() => setEditing(null)}>Cancel</button>
              <button className={buttonClass} disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Create code' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {detail ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold"><span className="font-mono">{detail.promo.code}</span> · {FOR_LABEL[detail.promo.appliesTo]}</h3>
            <button className={secondaryButtonClass} onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-400">People</span>{detail.promo.usersCount}{detail.promo.maxUsers ? ` of ${detail.promo.maxUsers}` : ''}</div>
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-400">Uses</span>{detail.promo.redeemedCount}{detail.promo.reservedCount ? ` (+${detail.promo.reservedCount} pending)` : ''}</div>
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-400">Discount given</span>{rwf(detail.promo.totalDiscount)}</div>
            <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-400">MOTA cost</span>{rwf(detail.promo.subsidyTotal)}</div>
          </div>
          <RemoteTable heads={['When', 'Who', 'Paid by', 'Price', 'Discount', 'Paid', 'MOTA cost', 'Status']} loading={false} empty={!detail.redemptions.length}>
            {detail.redemptions.map((r) => (
              <tr key={r._id} className="border-t border-white/5">
                <td className="p-3 text-xs">{new Date(r.redeemedAt || r.reservedAt).toLocaleString()}</td>
                <td className="p-3">{r.userId ? `${r.userId.firstName} ${r.userId.lastName}` : '—'}<span className="block text-xs text-slate-400">{r.userId?.phone}</span></td>
                <td className="p-3 text-xs">{r.method === 'none' ? 'Covered in full' : r.method === 'wallet' ? 'Wallet' : 'MoMo'}</td>
                <td className="p-3">{rwf(r.originalAmount)}</td>
                <td className="p-3">{rwf(r.discount)}</td>
                <td className="p-3">{rwf(r.paidAmount)}</td>
                <td className="p-3">{rwf(r.subsidy)}</td>
                <td className="p-3 text-xs">{r.status === 'redeemed' ? 'Used' : r.status === 'reserved' ? 'Payment pending' : 'Payment failed (given back)'}</td>
              </tr>
            ))}
          </RemoteTable>
          {detail.pages > 1 ? (
            <div className="flex items-center gap-3 text-sm">
              <button className={secondaryButtonClass} disabled={detail.page <= 1} onClick={() => void openDetail(detail.promo, detail.page - 1)}>Previous</button>
              <span>Page {detail.page} of {detail.pages}</span>
              <button className={secondaryButtonClass} disabled={detail.page >= detail.pages} onClick={() => void openDetail(detail.promo, detail.page + 1)}>Next</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
