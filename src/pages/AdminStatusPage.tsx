import { AlertTriangle, CheckCircle2, Home, Lock, RefreshCw, ServerCrash, WifiOff, Wrench } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

const states = {
  '404': [AlertTriangle, 'Page not found', 'The requested dashboard route does not exist or has moved.', 'text-amber-400', 'bg-amber-400/10'],
  success: [CheckCircle2, 'Action completed', 'The operation was completed and confirmed.', 'text-emerald-400', 'bg-emerald-400/10'],
  failure: [AlertTriangle, 'Action failed', 'The operation could not be completed. Review the message and retry.', 'text-red-400', 'bg-red-400/10'],
  '403': [Lock, 'Access restricted', 'Your assigned role does not include permission for this page.', 'text-amber-400', 'bg-amber-400/10'],
  '500': [ServerCrash, 'Service unavailable', 'The server did not complete the request. Retry or review system logs.', 'text-red-400', 'bg-red-400/10'],
  maintenance: [Wrench, 'Maintenance in progress', 'The operations console is temporarily unavailable for scheduled updates.', 'text-amber-400', 'bg-amber-400/10'],
  offline: [WifiOff, 'No connection', 'Reconnect to the internet before continuing live operations.', 'text-slate-300', 'bg-white/5'],
} as const;

export function AdminStatusPage() {
  const { type = 'failure' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const state = states[type as keyof typeof states] || states.failure;
  const [Icon, title, message, tone, background] = state;
  const detail = (location.state as { message?: string } | null)?.message;

  return <main className="grid min-h-screen place-items-center bg-ink p-6 text-slate-100">
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center shadow-2xl">
      <img src="/mota-logo.png" alt="MOTA" className="mx-auto mb-8 h-16 w-32 object-contain" />
      <div className={`mx-auto grid h-20 w-20 place-items-center rounded-3xl ${background}`}><Icon className={tone} size={38} /></div>
      <p className={`mt-6 text-sm font-bold uppercase tracking-[.2em] ${tone}`}>{type}</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{detail || message}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button onClick={() => navigate(-1)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime font-bold text-ink"><RefreshCw size={17} />{type === 'success' ? 'Continue' : 'Try again'}</button>
        <Link to="/overview" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 font-semibold"><Home size={17} />Dashboard</Link>
      </div>
    </section>
  </main>;
}
