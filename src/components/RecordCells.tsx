// Small display helpers shared by list pages: people, money, dates and statuses.
import { Link } from 'react-router-dom';

type Person = { _id?: string; firstName?: string; lastName?: string; phone?: string };

export const money = (value: unknown) => `${Math.round(Number(value) || 0).toLocaleString()} RWF`;

export const when = (value?: string | Date | null, withTime = true) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : date.toLocaleDateString([], { dateStyle: 'medium' });
};

/** Name and phone, linking to the driver's workspace. Falls back gracefully when the account was deleted. */
export function DriverCell({ person, to = 'drivers' }: { person: Person | string | null | undefined; to?: 'drivers' | 'users' }) {
  if (!person) return <span className="text-slate-500">Deleted account</span>;
  if (typeof person === 'string') return <Link className="text-lime underline-offset-2 hover:underline" to={`/${to}/${person}`}>{person.slice(-8)}</Link>;
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Unnamed';
  return <div><Link className="text-lime underline-offset-2 hover:underline" to={`/${to}/${person._id}`}>{name}</Link>{person.phone ? <div className="text-xs text-slate-500">{person.phone}</div> : null}</div>;
}

const TONE: Record<string, string> = {
  pending: 'bg-amber-400/15 text-amber-300', under_review: 'bg-sky-400/15 text-sky-300',
  active: 'bg-lime/15 text-lime', approved: 'bg-emerald-400/15 text-emerald-300', successful: 'bg-emerald-400/15 text-emerald-300', paid: 'bg-emerald-400/15 text-emerald-300',
  overdue: 'bg-red-400/15 text-red-300', defaulted: 'bg-red-400/15 text-red-300', rejected: 'bg-white/10 text-slate-400',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status] || 'bg-white/10 text-slate-300'}`}>{label || status.replace(/_/g, ' ')}</span>;
}
