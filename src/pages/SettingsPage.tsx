// System settings, grouped by what they change. Each field says who it affects
// and its unit; a section saves only the values that changed, after showing a
// summary to confirm. Anything not in the catalogue is under "Advanced".
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Banknote, Fuel, Gauge, Gift, Landmark, MapPin, Percent, PiggyBank, Settings2, UserPlus } from 'lucide-react';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';
import { RidePricingCard } from '../components/RidePricingCard';
import { when } from '../components/RecordCells';

type Config = { _id?: string; key: string; value: unknown; description?: string; dataType?: string; category?: string; updatedAt?: string; updatedBy?: { firstName?: string; lastName?: string } | null };
type Kind = 'money' | 'percent' | 'count' | 'days' | 'km' | 'speed' | 'decimal' | 'switch' | 'text' | 'email' | 'phone' | 'tier' | 'longtext';
type Field = { key: string; label: string; kind: Kind; affects: string; help?: string; fallback: unknown };
type Section = { id: string; title: string; description: string; icon: ReactNode; financial: boolean; fields: Field[]; note?: ReactNode; danger?: boolean };

const LIFETIME_TIERS = ['starter', 'bronze', 'silver', 'gold', 'platinum', 'gorilla'];

const SECTIONS: Section[] = [
  { id: 'fees', title: 'Commission and fees', description: 'Percentages MOTA keeps. Changes apply to new transactions only.', icon: <Percent size={18} />, financial: true, fields: [
    { key: 'ride_commission_percentage', label: 'Ride commission', kind: 'percent', affects: 'Drivers', help: 'Taken from every ride fare; the driver earns the rest.', fallback: 10 },
    { key: 'cash_out_fee_percentage', label: 'Cash-out fee', kind: 'percent', affects: 'Drivers and passengers', help: 'Added to MoMo withdrawals from the MOTA wallet.', fallback: 2 },
    { key: 'transfer_fee_percentage', label: 'Wallet transfer fee', kind: 'percent', affects: 'Drivers and passengers', help: 'Charged on wallet-to-wallet transfers.', fallback: 1 },
    { key: 'agent_cash_in_fee_percentage', label: 'Agent cash-in fee', kind: 'percent', affects: 'Agents and their customers', help: 'Charged when an agent deposits cash into a wallet.', fallback: 0 },
  ] },
  { id: 'registration', title: 'Registration', description: 'One-time fees paid before an account is activated. The app shows the amount set here.', icon: <UserPlus size={18} />, financial: true, fields: [
    { key: 'registration_fee', label: 'Driver registration fee', kind: 'money', affects: 'New drivers', help: 'Paid by MoMo after documents are submitted. 0 makes registration free.', fallback: 5000 },
    { key: 'agent_registration_fee', label: 'Agent registration fee', kind: 'money', affects: 'New agents', fallback: 10000 },
  ] },
  { id: 'loans', title: 'Fine loans', description: 'MOTA pays an approved traffic fine; the driver repays from the wallet.', icon: <Landmark size={18} />, financial: true, fields: [
    { key: 'fine_loan_interest_rate', label: 'Interest', kind: 'percent', affects: 'Drivers with new loans', help: 'Charged once on the loan amount.', fallback: 5 },
    { key: 'fine_loan_max_amount', label: 'Largest loan', kind: 'money', affects: 'Drivers', help: 'Each driver’s own limit (from their credit grade) can be lower.', fallback: 50000 },
    { key: 'fine_loan_auto_repayment_percentage', label: 'Auto-repayment per ride', kind: 'percent', affects: 'Drivers repaying a loan', help: 'Share of each ride’s earnings taken until the loan is repaid.', fallback: 10 },
    { key: 'fine_loan_max_duration_days', label: 'Repayment period', kind: 'days', affects: 'Drivers with new loans', help: 'After this, an unpaid loan is marked defaulted.', fallback: 90 },
    { key: 'loan_min_transactions_required', label: 'Transactions before borrowing', kind: 'count', affects: 'Drivers', help: 'Successful transactions a driver needs before requesting a loan.', fallback: 5 },
  ] },
  { id: 'savings', title: 'Savings', description: 'Reward for drivers who keep money in MOTA savings.', icon: <PiggyBank size={18} />, financial: true, fields: [
    { key: 'savings_monthly_reward_rate', label: 'Monthly reward', kind: 'percent', affects: 'Drivers with savings', help: 'Paid on balances held 30 days or more. Shown in the app.', fallback: 2 },
  ] },
  { id: 'matching', title: 'Ride matching', description: 'How ride requests reach drivers and how times are estimated.', icon: <MapPin size={18} />, financial: false, fields: [
    { key: 'ride_search_radius_km', label: 'Request radius', kind: 'km', affects: 'Drivers and passengers', help: 'Drivers within this distance are offered a request (drivers can choose a smaller one).', fallback: 5 },
    { key: 'ride_avg_speed_kmh', label: 'Average speed for estimates', kind: 'speed', affects: 'Passengers', help: 'Used for trip-time and arrival estimates when live traffic isn’t available.', fallback: 20 },
  ] },
  { id: 'fuel', title: 'Daily fuel reward', description: 'Free QR fuel vouchers given every day to drivers on one lifetime tier.', icon: <Fuel size={18} />, financial: true, note: <>Voucher value, daily request limit, minimum tier and partner stations are on the <Link to="/fuel-vouchers" className="text-lime hover:underline">Fuel vouchers</Link> page.</>, fields: [
    { key: 'fuel_reward_enabled', label: 'Give daily reward vouchers', kind: 'switch', affects: 'Drivers on the reward tier', fallback: true },
    { key: 'fuel_reward_tier', label: 'Lifetime tier that receives them', kind: 'tier', affects: 'Drivers on this tier', fallback: 'silver' },
    { key: 'fuel_reward_count', label: 'Vouchers per driver per day', kind: 'count', affects: 'Drivers on the reward tier', fallback: 2 },
    { key: 'fuel_reward_amount', label: 'Value of each voucher', kind: 'money', affects: 'Drivers on the reward tier', help: 'Daily cost per driver = vouchers × value.', fallback: 3000 },
  ] },
  { id: 'tiers', title: 'Driver tiers', description: 'Two ladders: lifetime tiers (badge, loan limit, fuel reward) and monthly performance tiers (fuel vouchers, earnings multiplier).', icon: <Gauge size={18} />, financial: false, fields: [
    { key: 'tier_bronze_rides', label: 'Lifetime: Bronze from', kind: 'count', affects: 'Drivers', help: 'Total completed rides.', fallback: 600 },
    { key: 'tier_silver_rides', label: 'Lifetime: Silver from', kind: 'count', affects: 'Drivers', fallback: 1500 },
    { key: 'tier_gold_rides', label: 'Lifetime: Gold from', kind: 'count', affects: 'Drivers', fallback: 5000 },
    { key: 'tier_platinum_rides', label: 'Lifetime: Platinum from', kind: 'count', affects: 'Drivers', fallback: 100000 },
    { key: 'tier_gorilla_rides', label: 'Lifetime: Gorilla from', kind: 'count', affects: 'Drivers', fallback: 1000000 },
    { key: 'perf_tier_silver_monthly_rides', label: 'Monthly: Silver from', kind: 'count', affects: 'Drivers', help: 'Rides this month.', fallback: 600 },
    { key: 'perf_tier_gold_monthly_rides', label: 'Monthly: Gold from', kind: 'count', affects: 'Drivers', help: 'Gold unlocks fuel voucher requests.', fallback: 800 },
    { key: 'perf_tier_platinum_monthly_rides', label: 'Monthly: Platinum from', kind: 'count', affects: 'Drivers', fallback: 1000 },
    { key: 'perf_daily_streak_target', label: 'Rides per day for a streak', kind: 'count', affects: 'Drivers', fallback: 20 },
  ] },
  { id: 'earnings', title: 'Performance pay display', description: 'Daily pay figures shown to drivers in the app (base × multiplier for their monthly tier).', icon: <Banknote size={18} />, financial: true, fields: [
    { key: 'perf_base_daily_pay', label: 'Base daily pay', kind: 'money', affects: 'Drivers', fallback: 22000 },
    { key: 'perf_multiplier_silver', label: 'Silver multiplier', kind: 'decimal', affects: 'Silver drivers', fallback: 1.2 },
    { key: 'perf_multiplier_gold', label: 'Gold multiplier', kind: 'decimal', affects: 'Gold drivers', fallback: 1.5 },
    { key: 'perf_multiplier_platinum', label: 'Platinum multiplier', kind: 'decimal', affects: 'Platinum drivers', fallback: 2 },
  ] },
  { id: 'referrals', title: 'Referrals', description: 'Cash reward for bringing a new driver who becomes active.', icon: <Gift size={18} />, financial: true, fields: [
    { key: 'referral_reward_amount', label: 'Reward per referral', kind: 'money', affects: 'Drivers and agents who refer', fallback: 5000 },
  ] },
  { id: 'platform', title: 'Platform and support', description: 'Shown in the apps’ help screens.', icon: <Settings2 size={18} />, financial: false, fields: [
    { key: 'app_name', label: 'Platform name', kind: 'text', affects: 'Everyone', fallback: 'MOTA' },
    { key: 'support_phone', label: 'Support phone', kind: 'phone', affects: 'Everyone', fallback: '' },
    { key: 'support_email', label: 'Support email', kind: 'email', affects: 'Everyone', fallback: '' },
  ] },
  { id: 'maintenance', title: 'Maintenance mode', description: 'Pauses the driver and passenger apps. Staff keep access; payments in progress still settle.', icon: <AlertTriangle size={18} />, financial: false, danger: true, fields: [
    { key: 'maintenance_mode', label: 'Pause the apps', kind: 'switch', affects: 'All drivers and passengers', help: 'Turn on only during planned work. Rides can’t be requested while it’s on.', fallback: false },
    { key: 'maintenance_message', label: 'Message shown in the apps', kind: 'longtext', affects: 'All drivers and passengers', fallback: 'MOTA is being updated. Please try again shortly.' },
  ] },
];

