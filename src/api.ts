import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', timeout: 15000, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => { const token = sessionStorage.getItem('mota_admin_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
export type RoleRecord = { _id: string; name: string; description?: string; permissions: string[] };
export type UserRecord = { _id: string; firstName: string; lastName: string; phone: string; email?: string; role: string; roleId?: RoleRecord | string; isActive: boolean; isVerified: boolean; isEmailVerified?: boolean; kycLevel: 'basic' | 'full'; registrationStatus?: string; createdAt: string };
export type UserInput = Partial<UserRecord> & { firstName: string; lastName: string; phone: string; password?: string; role: string; roleId?: string };
export const adminApi = {
  stats: () => api.get('/admin/stats'), users: (params?: Record<string, unknown>) => api.get('/admin/users', { params }), user: (id: string) => api.get(`/admin/users/${id}`),
  createUser: (data: UserInput) => api.post('/admin/users', data), updateUser: (id: string, data: Partial<UserInput>) => api.patch(`/admin/users/${id}`, data),
  assignUserRole: (id: string, role: string, roleId?: string) => api.patch(`/admin/users/${id}/role`, { role, roleId }), deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  setUserActive: (id: string, isActive: boolean) => api.put(`/admin/users/${id}/status`, { isActive }), verifyUser: (id: string) => api.put(`/admin/users/${id}/verify`), setKyc: (id: string, kycLevel: 'basic' | 'full') => api.put(`/admin/users/${id}/kyc`, { kycLevel }),
  drivers: (params?: Record<string, unknown>) => api.get('/admin/drivers', { params }), registrations: (params?: Record<string, unknown>) => api.get('/admin/registrations', { params }), reviewRegistration: (id: string, status: string, remarks: string) => api.put(`/admin/registrations/${id}/status`, { status, remarks }),
  transactions: (params?: Record<string, unknown>) => api.get('/admin/paypack/transactions', { params }), syncTransactions: (ref?: string) => api.post('/admin/paypack/sync', ref ? { ref } : {}),
  roles: () => api.get('/roles'), audits: (params?: Record<string, unknown>) => api.get('/audit-logs', { params }), createRole: (data: { name: string; description: string; permissions: string[] }) => api.post('/roles', data), updateRole: (id: string, permissions: string[]) => api.put(`/roles/${id}/permissions`, { permissions }), deleteRole: (id: string) => api.delete(`/roles/${id}`),
  configs: () => api.get('/admin/configs'), updateConfig: (key: string, value: unknown, description?: string) => api.post('/admin/configs', { key, value, description }),
  rides: (params?: Record<string, unknown>) => api.get('/admin/rides', { params }), cancelRide: (id: string, reason: string) => api.patch(`/admin/rides/${id}/cancel`, { reason }),
  loans: () => api.get('/loans/admin/all', { params: { limit: 100 } }), decideLoan: (loanId: string, action: 'approve'|'reject') => api.post('/loans/admin/approve', { loanId, action }),
  fines: () => api.get('/fine-requests/all', { params: { limit: 100 } }), approveFine: (id: string, notes?: string) => api.put(`/fine-requests/${id}/approve`, { notes }), rejectFine: (id: string, reason: string) => api.put(`/fine-requests/${id}/reject`, { reason }), reviewFine: (id: string) => api.put(`/fine-requests/${id}/review`),
  supportCases: () => api.get('/admin/support-cases'), createSupportCase: (data: Record<string, unknown>) => api.post('/admin/support-cases', data), updateSupportCase: (id: string, data: Record<string, unknown>) => api.patch(`/admin/support-cases/${id}`, data), deleteSupportCase: (id: string) => api.delete(`/admin/support-cases/${id}`),
};
export const authApi = { login: (identifier: string, password: string) => api.post('/auth/login', { identifier, password }), me: () => api.get('/users/me') };
