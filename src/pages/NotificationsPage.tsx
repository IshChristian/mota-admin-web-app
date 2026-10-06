import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsApi } from "../api";
import { useAuth } from "../auth";
import {
  buttonClass,
  secondaryButtonClass,
  PageHeader,
} from "../components/RemoteTable";

type Notice = {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: { supportCaseId?: string; audience?: string };
};
export function NotificationsPage() {
  const { staff, can } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notice[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [unread, setUnread] = useState(false),
    [busy, setBusy] = useState(false),
    [actionId, setActionId] = useState(""),
    [error, setError] = useState("");
  const generation = useRef(0),
    actionLock = useRef(false);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await notificationsApi.list(page, unread);
      if (current === generation.current) {
        setItems(response.data.data);
        setPages(Math.max(1, response.data.totalPages));
        if (page > Math.max(1, response.data.totalPages))
          setPage(Math.max(1, response.data.totalPages));
      }
    } catch (e) {
      if (current === generation.current)
        setError(
          axios.isAxiosError(e)
            ? e.response?.data?.message ||
                "Could not load notifications. Please retry."
            : "Could not load notifications. Please retry.",
        );
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, [page, unread, staff?.id]);
  useEffect(() => {
    setItems([]);
    void load();
    const tick = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    const timer = window.setInterval(tick, 30000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [load]);
  const mark = async (item: Notice, open = false) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionId(item._id);
    setError("");
    try {
      if (!item.read) await notificationsApi.markRead(item._id);
      window.dispatchEvent(new Event("mota:notifications"));
      const id = item.metadata?.supportCaseId;
      if (open && id && /^[a-f0-9]{24}$/i.test(id) && can("support:view"))
        navigate(`/support?caseId=${id}`);
      else await load();
    } catch {
      setError("Could not update this notification. Please retry.");
    } finally {
      actionLock.current = false;
      setActionId("");
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Your operational inbox. Open support alerts to review the related case."
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(event) => {
              setPage(1);
              setUnread(event.target.checked);
            }}
          />
          Unread only
        </label>
        <button
          className={secondaryButtonClass}
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/40 bg-red-950/30 p-4 text-red-200"
        >
          {error}{" "}
          <button className="ml-3 underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {busy && !items.length ? (
        <p role="status" className="text-slate-400">
          Loading notifications…
        </p>
      ) : !error && !items.length ? (
        <p className="rounded-xl border border-white/10 p-6 text-slate-400">
          {unread ? "No unread notifications." : "No notifications yet."}
        </p>
      ) : null}
      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item._id}
            className={`rounded-2xl border bg-panel p-5 ${item.read ? "border-white/10" : "border-lime/50"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-semibold">
                {item.title}
                {!item.read ? (
                  <span className="ml-3 rounded-full bg-lime/10 px-2 py-1 text-xs text-lime">
                    Unread
                  </span>
                ) : null}
              </h2>
              <time
                dateTime={item.createdAt}
                className="text-xs text-slate-500"
              >
                {new Date(item.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="my-3 whitespace-pre-wrap break-words text-sm text-slate-300">
              {item.message}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.metadata?.supportCaseId && can("support:view") ? (
                <button
                  className={buttonClass}
                  disabled={!!actionId}
                  onClick={() => void mark(item, true)}
                >
                  Open support case
                </button>
              ) : null}
              {!item.read ? (
                <button
                  className={secondaryButtonClass}
                  disabled={!!actionId}
                  onClick={() => void mark(item)}
                >
                  {actionId === item._id ? "Saving…" : "Mark as read"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={secondaryButtonClass}
          disabled={busy || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">
          Page {page} of {pages}
        </span>
        <button
          className={secondaryButtonClass}
          disabled={busy || page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
