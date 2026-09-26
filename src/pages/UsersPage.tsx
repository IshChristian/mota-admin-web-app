import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { adminApi, type UserInput, type UserRecord, type RoleRecord } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

const blank: UserInput = { firstName: '', lastName: '', phone: '', email: '', password: '', role: 'client', isActive: true, isVerified: false, kycLevel: 'basic' };
const defaults = ['client', 'driver', 'agent', 'caller_support', 'financial', 'admin', 'superadmin'] as const;
const messageOf = (error: unknown) => axios.isAxiosError(error) ? String(error.response?.data?.message || error.message) : 'Unexpected error';
const displayRole = (user: UserRecord) => (typeof user.roleId === 'object' && user.roleId?.name ? user.roleId.name : user.role).replaceAll('_', ' ');

export function UsersPage() {
  const { can, staff } = useAuth();
  const [rows, setRows] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserInput>(blank);
  const [roleChoice, setRoleChoice] = useState('client');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [users, availableRoles] = await Promise.all([adminApi.users({ page, limit: 100 }), can('role:view') ? adminApi.roles() : Promise.resolve(null)]);
      setRows(users.data.data || []);
      setPages(users.data.totalPages || 1);
      setRoles(availableRoles?.data?.data || []);
    } catch (error) { setError(messageOf(error)); }
    finally { setLoading(false); }
  }, [page, can]);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => { const term = query.toLowerCase().trim(); return term ? rows.filter(user => `${user.firstName} ${user.lastName} ${user.phone} ${user.email || ''} ${displayRole(user)}`.toLowerCase().includes(term)) : rows; }, [query, rows]);
  const customRoles = roles.filter(role => !defaults.includes(role.name as typeof defaults[number]));
  const chosenRole = roles.find(role => role.name === roleChoice);
  const create = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      await adminApi.createUser({ ...form, role: roleChoice, roleId: chosenRole?._id });
      setOpen(false); setForm(blank); setRoleChoice('client'); await load();
    } catch (error) { setError(error instanceof Error && !axios.isAxiosError(error) ? error.message : messageOf(error)); }
  };
  return <section>
    <PageHeader title="User management" description="Review accounts and their assigned role records." action={can('user:create') ? <button className={buttonClass} onClick={() => setOpen(true)}><Plus className="mr-2 inline" size={16} />New user</button> : undefined} />
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    <div className="mb-4 flex gap-3"><input className={inputClass} aria-label="Search users on this page" placeholder="Search users on this page" value={query} onChange={event => setQuery(event.target.value)} /><button aria-label="Refresh" className={secondaryButtonClass} onClick={() => void load()}><RefreshCw size={16} /></button></div>
    <RemoteTable heads={['User', 'Contact', 'Role', 'KYC', 'Registration', 'Status', 'Action']} loading={loading} empty={!visible.length}>{visible.map(user => <tr key={user._id} className="border-t border-white/5"><td className="py-4 pr-4 font-medium">{user.firstName} {user.lastName}</td><td className="py-4 pr-4 text-slate-400">{user.phone}<div className="text-xs">{user.email || 'No email'}</div></td><td className="py-4 pr-4 capitalize">{displayRole(user)}</td><td className="py-4 pr-4">{user.kycLevel}</td><td className="py-4 pr-4">{user.registrationStatus || '—'}</td><td className="py-4 pr-4">{user.isActive ? 'Active' : 'Inactive'}</td><td><Link className={secondaryButtonClass} to={`/users/${user._id}`}>View & manage</Link></td></tr>)}</RemoteTable>
    <div className="mt-4 flex items-center gap-3 text-sm"><button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className={secondaryButtonClass} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={create} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-panel p-6"><h3 className="text-xl font-semibold">Create user</h3><div className="mt-5 grid gap-3 sm:grid-cols-2">{(['firstName', 'lastName', 'phone', 'email', 'password'] as const).map(field => <input key={field} required={field !== 'email'} type={field === 'password' ? 'password' : 'text'} className={inputClass} placeholder={field} aria-label={field} value={String(form[field] || '')} onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))} />)}
      <select className={inputClass} aria-label="Account role" value={roleChoice} onChange={event => setRoleChoice(event.target.value)}><optgroup label="Default roles">{defaults.filter(role => role !== 'superadmin' || staff?.role === 'superadmin').map(role => <option className="bg-ink" key={role} value={role} disabled={role === 'financial'}>{role.replaceAll('_', ' ')}{role === 'financial' ? ' · unavailable here' : ''}</option>)}</optgroup>{can('role:view') && customRoles.length ? <optgroup label="Created roles (account assignment pending)">{customRoles.map(role => <option className="bg-ink" key={role._id} value={`custom:${role._id}`} disabled>{role.name.replaceAll('_', ' ')} · {role.permissions.length} permissions</option>)}</optgroup> : null}</select></div>
      {chosenRole ? <div className="mt-4 rounded-xl border border-white/10 p-3 text-sm"><b>Permissions for {chosenRole.name.replaceAll('_', ' ')}</b><p className="mt-1 mb-0 text-slate-400">{chosenRole.permissions.length ? chosenRole.permissions.join(' · ') : 'No permissions assigned'}</p></div> : null}
      <div className="mt-5 flex justify-end gap-3"><button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>Cancel</button><button className={buttonClass}>Create</button></div></form></div> : null}
  </section>;
}
