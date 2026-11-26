import type { RoleRecord } from '../api';

// A user's roleId is a populated role, a bare id, or null (no staff role, or the role was
// deleted and populate found nothing). typeof null === 'object', so check for null first.
type WithRole = { role?: string | null; roleId?: RoleRecord | string | null };

const populated = (roleId: WithRole['roleId']): roleId is RoleRecord => !!roleId && typeof roleId === 'object';

/** The role name to show: the staff role's name, else the account role. */
export const roleLabel = (u: WithRole) => String((populated(u.roleId) ? u.roleId.name : u.role) || 'unknown').replace(/_/g, ' ');

/** The value for a role picker: the role's id when there is one, else the account role. */
export const roleChoiceOf = (u: WithRole) => (populated(u.roleId) ? u.roleId._id : u.roleId) || u.role || '';