const CATALOGUED = new Set([...SECTIONS.flatMap((s) => s.fields.map((f) => f.key)), 'ride_base_fare', 'ride_per_km_rate', 'ride_minimum_fare', 'car_ride_base_fare', 'car_ride_per_km_rate', 'car_ride_minimum_fare', 'parcel_surcharge', 'fuel_voucher_amount', 'fuel_voucher_daily_limit', 'fuel_voucher_min_tier', 'fuel_voucher_momo_enabled', 'fuel_stations']);
const UNIT: Partial<Record<Kind, string>> = { money: 'RWF', percent: '%', days: 'days', km: 'km', speed: 'km/h', count: '' };
const messageOf = (e: unknown) => axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : 'Unexpected error';
const display = (field: Field, value: unknown) => field.kind === 'switch' ? (value === true || value === 'true' ? 'On' : 'Off') : field.kind === 'money' ? `${Number(value).toLocaleString()} RWF` : field.kind === 'percent' ? `${value}%` : field.kind === 'days' ? `${value} days` : String(value ?? '—');
const toInput = (value: unknown) => typeof value === 'boolean' ? String(value) : value === null || value === undefined ? '' : String(value);

export function SettingsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows((await adminApi.configs()).data.data || []); }
    catch (e) { setError(messageOf(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const canEdit = can('settings:update');
  const canFinancial = canEdit && can('settings:financial');
  const q = query.trim().toLowerCase();
  const sections = SECTIONS.map((s) => ({ ...s, fields: s.fields.filter((f) => !q || `${f.label} ${f.affects} ${f.help || ''} ${s.title}`.toLowerCase().includes(q)) })).filter((s) => s.fields.length);

  return <section>
    <PageHeader title="Settings" description="Prices, fees and rules for the driver and passenger apps. Every change is recorded in the audit trail." action={<input type="search" placeholder="Find a setting…" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} w-64`} aria-label="Find a setting" />} />
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    {!canFinancial ? <p className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{canEdit ? 'Money settings are read-only for your role (needs the “settings financial” permission).' : 'Settings are read-only for your role.'}</p> : null}
    <nav aria-label="Setting sections" className="mb-6 flex flex-wrap gap-2">{[['pricing', 'Ride fares'], ...SECTIONS.map((s) => [s.id, s.title])].map(([id, title]) => <a key={id} href={`#${id}`} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">{title}</a>)}<a href="#advanced" className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5">Advanced</a></nav>
    {loading && !rows.length ? <p className="py-10 text-center text-slate-400">Loading settings…</p> : <div className="space-y-6">
      {!q || 'ride fares moto car parcel price km'.includes(q) ? <div id="pricing" className="scroll-mt-24"><RidePricingCard rows={rows} onSaved={load} /></div> : null}
      {sections.map((s) => <SettingsSection key={s.id} section={s} byKey={byKey} editable={s.financial ? canFinancial : canEdit} onSaved={load} />)}
      <Advanced rows={rows.filter((r) => !CATALOGUED.has(r.key))} editable={canFinancial} onSaved={load} />
    </div>}
  </section>;
}

function SettingsSection({ section, byKey, editable, onSaved }: { section: Section; byKey: Map<string, Config>; editable: boolean; onSaved: () => Promise<void> }) {
  const saved = useCallback((f: Field) => byKey.get(f.key)?.value ?? f.fallback, [byKey]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setDraft(Object.fromEntries(section.fields.map((f) => [f.key, toInput(saved(f))]))); }, [section.fields, saved]);
  const changed = section.fields.filter((f) => draft[f.key] !== undefined && draft[f.key] !== toInput(saved(f)));
  const lastChange = section.fields.map((f) => byKey.get(f.key)).filter((c): c is Config => !!c?.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed.length) return;
    const summary = changed.map((f) => `• ${f.label}: ${display(f, saved(f))} → ${display(f, draft[f.key])}  (affects ${f.affects.toLowerCase()})`).join('\n');
    if (!window.confirm(`Save these changes?\n\n${summary}`)) return;
    setBusy(true); setMsg(null);
    const failures: string[] = [];
    for (const f of changed) {
      const raw = draft[f.key];
      const value = f.kind === 'switch' ? raw === 'true' : ['money', 'percent', 'count', 'days', 'km', 'speed', 'decimal'].includes(f.kind) ? Number(raw) : raw;
      try { await adminApi.updateConfig(f.key, value); } catch (err) { failures.push(`${f.label}: ${messageOf(err)}`); }
    }
    await onSaved();
    setBusy(false);
    setMsg(failures.length ? { ok: false, text: failures.join(' ') } : { ok: true, text: `Saved ${changed.length} change${changed.length === 1 ? '' : 's'}.` });
  };

  return <form id={section.id} onSubmit={submit} className={`scroll-mt-24 rounded-2xl border bg-panel p-6 ${section.danger ? 'border-amber-400/30' : 'border-white/10'}`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${section.danger ? 'bg-amber-400/15 text-amber-300' : 'bg-lime/10 text-lime'}`}>{section.icon}</div><div><h3 className="text-base font-semibold">{section.title}</h3><p className="mt-0.5 text-sm text-slate-400">{section.description}</p></div></div>
      {lastChange ? <p className="text-xs text-slate-500">Last changed {when(lastChange.updatedAt)}{lastChange.updatedBy?.firstName ? ` by ${lastChange.updatedBy.firstName} ${lastChange.updatedBy.lastName || ''}` : ''}</p> : null}
    </header>
    {section.note ? <p className="mt-3 text-sm text-slate-400">{section.note}</p> : null}
    <div className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2">{section.fields.map((f) => <FieldInput key={f.key} field={f} value={draft[f.key] ?? ''} dirty={changed.includes(f)} disabled={!editable || busy} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />)}</div>
    {editable ? <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
      <button disabled={busy || !changed.length} className={buttonClass}>{busy ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'No changes'}</button>
      {changed.length ? <button type="button" className={secondaryButtonClass} onClick={() => setDraft(Object.fromEntries(section.fields.map((f) => [f.key, toInput(saved(f))])))}>Undo</button> : null}
      {msg ? <span role="status" className={`text-sm ${msg.ok ? 'text-lime' : 'text-red-300'}`}>{msg.text}</span> : null}
    </div> : null}
  </form>;
}

function FieldInput({ field, value, dirty, disabled, onChange }: { field: Field; value: string; dirty: boolean; disabled: boolean; onChange: (v: string) => void }) {
  const id = `setting-${field.key}`;
  const ring = dirty ? 'border-lime/60 ring-1 ring-lime/30' : '';
  let control: ReactNode;
  if (field.kind === 'switch') control = <button type="button" id={id} role="switch" aria-checked={value === 'true'} disabled={disabled} onClick={() => onChange(value === 'true' ? 'false' : 'true')} className={`flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm ${ring} disabled:opacity-50`}><span className={`relative h-6 w-11 rounded-full transition ${value === 'true' ? (field.key === 'maintenance_mode' ? 'bg-amber-400' : 'bg-lime') : 'bg-white/15'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value === 'true' ? 'left-[22px]' : 'left-0.5'}`} /></span>{value === 'true' ? 'On' : 'Off'}</button>;
  else if (field.kind === 'tier') control = <select id={id} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} capitalize ${ring}`}>{LIFETIME_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}</select>;
  else if (field.kind === 'longtext') control = <textarea id={id} disabled={disabled} rows={2} maxLength={200} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${ring}`} />;
  else {
    const numeric = ['money', 'percent', 'count', 'days', 'km', 'speed', 'decimal'].includes(field.kind);
    control = <div className="relative"><input id={id} disabled={disabled} required={numeric} type={numeric ? 'number' : field.kind === 'email' ? 'email' : field.kind === 'phone' ? 'tel' : 'text'} inputMode={field.kind === 'decimal' || field.kind === 'km' ? 'decimal' : numeric ? 'numeric' : undefined} min={numeric ? 0 : undefined} max={field.kind === 'percent' ? 100 : undefined} step={field.kind === 'decimal' || field.kind === 'percent' || field.kind === 'km' ? 'any' : numeric ? 1 : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${UNIT[field.kind] ? 'pr-14' : ''} ${ring}`} />{UNIT[field.kind] ? <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-slate-500">{UNIT[field.kind]}</span> : null}</div>;
  }
  return <div>
    <label htmlFor={id} className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-slate-200"><span>{field.label}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-normal text-slate-400">{field.affects}</span></label>
    {control}
    {field.help ? <p className="mt-1.5 text-xs text-slate-500">{field.help}</p> : null}
  </div>;
}

