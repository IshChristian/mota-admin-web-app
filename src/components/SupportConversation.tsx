import { useEffect, useState, useRef } from "react";
import { adminApi } from "../api";
import { useAuth } from "../auth";
import { buttonClass, inputClass } from "./RemoteTable";
type Message = {
  text: string;
  authorType: string;
  internal?: boolean;
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
    [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setItem(null);
    setText("");
    setError("");
    adminApi
      .supportCaseDetails(caseId)
      .then((res) => {
        if (active) {
          setItem(res.data.data);
          setStatus(res.data.data.status);
        }
      })
      .catch(() => {
        if (active) setError("Could not load the support conversation.");
      });
    return () => {
      active = false;
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
      setItem(res.data.data);
      setText("");
      onChanged();
    } catch {
      setError(
        "Could not save this reply. Check your connection and permission, then retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="my-5 rounded-2xl border border-white/10 bg-panel p-5">
      <h3 className="text-lg font-semibold">Support conversation</h3>
      {error && (
        <p role="alert" className="mt-3 text-red-400">
          {error}
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
                  onChange={(event) => setStatus(event.target.value)}
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
