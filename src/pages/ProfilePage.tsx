// My account: profile, security (password, two-step verification, signed-in
// devices) and privacy (data export, cookie choice). Every staff role has it.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Download, KeyRound, LaptopMinimal, LogOut, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { authApi } from '../api';
import { currentSessionId, useAuth } from '../auth';
import { PageHeader, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';
import { when } from '../components/RecordCells';
import { PasswordRules, passwordChecks } from './LoginPage';

type Me = { firstName?: string; lastName?: string; phone?: string; email?: string; role?: string; createdAt?: string; twoFactorEnabled?: boolean; isEmailVerified?: boolean };
type Session = { sessionId: string; userAgent?: string; ipAddress?: string; lastSeenAt?: string; createdAt?: string };
const messageOf = (e: unknown, fallback: string) => axios.isAxiosError(e) ? String(e.response?.data?.message || fallback) : fallback;
const TABS = [['profile', 'Profile', UserRound], ['security', 'Security', ShieldCheck], ['privacy', 'Privacy', Download]] as const;

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-panel p-6"><h3 className="text-base font-semibold">{title}</h3>{description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}<div className="mt-5">{children}</div></section>;
}
function Notice({ kind, text }: { kind: 'ok' | 'error'; text: string }) {
  return text ? <p role={kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl px-4 py-3 text-sm ${kind === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-lime/10 text-lime'}`}>{text}</p> : null;
}
/** "Chrome on Linux" from a user agent, without a parser dependency. */
const describeDevice = (ua = '') => {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /okhttp|Expo|ReactNative/i.test(ua) ? 'MOTA app' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown device';
  return `${browser} on ${os}`;
};

export function ProfilePage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([key]) => key === params.get('tab'))?.[0]) || 'profile';
  const [me, setMe] = useState<Me>({});
  const load = useCallback(async () => { const r = await authApi.me(); setMe(r.data.user || r.data.data || r.data); }, []);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  return <section>
    <PageHeader title="My account" description="Your profile, sign-in security and privacy choices." />
    <div role="tablist" className="mb-6 flex flex-wrap gap-2">{TABS.map(([key, label, Icon]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${tab === key ? 'bg-lime font-semibold text-ink' : 'border border-white/10 text-slate-300 hover:bg-white/5'}`}><Icon size={16} />{label}</button>)}</div>
    {tab === 'profile' ? <ProfileTab me={me} onSaved={load} /> : tab === 'security' ? <SecurityTab me={me} onChanged={load} /> : <PrivacyTab />}
  </section>;
}

function ProfileTab({ me, onSaved }: { me: Me; onSaved: () => Promise<void> }) {
  const { staff, refresh } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>({ kind: 'ok', text: '' });
  useEffect(() => setForm({ firstName: me.firstName || '', lastName: me.lastName || '' }), [me.firstName, me.lastName]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try { await authApi.updateMe(form); await onSaved(); await refresh(); setMsg({ kind: 'ok', text: 'Profile saved.' }); }
    catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not save your profile.') }); }
  };
  const initials = `${me.firstName?.[0] || ''}${me.lastName?.[0] || ''}`.toUpperCase() || 'M';
  return <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
    <Card title="Personal details" description="Shown to other staff in audit logs and case assignments.">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-lime/15 text-xl font-bold text-lime">{initials}</div><div><div className="font-semibold">{[me.firstName, me.lastName].filter(Boolean).join(' ') || staff?.name}</div><div className="text-sm capitalize text-slate-400">{(me.role || staff?.role || '').replace(/_/g, ' ')}</div></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">First name<input required className={`${inputClass} mt-1`} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
          <label className="block text-sm text-slate-300">Last name<input required className={`${inputClass} mt-1`} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">Phone<input disabled className={`${inputClass} mt-1 opacity-60`} value={me.phone || ''} /></label>
          <label className="block text-sm text-slate-300">Email<input disabled className={`${inputClass} mt-1 opacity-60`} value={me.email || ''} /></label>
        </div>
        <p className="text-xs text-slate-500">Phone and email are your sign-in details. Ask a superadmin to change them so they can be verified.</p>
        <button className={buttonClass}>Save profile</button>
        <Notice {...msg} />
      </form>
    </Card>
    <Card title="Access" description="What your role lets you do in MOTA Control.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-slate-500">Role</dt><dd className="capitalize">{(staff?.role || '').replace(/_/g, ' ')}</dd>
        <dt className="text-slate-500">Member since</dt><dd>{when(me.createdAt, false)}</dd>
        <dt className="text-slate-500">Two-step</dt><dd>{me.twoFactorEnabled ? <span className="text-lime">On</span> : <span className="text-amber-300">Off — turn it on in Security</span>}</dd>
        <dt className="text-slate-500">Permissions</dt><dd>{staff?.permissions.length || 0}</dd>
      </dl>
      <details className="mt-4"><summary className="cursor-pointer text-sm text-lime">Show permissions</summary><div className="mt-3 flex flex-wrap gap-2">{staff?.permissions.map((p) => <span key={p} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">{p.replace(/[:_]/g, ' ')}</span>)}</div></details>
    </Card>
  </div>;
}

function SecurityTab({ me, onChanged }: { me: Me; onChanged: () => Promise<void> }) {
  const { logout } = useAuth();
  return <div className="grid gap-6 xl:grid-cols-2">
    <ChangePassword onDone={() => logout('Password changed. Sign in with your new password.')} />
    <TwoStep enabled={!!me.twoFactorEnabled} onChanged={onChanged} />
    <div className="xl:col-span-2"><Sessions /></div>
  </div>;
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>({ kind: 'ok', text: '' });
  const [busy, setBusy] = useState(false);
  const strong = passwordChecks(form.next).every((c) => c.ok);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.next !== form.confirm) { setMsg({ kind: 'error', text: 'The new passwords don’t match.' }); return; }
    if (!window.confirm('Changing your password signs you out on every device, including this one. Continue?')) return;
    setBusy(true);
    try { await authApi.changePassword(form.current, form.next); onDone(); }
    catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not change your password.') }); }
    finally { setBusy(false); }
  };
  return <Card title="Password" description="Use a long password you don't use anywhere else.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm text-slate-300">Current password<input required type="password" autoComplete="current-password" className={`${inputClass} mt-1`} value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></label>
      <label className="block text-sm text-slate-300">New password<input required type="password" autoComplete="new-password" className={`${inputClass} mt-1`} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} /></label>
      <PasswordRules value={form.next} />
      <label className="block text-sm text-slate-300">Confirm new password<input required type="password" autoComplete="new-password" className={`${inputClass} mt-1`} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>
      <button disabled={busy || !strong} className={buttonClass}><span className="inline-flex items-center gap-2"><KeyRound size={16} />{busy ? 'Saving…' : 'Change password'}</span></button>
      <Notice {...msg} />
    </form>
  </Card>;
}

function TwoStep({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [setup, setSetup] = useState<null | { qrCodeUrl: string; secret: string }>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>({ kind: 'ok', text: '' });
  const start = async () => {
    try { setSetup((await authApi.setupTwoFactor()).data.data); setMsg({ kind: 'ok', text: '' }); }
    catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not start setup.') }); }
  };
  const enable = async (e: FormEvent) => {
    e.preventDefault();
    try { await authApi.enableTwoFactor(code.replace(/\s/g, '')); setSetup(null); setCode(''); await onChanged(); setMsg({ kind: 'ok', text: 'Two-step verification is on. You’ll be asked for a code each time you sign in.' }); }
    catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'That code didn’t work. Check your phone’s time and try the newest code.') }); }
  };
  const disable = async (e: FormEvent) => {
    e.preventDefault();
    try { await authApi.disableTwoFactor(password, code.replace(/\s/g, '')); setDisabling(false); setCode(''); setPassword(''); await onChanged(); setMsg({ kind: 'ok', text: 'Two-step verification is off.' }); }
    catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not turn it off.') }); }
  };
  const codeInput = <input required inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123 456" className={`${inputClass} font-mono tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} aria-label="6-digit code" />;
  return <Card title="Two-step verification" description="After your password, MOTA asks for a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). Strongly recommended for every staff account.">
    <div className="mb-4 flex items-center gap-2 text-sm"><Smartphone size={16} className={enabled ? 'text-lime' : 'text-slate-500'} />Status: {enabled ? <b className="text-lime">On</b> : <b className="text-amber-300">Off</b>}</div>
    {!enabled && !setup ? <button onClick={() => void start()} className={buttonClass}>Set up two-step verification</button> : null}
    {setup ? <form onSubmit={enable} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300"><li>Open your authenticator app and scan this code.</li><li>Enter the 6-digit code it shows.</li></ol>
      <div className="flex flex-wrap items-center gap-5"><img src={setup.qrCodeUrl} alt="QR code for your authenticator app" className="h-40 w-40 rounded-xl bg-white p-2" /><div className="text-xs text-slate-400">Can’t scan? Enter this key:<div className="mt-1 break-all font-mono text-sm text-slate-200">{setup.secret}</div></div></div>
      {codeInput}
      <div className="flex gap-2"><button className={buttonClass}>Turn on</button><button type="button" className={secondaryButtonClass} onClick={() => { setSetup(null); setCode(''); }}>Cancel</button></div>
    </form> : null}
    {enabled && !disabling ? <button onClick={() => setDisabling(true)} className={secondaryButtonClass}>Turn off</button> : null}
    {enabled && disabling ? <form onSubmit={disable} className="space-y-3">
      <p className="text-sm text-amber-200">Turning this off makes your account easier to take over. Confirm with your password and a current code.</p>
      <input required type="password" placeholder="Password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
      {codeInput}
      <div className="flex gap-2"><button className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200">Turn off</button><button type="button" className={secondaryButtonClass} onClick={() => setDisabling(false)}>Keep it on</button></div>
    </form> : null}
    <Notice {...msg} />
  </Card>;
}

function Sessions() {
  const { logout } = useAuth();
  const [rows, setRows] = useState<Session[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>({ kind: 'ok', text: '' });
  const current = currentSessionId();
  const load = useCallback(async () => { try { setRows((await authApi.sessions()).data.data || []); } catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not load your devices.') }); } }, []);
  useEffect(() => { void load(); }, [load]);
  const revoke = async (s: Session) => {
    if (s.sessionId === current) { logout('You signed out.'); return; }
    try { await authApi.revokeSession(s.sessionId); setMsg({ kind: 'ok', text: 'Device signed out.' }); await load(); }
    catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not sign that device out.') }); }
  };
  const everywhere = async () => {
    if (!window.confirm('Sign out on every device, including this one?')) return;
    try { await authApi.signOutEverywhere(); } finally { logout('You signed out on every device.'); }
  };
  return <Card title="Where you're signed in" description="Sign out any device you don't recognise, then change your password.">
    <ul className="divide-y divide-white/5">{rows.map((s) => <li key={s.sessionId} className="flex flex-wrap items-center gap-4 py-3">
      <LaptopMinimal size={20} className="text-slate-400" />
      <div className="min-w-0 flex-1"><div className="font-medium">{describeDevice(s.userAgent)} {s.sessionId === current ? <span className="ml-2 rounded-full bg-lime/15 px-2 py-0.5 text-xs text-lime">This device</span> : null}</div><div className="text-xs text-slate-500">{s.ipAddress || 'Unknown IP'} · last active {when(s.lastSeenAt || s.createdAt)} · signed in {when(s.createdAt, false)}</div></div>
      <button onClick={() => void revoke(s)} className={secondaryButtonClass}>Sign out</button>
    </li>)}{!rows.length ? <li className="py-3 text-sm text-slate-400">No other active sessions.</li> : null}</ul>
    <button onClick={() => void everywhere()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300"><LogOut size={16} />Sign out everywhere</button>
    <Notice {...msg} />
  </Card>;
}

const CONSENT_KEY = 'mota_admin_privacy_v1';
function PrivacyTab() {
  const [choice, setChoice] = useState(() => { try { return localStorage.getItem(CONSENT_KEY) || 'essential'; } catch { return 'essential'; } });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>({ kind: 'ok', text: '' });
  const save = (value: string) => { try { localStorage.setItem(CONSENT_KEY, value); } catch { /* storage blocked */ } setChoice(value); setMsg({ kind: 'ok', text: 'Preference saved.' }); };
  const exportData = async () => {
    try {
      const data = (await authApi.exportMyData()).data;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `mota-my-data-${new Date().toISOString().slice(0, 10)}.json` });
      a.click(); URL.revokeObjectURL(url);
      setMsg({ kind: 'ok', text: 'Your data was downloaded.' });
    } catch (err) { setMsg({ kind: 'error', text: messageOf(err, 'Could not export your data.') }); }
  };
  return <div className="grid gap-6 xl:grid-cols-2">
    <Card title="Your data" description="Download a copy of the personal data MOTA holds about your staff account (Rwanda Law N° 058/2021).">
      <button onClick={() => void exportData()} className={buttonClass}><span className="inline-flex items-center gap-2"><Download size={16} />Download my data</span></button>
    </Card>
    <Card title="Cookies and storage in this browser" description="Essential storage keeps you signed in. Optional analytics help us improve MOTA Control.">
      <div className="space-y-2">{[['essential', 'Essential only', 'Sign-in and security only.'], ['all', 'Essential and analytics', 'Also anonymous usage statistics.']].map(([value, label, help]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${choice === value ? 'border-lime/50 bg-lime/5' : 'border-white/10'}`}><input type="radio" name="consent" checked={choice === value} onChange={() => save(value)} className="mt-1 accent-[#c8f04b]" /><span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-slate-400">{help}</span></span></label>)}</div>
    </Card>
    <Card title="How staff data is handled" description="What MOTA records about staff activity.">
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300"><li>Sign-ins, setting changes, approvals and exports are recorded in the audit trail.</li><li>Driver and passenger personal data may only be opened for a work reason.</li><li>Inactive consoles sign out after 30 minutes.</li></ul>
      <a href="/info/privacy" className="mt-3 inline-block text-sm text-lime hover:underline">Read the privacy policy</a>
    </Card>
    <Notice {...msg} />
  </div>;
}