function Advanced({ rows, editable, onSaved }: { rows: Config[]; editable: boolean; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<Config | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    let parsed: unknown = value; try { parsed = JSON.parse(value); } catch { /* plain text */ }
    if (!window.confirm(`Change ${editing.key}?`)) return;
    try { await adminApi.updateConfig(editing.key, parsed); setEditing(null); setError(''); await onSaved(); } catch (err) { setError(messageOf(err)); }
  };
  return <details id="advanced" className="scroll-mt-24 rounded-2xl border border-white/10 bg-panel p-6">
    <summary className="cursor-pointer text-base font-semibold">Advanced <span className="text-sm font-normal text-slate-400">— other stored values ({rows.length})</span></summary>
    <p className="mt-2 text-sm text-slate-400">Values used by older features or set by other pages. Change them only if you know what they do.</p>
    {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    {editing ? <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3"><label className="flex-1 text-sm">{editing.key}<input className={`${inputClass} mt-1`} value={value} onChange={(e) => setValue(e.target.value)} /></label><button className={buttonClass}>Save</button><button type="button" className={secondaryButtonClass} onClick={() => setEditing(null)}>Cancel</button></form> : null}
    <div className="mt-4"><RemoteTable heads={['Key', 'Value', 'Description', 'Updated', '']} loading={false} empty={!rows.length}>{rows.map((c) => <tr key={c.key} className="border-t border-white/5"><td className="py-3 pr-4 font-mono text-xs">{c.key}</td><td className="max-w-xs truncate py-3 pr-4">{typeof c.value === 'string' ? c.value : JSON.stringify(c.value)}</td><td className="py-3 pr-4 text-slate-400">{c.description || '—'}</td><td className="py-3 pr-4 text-slate-400">{when(c.updatedAt)}</td><td>{editable ? <button onClick={() => { setEditing(c); setValue(typeof c.value === 'string' ? c.value : JSON.stringify(c.value)); }} className="text-lime">Edit</button> : null}</td></tr>)}</RemoteTable></div>
  </details>;
}
