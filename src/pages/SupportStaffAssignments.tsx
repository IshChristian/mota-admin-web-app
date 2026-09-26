import { useEffect, useState } from 'react';
import { adminApi, type UserRecord } from '../api';
import { useAuth } from '../auth';

type Role = { _id: string; name: string; permissions: string[] };
export function SupportStaffAssignments({ roles }: { roles: Role[] }) {
  const { can } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const supportRole = roles.find(role => role.name === 'caller_support');
  useEffect(() => {
    if (!can('user:view')) return;
    let active = true;
    adminApi.users({ page, limit: 100 }).then(response => {
      if (!active) return;
      setUsers(response.data.data || []);
      setPages(response.data.totalPages || 1);
    }).catch(() => { if (active) setMessage('Unable to load staff accounts.'); });
    return () => { active = false; };
  }, [page, can]);
  if (!can('user:view')) return null;
  const candidate = users.find(user => user._id === selected);
  const assign = async () => {
    if (!candidate || !supportRole || !confirmed || !can('user:assign_role')) return;
    setBusy(true);
    setMessage('');
    try {
      await adminApi.assignUserRole(candidate._id, 'caller_support', supportRole._id);
      setUsers(current => current.map(user => user._id === candidate._id ? { ...user, role: 'caller_support', roleId: supportRole } : user));
      setMessage(`${candidate.firstName} ${candidate.lastName} is now assigned to caller support.`);
      setSelected('');
      setConfirmed(false);
    } catch (error: any) { setMessage(error.response?.data?.message || 'Unable to assign support role.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-8 rounded-2xl border border-white/10 bg-panel p-6">
    <h2 className="text-lg font-semibold">Support staff assignment</h2>
    <p className="mt-1 text-sm text-slate-400">Assign the caller support role to an existing account. Its checked permissions above define access.</p>
    {message ? <p role="status" className="mt-3 text-sm text-lime">{message}</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
      <select aria-label="Choose account" value={selected} onChange={event => { setSelected(event.target.value); setConfirmed(false); }} className="rounded-xl border border-white/10 bg-ink p-3">
        <option value="">Choose an account on this page</option>
        {users.filter(user => ['agent', 'caller_support'].includes(user.role)).map(user => <option key={user._id} value={user._id}>{user.firstName} {user.lastName} · {user.role}</option>)}
      </select>
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl border border-white/10 px-3 disabled:opacity-40">Previous</button>
    </div>
    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="mt-2 rounded-xl border border-white/10 px-3 py-2 disabled:opacity-40">Next page ({page}/{pages})</button>
    {candidate && candidate.role !== 'caller_support' && can('user:assign_role') ? <div className="mt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirm assigning caller support access to {candidate.firstName} {candidate.lastName}</label>
      <button type="button" disabled={!confirmed || busy || !supportRole} onClick={() => void assign()} className="rounded-xl bg-lime px-4 py-2 font-semibold text-ink disabled:opacity-40">{busy ? 'Assigning…' : 'Assign support role'}</button>
    </div> : null}
    {!supportRole ? <p className="mt-3 text-sm text-amber-400">Create the caller_support role record before assigning staff.</p> : null}
    <div className="mt-6 space-y-2">{users.filter(user => user.role === 'caller_support').map(user => <p key={user._id} className="rounded-xl border border-white/10 p-3 text-sm">{user.firstName} {user.lastName} · {user.phone} · {typeof user.roleId === 'object' ? user.roleId.permissions.length : supportRole?.permissions.length || 0} permissions</p>)}</div>
  </section>;
}
