import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, authApi } from "./api";
type Staff = { id: string; name: string; role: string; permissions: string[] };
type AuthValue = {
  staff: Staff | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);
const stored = () => {
  try {
    const user = JSON.parse(
      sessionStorage.getItem("mota_admin_staff") || "null",
    );
    return user ? { ...user, permissions: [] } : null;
  } catch {
    return null;
  }
};
export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(stored);
  const logout = useCallback(() => {
    sessionStorage.removeItem("mota_admin_token");
    sessionStorage.removeItem("mota_admin_staff");
    setStaff(null);
  }, []);
  const refresh = useCallback(async () => {
    const token = sessionStorage.getItem("mota_admin_token");
    if (!token) return;
    try {
      const response = await api.get("/reports/access/me");
      setStaff((current) => {
        if (!current || token !== sessionStorage.getItem("mota_admin_token"))
          return current;
        const next = {
          ...current,
          permissions: response.data.data.permissions,
        };
        sessionStorage.setItem("mota_admin_staff", JSON.stringify(next));
        return next;
      });
    } catch {
      if (token === sessionStorage.getItem("mota_admin_token"))
        setStaff((current) =>
          current ? { ...current, permissions: [] } : null,
        );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 60000);
    return () => {
      window.removeEventListener("focus", update);
      clearInterval(timer);
    };
  }, [refresh]);
  const login = async (identifier: string, password: string) => {
    const result = await authApi.login(identifier, password);
    const { token, user } = result.data;
    sessionStorage.setItem("mota_admin_token", token);
    try {
      const [profile, access] = await Promise.all([
        authApi.me(),
        api.get("/reports/access/me"),
      ]);
      const u = profile.data?.user || profile.data?.data || profile.data;
      const permissions = access.data.data.permissions;
      if (!permissions.includes("admin:access"))
        throw Error("This account has no admin dashboard access.");
      const next = {
        id: user.id || u._id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || identifier,
        role: u.role || user.role,
        permissions,
      };
      sessionStorage.setItem("mota_admin_staff", JSON.stringify(next));
      setStaff(next);
    } catch (error) {
      logout();
      throw error;
    }
  };
  return (
    <AuthContext.Provider
      value={{
        staff,
        login,
        logout,
        refresh,
        can: (p) => staff?.permissions.includes(p) === true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error("useAuth must be used inside AuthProvider");
  return value;
}
