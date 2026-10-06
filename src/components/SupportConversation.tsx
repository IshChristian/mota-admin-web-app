import { useEffect, useState, useRef } from "react";
import { adminApi } from "../api";
import { useAuth } from "../auth";
import { buttonClass, inputClass } from "./RemoteTable";
type Message = {
  text: string;
  authorType: string;
  internal?: boolean;
  notificationPending?: boolean;
  notificationRecordedAt?: string;
  createdAt: string;
};
type Case = {
  _id: string;
  subject: string;
  status: string;
  responseDueAt?: string;
  messages?: Message[];
  attachments?: Array<{ url: string; name: string }>;
};
export function SupportConversation({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const [item, setItem] = useState<Case | null>(null),
    [text, setText] = useState(""),
    [status, setStatus] = useState("in_progress"),
    [internal, setInternal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fetchError, setFetchError] = useState("");
  const statusDirty = useRef(false);
  const lock = useRef(false),
    generation = useRef(0),
    mounted = useRef(false);
  useEffect(() => {
    let active = true,
      initial = true;
    mounted.current = true;
    setItem(null);
    setText("");
    setError("");
    setFetchError("");
    statusDirty.current = false;
    const load = () => {
      if (document.visibilityState === "hidden" || lock.current) return;
      const request = ++generation.current;
      adminApi
        .supportCaseDetails(caseId)
        .then((res) => {
          if (!active || request !== generation.current) return;
          setItem(res.data.data);
          setFetchError("");
          if (initial || !statusDirty.current) {
            setStatus(res.data.data.status);
            initial = false;
          }
        })
        .catch(() => {
          if (active && request === generation.current)
            setFetchError("Could not refresh the support conversation.");
        });
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false;
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [caseId]);
  const submit = async () => {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await adminApi.replySupportCase(caseId, {
        text: text.trim(),
        internal,
        ...(!internal ? { status } : {}),
      });
      if (mounted.current) {
        generation.current++;
        setItem(res.data.data);
        statusDirty.current = false;
        setStatus(res.data.data.status);
        setText("");
        onChanged();
      }
    } catch {
      if (mounted.current)
        setError(
          "Could not save this reply. Check your connection and permission, then retry.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section className="my-5 rounded-2xl border border-white/10 bg-panel p-5">
      <h3 className="text-lg font-semibold">Support conversation</h3>
      {(error || fetchError) && (
        <p role="alert" className="mt-3 text-red-400">
          {error || fetchError}
        </p>
      )}
      {item ? (
        <>
          <p className="mt-2 text-sm text-slate-400">
            {item.subject} · {item.status.replaceAll("_", " ")}
            {item.responseDueAt
              ? ` · Target reply ${new Date(item.responseDueAt).toLocaleString()}`
              : ""}
          </p>
          {item.attachments?.map((file) => (
            <a
              key={file.url}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-lime underline"
            >
              Download {file.name}
            </a>
          ))}
          <div className="my-4 max-h-80 space-y-3 overflow-auto">
            {item.messages?.map((message, i) => (
              <article
                key={i}
                className="rounded-xl border border-white/10 p-3"
              >
                <p className="text-xs text-slate-400">
                  {message.authorType === "staff" ? "Staff" : "User"}
                  {message.internal ? " · Private staff note" : ""} ·{" "}
                  {new Date(message.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {message.text}
                </p>
                {message.authorType === "staff" &&
                !message.internal &&
                (message.notificationPending ||
                  message.notificationRecordedAt) ? (
                  <p className="mt-2 text-xs text-slate-400">
                    {message.notificationPending
                      ? "Inbox update queued — automatic retry is enabled."
                      : "Inbox update recorded."}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          {can("support:update") && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="space-y-3"
            >
              <label className="block text-sm">
                Reply or private note
                <textarea
                  required
                  maxLength={4000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className={`${inputClass} mt-2 min-h-28 w-full`}
                />
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(event) => setInternal(event.target.checked)}
                />
                Private staff note (hidden from the user)
              </label>
              <label className="block text-sm">
                Case status
                <select
                  disabled={internal}
                  value={status}
                  onChange={(event) => {
                    statusDirty.current = true;
                    setStatus(event.target.value);
                  }}
                  className={`${inputClass} ml-3`}
                >
                  {[
                    "open",
                    "in_progress",
                    "waiting",
                    "resolved",
                    "closed",
                    "reopened",
                  ].map((value) => (
                    <option className="bg-ink" key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy} className={buttonClass}>
                {busy
                  ? "Saving…"
                  : internal
                    ? "Save private note"
                    : "Send reply"}
              </button>
            </form>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Loading conversation…</p>
      )}
    </section>
  );
}
