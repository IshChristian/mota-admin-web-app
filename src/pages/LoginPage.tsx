// Staff sign-in: password → (if two-step is on) authenticator code. Also the
// forgot-password and reset-password pages, which share the same layout.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, MailCheck, ShieldCheck } from 'lucide-react';
import { authApi } from '../api';
import { useAuth } from '../auth';

const messageOf = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? String(error.response?.data?.message || (error.response?.status === 429 ? 'Too many attempts. Wait a few minutes and try again.' : fallback)) : error instanceof Error ? error.message : fallback;

const field = 'w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[15px] outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20';
const primary = 'w-full rounded-xl bg-lime py-3 font-bold text-ink transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50';

export function AuthLayout({ title, subtitle, icon, children, footer }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,rgba(200,240,75,0.08),transparent_60%)] p-5">
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-3"><img src="/mota-logo.png" alt="MOTA" className="h-12 w-auto object-contain" /><div><div className="font-bold tracking-wide">MOTA CONTROL</div><div className="text-xs text-slate-500">Operations console</div></div></div>
      <section className="rounded-3xl border border-white/10 bg-panel p-8 shadow-glow">
        <div className="mb-6 flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lime/10 text-lime">{icon}</div><div><h1 className="text-xl font-bold">{title}</h1><p className="mt-1 text-sm text-slate-400">{subtitle}</p></div></div>
        {children}
      </section>
      <div className="mt-5 text-center text-xs text-slate-500">{footer ?? <>Authorized MOTA staff only. Activity is recorded. · <Link className="hover:text-slate-300" to="/info/privacy">Privacy</Link></>}</div>
    </div>
  </main>;
}

function PasswordInput({ value, onChange, autoComplete, id, label }: { value: string; onChange: (v: string) => void; autoComplete: string; id: string; label: string }) {
  const [show, setShow] = useState(false);
  return <div>
    <label htmlFor={id} className="mb-2 block text-sm text-slate-300">{label}</label>
    <div className="relative"><input id={id} required type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${field} pr-12`} />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-white">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
  </div>;
}

export function LoginPage() {
  const { staff, login, completeTwoFactor, signOutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (staff) return <Navigate to={(location.state as { from?: string })?.from || '/overview'} replace />;
  const go = () => navigate((location.state as { from?: string })?.from || '/overview', { replace: true });

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try { const result = await login(identifier.trim(), password); if (result.done) go(); else { setChallenge(result.challenge); setPassword(''); } }
    catch (err) { setError(messageOf(err, 'Unable to sign in')); }
    finally { setLoading(false); }
  };
  const submitCode = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await completeTwoFactor(challenge, code); go(); }
    catch (err) {
      const message = messageOf(err, 'Unable to verify the code');
      if (/expired/i.test(message)) { setChallenge(''); setCode(''); }
      setError(message);
    } finally { setLoading(false); }
  };

  if (challenge) return <AuthLayout title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app." icon={<ShieldCheck size={22} />}>
    <form onSubmit={submitCode} className="space-y-5">
      <input aria-label="Authentication code" autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} placeholder="123 456" className={`${field} text-center font-mono text-2xl tracking-[0.4em]`} />
      {error ? <p role="alert" className="text-sm text-rose-400">{error}</p> : null}
      <button disabled={loading || code.replace(/\s/g, '').length !== 6} className={primary}>{loading ? 'Verifying…' : 'Verify and sign in'}</button>
      <button type="button" onClick={() => { setChallenge(''); setCode(''); setError(''); }} className="flex w-full items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} />Use a different account</button>
    </form>
  </AuthLayout>;

  return <AuthLayout title="Sign in" subtitle="Use your MOTA staff phone number or email." icon={<LockKeyhole size={22} />}>
    {signOutReason ? <p role="status" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{signOutReason}</p> : null}
    <form onSubmit={submitPassword} className="space-y-5">
      <div><label htmlFor="identifier" className="mb-2 block text-sm text-slate-300">Phone or email</label><input id="identifier" required autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" className={field} /></div>
      <PasswordInput id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex justify-end"><Link to="/forgot-password" className="text-sm text-lime hover:underline">Forgot password?</Link></div>
      {error ? <p role="alert" className="text-sm text-rose-400">{error}</p> : null}
      <button disabled={loading} className={primary}>{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </AuthLayout>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await authApi.forgotPassword(email.trim()); setSent(true); }
    catch (err) { setError(messageOf(err, 'Could not send the reset link')); }
    finally { setLoading(false); }
  };
  if (sent) return <AuthLayout title="Check your email" subtitle={`If a staff account uses ${email}, a reset link is on its way. It works for 30 minutes.`} icon={<MailCheck size={22} />}>
    <Link to="/login" className={`${primary} block text-center`}>Back to sign in</Link>
  </AuthLayout>;
  return <AuthLayout title="Reset your password" subtitle="Enter your staff email and we'll send you a link to choose a new password." icon={<KeyRound size={22} />}>
    <form onSubmit={submit} className="space-y-5">
      <div><label htmlFor="email" className="mb-2 block text-sm text-slate-300">Email</label><input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} /></div>
      {error ? <p role="alert" className="text-sm text-rose-400">{error}</p> : null}
      <button disabled={loading} className={primary}>{loading ? 'Sending…' : 'Send reset link'}</button>
      <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} />Back to sign in</Link>
    </form>
  </AuthLayout>;
}

/** Rules shown live while typing a new password (the server requires 10+ characters). */
export function passwordChecks(value: string) {
  return [
    { ok: value.length >= 10, label: 'At least 10 characters' },
    { ok: /[a-z]/.test(value) && /[A-Z]/.test(value), label: 'Upper and lower case letters' },
    { ok: /\d/.test(value), label: 'A number' },
    { ok: /[^A-Za-z0-9]/.test(value), label: 'A symbol' },
  ];
}
export function PasswordRules({ value }: { value: string }) {
  return <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">{passwordChecks(value).map((c) => <li key={c.label} className={c.ok ? 'text-lime' : 'text-slate-500'}>{c.ok ? '✓' : '○'} {c.label}</li>)}</ul>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { if (done) { const t = window.setTimeout(() => navigate('/login', { replace: true }), 4000); return () => clearTimeout(t); } }, [done, navigate]);
  const strong = passwordChecks(password).every((c) => c.ok);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setLoading(true);
    try { await authApi.resetPassword(token, password); setDone(true); }
    catch (err) { setError(messageOf(err, 'This reset link is invalid or has expired.')); }
    finally { setLoading(false); }
  };
  if (!token) return <AuthLayout title="Link incomplete" subtitle="Open the reset link from your email again, or request a new one." icon={<KeyRound size={22} />}><Link to="/forgot-password" className={`${primary} block text-center`}>Request a new link</Link></AuthLayout>;
  if (done) return <AuthLayout title="Password changed" subtitle="You've been signed out everywhere. Sign in with your new password." icon={<ShieldCheck size={22} />}><Link to="/login" className={`${primary} block text-center`}>Sign in</Link></AuthLayout>;
  return <AuthLayout title="Choose a new password" subtitle="This signs you out on every device." icon={<KeyRound size={22} />}>
    <form onSubmit={submit} className="space-y-5">
      <PasswordInput id="new" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordRules value={password} />
      <PasswordInput id="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error ? <p role="alert" className="text-sm text-rose-400">{error}</p> : null}
      <button disabled={loading || !strong || !confirm} className={primary}>{loading ? 'Saving…' : 'Save new password'}</button>
    </form>
  </AuthLayout>;
}
