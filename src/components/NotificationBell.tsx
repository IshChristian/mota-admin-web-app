import { Bell } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { notificationsApi } from "../api";
import { useAuth } from "../auth";

export function NotificationBell() {
  const { staff } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const request = ++generation.current;
    try {
      const response = await notificationsApi.unread(signal);
      if (!signal.aborted && request === generation.current) {
        setCount(response.data.totalItems);
        setFailed(false);
      }
    } catch {
      if (!signal.aborted && request === generation.current) {
        setCount(null);
        setFailed(true);
      }
    }
  }, []);
  useEffect(() => {
    if (!staff) return;
    const controller = new AbortController();
    setCount(null);
    setFailed(false);
    const tick = () => {
      if (document.visibilityState !== "hidden")
        void refresh(controller.signal);
    };
    tick();
    const timer = window.setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    window.addEventListener("mota:notifications", tick);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener("mota:notifications", tick);
    };
  }, [staff?.id, refresh]);
  return (
    <Link
      to="/notifications"
      aria-label={
        failed
          ? "Notifications, unread count unavailable"
          : `Notifications${count !== null ? `, ${count} unread` : ""}`
      }
      className="relative rounded-xl border border-white/10 p-2.5"
    >
      <Bell size={18} />
      {count !== null && count > 0 ? (
        <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-500 px-1 text-center text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : failed ? (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 h-2 w-2 rounded-full bg-amber-400"
        />
      ) : null}
    </Link>
  );
}
