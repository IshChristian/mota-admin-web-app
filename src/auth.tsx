import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, authApi } from "./api";

type Staff = { id: string; name: string; role: string; permissions: string[] };
/** Result of the password step: signed in, or a code from the authenticator app is still needed. */
export type LoginResult = { done: true } | { done: false; challenge: string };
type AuthValue = {
  staff: Staff | null;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  completeTwoFactor: (challenge: string, code: string) => Promise<void>;
  logout: (reason?: string) => void;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
  /** Why the last session ended (shown on the sign-in page), e.g. after inactivity. */
  signOutReason: string;
};

const IDLE_LIMIT_MS = 30 * 60 * 1000; // staff consoles sign out after 30 minutes without activity
const AuthContext = createContext<AuthValue | null>(null);

const stored = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem("mota_admin_staff") || "null");
    return user ? { ...user, permissions: [] } : null;
  } catch {
    return null;
  }
};

/** Session id inside the JWT, so signing out ends only this browser's session. */
export const currentSessionId = () => {
  try {
    const token = sessionStorage.getItem("mota_admin_token") || "";
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sid as string | undefined;
  } catch {
    return undefined;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(stored);
  const [signOutReason, setSignOutReason] = useState("");
  const lastActivity = useRef(Date.now());

  const logout = useCallback((reason = "") => {
    const sid = currentSessionId();
    if (sid) void api.delete(`/production/sessions/${sid}`).catch(() => {});
    sessionStorage.removeItem("mota_admin_token");
    sessionStorage.removeItem("mota_admin_staff");
    setSignOutReason(reason);
    setStaff(null);
  }, []);

  useEffect(() => {
    const expired = () => logout("Your session ended. Sign in again.");
    window.addEventListener("mota:session-expired", expired);
    return () => window.removeEventListener("mota:session-expired", expired);
  }, [logout]);

  // Inactivity sign-out: an unattended console shouldn't stay open.
  useEffect(() => {
    if (!staff) return;
    lastActivity.current = Date.now();
    const touch = () => { lastActivity.current = Date.now(); };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) logout("You were signed out after 30 minutes without activity.");
    }, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [staff, logout]);

  const refresh = useCallback(async () => {
    const token = sessionStorage.getItem("mota_admin_token");
    if (!token) return;
    try {
      const response = await api.get("/reports/access/me");
      setStaff((current) => {
        if (!current || token !== sessionStorage.getItem("mota_admin_token")) return current;
        const next = { ...current, permissions: response.data.data.permissions };
        sessionStorage.setItem("mota_admin_staff", JSON.stringify(next));
        return next;
      });
    } catch {
      if (token === sessionStorage.getItem("mota_admin_token"))
        setStaff((current) => (current ? { ...current, permissions: [] } : null));
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

  /** Stores the token, loads profile and permissions, and refuses accounts without console access. */
  const finishSignIn = async (token: string, fallbackName: string, user?: { id?: string; role?: string }) => {
    sessionStorage.setItem("mota_admin_token", token);
    try {
      const [profile, access] = await Promise.all([authApi.me(), api.get("/reports/access/me")]);
      const u = profile.data?.user || profile.data?.data || profile.data;
      const permissions = access.data.data.permissions;
      if (!permissions.includes("admin:access")) throw Error("This account has no admin dashboard access.");
      const next = {
        id: user?.id || u._id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || fallbackName,
        role: u.role || user?.role || "",
        permissions,
      };
      sessionStorage.setItem("mota_admin_staff", JSON.stringify(next));
      setSignOutReason("");
      setStaff(next);
    } catch (error) {
      logout();
      throw error;
    }
  };

  const login = async (identifier: string, password: string): Promise<LoginResult> => {
    const result = await authApi.login(identifier, password);
    if (result.data.require2FA) return { done: false, challenge: result.data.challenge };
    await finishSignIn(result.data.token, identifier, result.data.user);
    return { done: true };
  };

  const completeTwoFactor = async (challenge: string, code: string) => {
    const result = await authApi.verifyTwoFactor(challenge, code);
    await finishSignIn(result.data.token, "", result.data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        staff,
        login,
        completeTwoFactor,
        logout,
        refresh,
        signOutReason,
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
