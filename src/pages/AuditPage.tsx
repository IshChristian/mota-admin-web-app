import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Bars,
  DataTable,
  ExportButtons,
  field,
  initialFilters,
  panel,
  Trend,
} from "../components/reports/ReportUI";
export function AuditPage() {
  const { can, staff } = useAuth();
  const permissionKey = staff?.permissions.join("|") || "";
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({
      ...initialFilters(),
      action: "",
      actorId: "",
      targetId: "",
      targetType: "",
    }),
    [draft, setDraft] = useState(filters),
    [page, setPage] = useState(1),
    [data, setData] = useState<any>(null),
    [charts, setCharts] = useState<any>(null),
    [selected, setSelected] = useState<any>(null),
    [investigation, setInvestigation] = useState<any>(null),
    [target, setTarget] = useState({
      type: params.get("targetType") || "User",
      id: params.get("targetId") || "",
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (!can("audit:view")) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setCharts(null);
    setSelected(null);
    setInvestigation(null);
    Promise.all([
      api.get("/reports/records/security", {
        params: { ...filters, page },
        signal: controller.signal,
      }),
      api.get("/reports/summary", {
        params: { from: filters.from, to: filters.to, section: "security" },
        signal: controller.signal,
        timeout: 60000,
      }),
    ])
      .then(([r, s]) => {
        setData(r.data.data);
        setCharts(s.data.data.sections.security);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || "Audit could not load.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, reload, permissionKey]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [selected]);
  if (!can("audit:view"))
    return (
      <p role="alert" className={panel}>
        Audit viewing permission is required.
      </p>
    );
  const investigate = async () => {
    setError("");
    setInvestigation(null);
    try {
      const response = await api.get(
        `/reports/investigate/${target.type}/${target.id}`,
        { params: { from: filters.from, to: filters.to }, timeout: 60000 },
      );
      setInvestigation(response.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || "Investigation could not load.");
    }
  };
  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-bold">Audit and investigations</h2>
      <p className="text-slate-400">
        Trace recorded actions, access decisions, exports and changes.
        Application audit records have no edit/delete controls. Sensitive fields
        require separate permission; secrets are always redacted.
      </p>
      <form
        className={`${panel} grid gap-3 sm:grid-cols-2 xl:grid-cols-4`}
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
          setPage(1);
        }}
      >
        {[
          ["from", "From (Kigali)"],
          ["to", "Through (Kigali)"],
          ["action", "Exact action"],
          ["actorId", "Actor ID"],
          ["targetType", "Target type"],
          ["targetId", "Target ID"],
          ["q", "Action search / record ID"],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              type={key === "from" || key === "to" ? "date" : "text"}
              value={(draft as any)[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className={field}
            />
          </label>
        ))}
        <button className="self-end rounded-lg bg-red-600 px-4 py-2 font-semibold">
          Apply audit filters
        </button>
      </form>
      <ExportButtons section="security" filters={filters} />
      {!can("audit:sensitive") ? (
        <p className="text-xs text-slate-400">
          Personal identifiers, IP addresses and free-text content are
          restricted in your view and exports.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-red-500 p-4">
          <p>{error}</p>
          <button
            className="mt-2 underline"
            onClick={() => setReload((v) => v + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      {loading ? <p role="status">Loading audit records…</p> : null}
      {charts ? (
        <>
          <p className="text-xs text-slate-400">
            Charts show all recorded events in the date period; actor/action
            filters apply to the list below.
          </p>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className={panel}>
              <h3 className="mb-4 font-semibold">Actions recorded</h3>
              <Bars
                rows={charts.breakdown || []}
                onPick={(action) => {
                  setFilters({ ...filters, action });
                  setDraft({ ...draft, action });
                  setPage(1);
                }}
              />
            </div>
            <div className={panel}>
              <h3 className="mb-3 font-semibold">Daily audit events</h3>
              <Trend rows={charts.daily || []} />
            </div>
          </div>
          <p className="text-xs text-slate-400">{charts.note}</p>
        </>
      ) : null}
      <div className={panel}>
        <h3 className="mb-4 text-lg font-semibold">
          Activity records · {data?.total || 0} matches
        </h3>
        <DataTable rows={data?.rows || []} onRow={setSelected} />
        <div className="mt-4 flex justify-between gap-3">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((v) => v - 1)}
            className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, data?.pages || 1)}
          </span>
          <button
            disabled={page >= (data?.pages || 1) || loading}
            onClick={() => setPage((v) => v + 1)}
            className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      <div className={panel}>
        <h3 className="mb-4 text-xl font-semibold">
          Linked record investigation
        </h3>
        <div className="flex flex-wrap gap-3">
          <label>
            Target type
            <select
              value={target.type}
              onChange={(e) => setTarget({ ...target, type: e.target.value })}
              className={field}
            >
              {["User", "Ride", "Transaction", "WithdrawalRequest"].map(
                (type) => (
                  <option key={type}>{type}</option>
                ),
              )}
            </select>
          </label>
          <label className="min-w-0 flex-1">
            Record ID
            <input
              value={target.id}
              onChange={(e) => setTarget({ ...target, id: e.target.value })}
              className={field}
            />
          </label>
          <button
            onClick={() => void investigate()}
            className="self-end rounded-lg bg-red-600 px-4 py-2"
          >
            Load timeline
          </button>
        </div>
        {investigation ? (
          <div className="mt-5 space-y-5">
            <p className="text-xs text-slate-400">
              Audit timeline: up to 200 events; related rides/transactions: up
              to 100 each, within the date window and your section permissions.
            </p>
            {Object.entries(investigation)
              .filter(([, rows]) => Array.isArray(rows))
              .map(([key, rows]) => (
                <div key={key}>
                  <h4 className="mb-3 capitalize">{key}</h4>
                  {key === "timeline" ? (
                    (rows as any[]).map((row) => (
                      <div
                        key={row._id}
                        className="mb-3 border-l-2 border-red-600 pl-4"
                      >
                        <p className="text-sm font-semibold">{row.action}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(row.timestamp).toLocaleString()} · Actor{" "}
                          {String(row.actorId || "System")}
                        </p>
                        <button
                          className="mt-2 text-sm text-red-300 underline"
                          onClick={() => setSelected(row)}
                        >
                          View change details
                        </button>
                      </div>
                    ))
                  ) : (
                    <DataTable rows={rows as any[]} />
                  )}
                </div>
              ))}
          </div>
        ) : null}
      </div>
      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Audit record details"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <section className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-white/20 bg-panel p-6">
            <div className="flex justify-between gap-4">
              <h3 className="text-xl font-bold">{selected.action}</h3>
              <button
                autoFocus
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/20 px-3 py-2"
              >
                Close
              </button>
            </div>
            <p className="my-4 text-sm text-slate-400">
              {selected.targetType} · {String(selected.targetId || "—")} ·{" "}
              {new Date(selected.timestamp).toLocaleString()}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                [
                  "Before",
                  selected.metadata?.before ?? selected.metadata?.previous,
                ],
                [
                  "After / changes",
                  selected.metadata?.after ??
                    selected.metadata?.changes ??
                    selected.metadata,
                ],
              ].map(([title, value]) => (
                <div
                  key={String(title)}
                  className="min-w-0 rounded-lg bg-black/30 p-4"
                >
                  <h4 className="mb-3 font-semibold">{String(title)}</h4>
                  <pre className="whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(value ?? "Not recorded", null, 2)}
                  </pre>
                </div>
              ))}
            </div>
            <details className="mt-5">
              <summary>Complete safe record</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </details>
          </section>
        </div>
      ) : null}
    </section>
  );
}
