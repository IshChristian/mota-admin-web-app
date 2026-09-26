import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from './api';
import { templates, type StaffRole } from './permissions';

type Staff = { id: string; name: string; role: StaffRole | 'moderator'; roleName: string; permissions: string[] };
type AuthValue = { staff: Staff | null; isLoading: boolean; login: (identifier: string, password: string) => Promise<void>; logout: () => void; can: (permission: string) => boolean };
const AuthContext = createContext<AuthValue | null>(null);
const staffRoles = new Set(['superadmin', 'admin', 'financial', 'agent', 'caller_support']);

function fromProfile(profile: any): Staff | null {
  if (!profile || (!staffRoles.has(profile.role) && !(profile.role === 'moderator' && profile.roleId?.permissions?.includes('admin:access')))) return null;
  const role = profile.role as StaffRole;
  return {
    id: String(profile._id || profile.id),
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || role,
    role,
    roleName: profile.roleId?.name || role,
    // A stored role record is authoritative, including an intentionally empty permission list.
    permissions: Array.isArray(profile.roleId?.permissions) ? profile.roleId.permissions : templates[role],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(!!sessionStorage.getItem('mota_admin_token'));
  const logout = () => {
    sessionStorage.removeItem('mota_admin_token');
    setStaff(null);
    setIsLoading(false);
  };
  useEffect(() => {
    if (!sessionStorage.getItem('mota_admin_token')) return;
    let mounted = true;
    authApi.me().then(response => {
      const profile = response.data?.user || response.data?.data || response.data;
      if (!mounted) return;
      const current = fromProfile(profile);
      if (current) setStaff(current);
      else logout();
    }).catch(() => { if (mounted) logout(); }).finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);
  const login = async (identifier: string, password: string) => {
    const result = await authApi.login(identifier, password);
    const { token, user } = result.data;
    if (!staffRoles.has(user.role) && !(user.role === 'moderator' && user.permissions?.includes('admin:access'))) throw new Error('This account does not have staff dashboard access.');
    sessionStorage.setItem('mota_admin_token', token);
    try {
      const response = await authApi.me();
      const profile = response.data?.user || response.data?.data || response.data;
      const current = fromProfile(profile);
      if (!current) throw new Error('Staff profile is unavailable.');
      setStaff(current);
    } catch (error) {
      logout();
      throw error;
    }
  };
  const can = (permission: string) => staff?.permissions.includes(permission) === true;
  return <AuthContext.Provider value={{ staff, isLoading, login, logout, can }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
