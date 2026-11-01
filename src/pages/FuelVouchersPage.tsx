import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

type Voucher = { id: string; code: string; type: 'qr' | 'momo'; source?: string; amount: number; status: string; issuedAt: string; expiresAt?: string; redeemedAt?: string; station?: string; driver: { id: string; firstName: string; lastName: string; phone: string } };
type Config = { key: string; value: unknown };
const STATUSES = ['', 'active', 'redeemed', 'expired', 'processing', 'paid', 'returned'];
const RULES: Array<{ key: string; label: string; help: string; kind: 'number' | 'tier' | 'boolean' }> = [
  { key: 'fuel_voucher_amount', label: 'Voucher value (RWF)', help: 'Amount of one QR or MoMo voucher.', kind: 'number' },
  { key: 'fuel_voucher_daily_limit', label: 'Daily limit per type', help: 'Requests per driver per Kigali day, for QR and MoMo separately.', kind: 'number' },
  { key: 'fuel_voucher_min_tier', label: 'Minimum tier', help: 'Drivers below this tier see why they cannot request yet.', kind: 'tier' },
  { key: 'fuel_voucher_momo_enabled', label: 'MoMo vouchers enabled', help: 'MoMo vouchers are paid through the withdrawal queue (provider minimum applies).', kind: 'boolean' },
];
const message = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const csvCell = (value: unknown) => { const raw = String(value ?? ''); const safe = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };

export function FuelVouchersPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Voucher[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [station, setStation] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [configs, setConfigs] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [stationsJson, setStationsJson] = useState('[]');
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canEditRules = can('settings:update') && can('settings:financial');

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRows((await adminApi.fuelVouchers(status)).data?.data || []); setError(''); }
    catch (e) { setError(message(e, 'Could not load fuel vouchers.')); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!can('settings:view')) return;
    adminApi.configs().then((r) => {
      const map = Object.fromEntries(((r.data?.data || []) as Config[]).map((c) => [c.key, c.value]));
      setConfigs(map);
      setDraft(Object.fromEntries(RULES.map((rule) => [rule.key, String(map[rule.key] ?? '')])));
      setStationsJson(typeof map.fuel_stations === 'string' ? JSON.stringify(JSON.parse(map.fuel_stations as string || '[]'), null, 2) : '[]');
    }).catch(() => {});
  }, []);

  const redeem = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setRedeemMsg(null);
    try {
      const result = (await adminApi.redeemFuelVoucher(code.trim(), station.trim())).data.data;
      setRedeemMsg({ ok: true, text: `Redeemed ${result.voucher.code} (${result.voucher.amount.toLocaleString()} RWF) for ${result.driver.name}.` });
      setCode('');
      void refresh();
    } catch (e) { setRedeemMsg({ ok: false, text: message(e, 'Redemption failed.') }); }
    finally { setBusy(false); }
  };

  const saveRules = async () => {
    setSettingsMsg(null);
    try {
      JSON.parse(stationsJson);
    } catch { setSettingsMsg({ ok: false, text: 'Partner stations must be valid JSON.' }); return; }
    try {
      for (const rule of RULES) {
        const raw = draft[rule.key];
        const value = rule.kind === 'number' ? Number(raw) : rule.kind === 'boolean' ? raw === 'true' : raw;
        if (String(configs[rule.key] ?? '') !== String(value)) await adminApi.updateConfig(rule.key, value);
      }
      const compact = JSON.stringify(JSON.parse(stationsJson));
      if (compact !== configs.fuel_stations) await adminApi.updateConfig('fuel_stations', compact);
      setSettingsMsg({ ok: true, text: 'Fuel rules saved. Drivers see them on their next refresh.' });
    } catch (e) { setSettingsMsg({ ok: false, text: message(e, 'Could not save fuel rules.') }); }
  };

  const download = () => {
    const columns = ['Code', 'Type', 'Source', 'Amount RWF', 'Status', 'Driver', 'Phone', 'Issued', 'Expires', 'Redeemed', 'Station'];
    const lines = [columns, ...rows.map((r) => [r.code, r.type, r.source || 'request', r.amount, r.status, `${r.driver.firstName} ${r.driver.lastName}`, r.driver.phone, r.issuedAt, r.expiresAt || '', r.redeemedAt || '', r.station || ''])].map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mota-fuel-vouchers.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="space-y-6">
      <PageHeader title="Fuel vouchers" description="QR vouchers redeemed at partner stations and MoMo fuel money paid through the withdrawal queue." action={<button className={secondaryButtonClass} disabled={!rows.length} onClick={download}>Download CSV</button>} />
      {can('fuel_voucher:manage') ? (
        <form onSubmit={redeem} className="grid gap-3 rounded-2xl border border-white/10 bg-panel p-5 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm">Voucher code<input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="MOTA-QR-…" required /></label>
          <label className="text-sm">Station<input className={inputClass} value={station} onChange={(e) => setStation(e.target.value)} placeholder="e.g. Rubis Remera" /></label>
          <button className={`${buttonClass} self-end`} disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Redeem voucher'}</button>
          {redeemMsg ? <p role="alert" className={`md:col-span-3 ${redeemMsg.ok ? 'text-lime' : 'text-red-300'}`}>{redeemMsg.text}</p> : null}
        </form>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Status <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}</select></label>
        <button className={secondaryButtonClass} onClick={() => void refresh()}>Refresh</button>
      </div>
      {error ? <ErrorBanner message={error} retry={() => void refresh()} /> : null}
      <RemoteTable heads={['Code', 'Type', 'Amount', 'Status', 'Driver', 'Issued', 'Redeemed / station']} loading={loading} empty={!rows.length}>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="p-3 font-mono text-xs">{r.code}</td>
            <td className="p-3">{r.type.toUpperCase()}{r.source === 'reward' ? ' · reward' : ''}</td>
            <td className="p-3">{r.amount.toLocaleString()} RWF</td>
            <td className="p-3">{r.status}</td>
            <td className="p-3">{r.driver.firstName} {r.driver.lastName}<br /><span className="text-xs text-slate-400">{r.driver.phone}</span></td>
            <td className="p-3 text-xs">{new Date(r.issuedAt).toLocaleString()}</td>
            <td className="p-3 text-xs">{r.redeemedAt ? `${new Date(r.redeemedAt).toLocaleString()} · ${r.station || '—'}` : '—'}</td>
          </tr>
        ))}
      </RemoteTable>
      {can('settings:view') ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-panel p-5">
          <h3 className="text-lg font-semibold">Fuel rules</h3>
          {!canEditRules ? <p className="text-sm text-slate-400">Viewing only. Editing needs settings:update and settings:financial.</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {RULES.map((rule) => (
              <label key={rule.key} className="text-sm">{rule.label}
                {rule.kind === 'tier' ? (
                  <select disabled={!canEditRules} className={inputClass} value={draft[rule.key] || 'Gold'} onChange={(e) => setDraft({ ...draft, [rule.key]: e.target.value })}>{['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => <option key={t}>{t}</option>)}</select>
                ) : rule.kind === 'boolean' ? (
                  <select disabled={!canEditRules} className={inputClass} value={draft[rule.key] || 'true'} onChange={(e) => setDraft({ ...draft, [rule.key]: e.target.value })}><option value="true">On</option><option value="false">Off</option></select>
                ) : (
                  <input disabled={!canEditRules} type="number" min={0} className={inputClass} value={draft[rule.key] || ''} onChange={(e) => setDraft({ ...draft, [rule.key]: e.target.value })} />
                )}
                <span className="mt-1 block text-xs text-slate-400">{rule.help}</span>
              </label>
            ))}
          </div>
          <label className="block text-sm">Partner stations (JSON)
            <textarea disabled={!canEditRules} rows={6} className={`${inputClass} font-mono text-xs`} value={stationsJson} onChange={(e) => setStationsJson(e.target.value)} />
            <span className="mt-1 block text-xs text-slate-400">{'[{"id":"rubis-remera","name":"Rubis Remera","address":"KG 11 Ave","latitude":-1.957,"longitude":30.112,"acceptsQr":true}]'}</span>
          </label>
          {canEditRules ? <button className={buttonClass} onClick={() => void saveRules()}>Save fuel rules</button> : null}
          {settingsMsg ? <p role="alert" className={settingsMsg.ok ? 'text-lime' : 'text-red-300'}>{settingsMsg.text}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
