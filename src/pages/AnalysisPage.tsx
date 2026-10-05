import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Bars,
  DataTable,
  Donut,
  ExportButtons,
  FilterForm,
  initialFilters,
  panel,
  Trend,
  WorkflowDiagram,
  type Filters,
} from "../components/reports/ReportUI";
const sections = [
  ["users", "Users & onboarding", "analytics:users"],
  ["rides", "Rides", "analytics:rides"],
  ["drivers", "Driver performance", "analytics:rides"],
  ["finance", "Financial analysis", "analytics:finance"],
  ["withdrawals", "Withdrawals", "analytics:finance"],
  ["referrals", "Referrals", "analytics:operations"],
  ["demand", "Demand & locations", "analytics:operations"],
  ["support", "Support & safety", "analytics:operations"],
  ["documents", "Documents & KYC", "analytics:operations"],
  ["security", "Security events", "audit:view"],
  ["quality", "Data quality", "analytics:finance"],
] as const;
export function AnalysisPage() {
  const { can, staff } = useAuth();
  const permissionKey = staff?.permissions.join("|") || "";
  const allowed = sections.filter(([, , permission]) => can(permission));
  const [section, setSection] = useState("users"),
    [filters, setFilters] = useState<Filters>(initialFilters),
    [data, setData] = useState<any>(null),
    [list, setList] = useState<any>(null),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const active = allowed.some((s) => s[0] === section)
    ? section
    : allowed[0]?.[0];
  useEffect(() => {
    if (!can("analytics:view") || !active) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setList(null);
    Promise.all([
      api.get("/reports/summary", {
        params: { ...filters, section: active },
        signal: controller.signal,
        timeout: 60000,
      }),
      api.get(`/reports/records/${active}`, {
        params: { ...filters, page },
        signal: controller.signal,
        timeout: 60000,
      }),
    ])
      .then(([summary, records]) => {
        setData(summary.data.data);
        setList(records.data.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e.response?.data?.message || "Report could not load. Please retry.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, filters, page, reload, permissionKey]);
  if (!can("analytics:view"))
    return (
      <div role="alert" className={panel}>
        You need analytics:view and a report-section permission. Ask an
        authorized access manager.
      </div>
    );
  const report = data?.sections?.[active || ""];
  const pick = (key: string) => {
    if (active === "users") setFilters({ ...filters, role: key });
    else if (
      ["rides", "withdrawals", "referrals", "support"].includes(active || "")
    )
      setFilters({ ...filters, status: key });
    else if (active === "security") setFilters({ ...filters, q: key });
    else if (active === "drivers") setFilters({ ...filters, q: key });
    else return;
    setPage(1);
  };
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">MOTA data analysis</h2>
          <p className="mt-2 text-slate-400">
            Live reports with clear definitions, drill-down records and
            controlled exports.
          </p>
        </div>
        {can("data:access_manage") ? (
          <Link className="rounded-lg bg-red-600 px-4 py-2" to="/data-access">
            Manage data access
          </Link>
        ) : null}
      </div>
      <nav aria-label="Report sections" className="flex flex-wrap gap-2">
        {allowed.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={active === key}
            onClick={() => {
              setSection(key);
              setPage(1);
              setFilters({ ...filters, status: "", q: "", role: "" });
            }}
            className={`rounded-lg border px-4 py-2 text-sm ${active === key ? "border-red-500 bg-red-600 text-white" : "border-white/20 bg-panel"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {!active ? (
        <p>No report sections have been assigned to you.</p>
      ) : (
        <>
          <FilterForm
            key={JSON.stringify(filters)}
            value={filters}
            users={active === "users"}
            onApply={(f) => {
              setFilters(f);
              setPage(1);
            }}
          />
          {error ? (
            <div role="alert" className={`${panel} border-red-500/50`}>
              <p>{error}</p>
              <button
                className="mt-3 underline"
                onClick={() => setReload((v) => v + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}
          {loading ? (
            <p role="status">Loading report and detail records…</p>
          ) : null}
          {report && (
            <>
              <div className="flex flex-wrap justify-between gap-4">
                <p className="text-sm text-slate-400">
                  Updated {new Date(data.generatedAt).toLocaleString()} ·{" "}
                  {data.period.timezone}
                </p>
                <ExportButtons section={active} filters={filters} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(report.cards || {}).map(([label, value]) => (
                  <div key={label} className={panel}>
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-3 break-words text-3xl font-bold">
                      {value == null ? "—" : Number(value).toLocaleString()}
                    </p>
                    {report.previousCards && !label.includes("now") ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Previous period:{" "}
                        {Number(
                          report.previousCards[label] || 0,
                        ).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className={`${panel} border-red-500/30`}>
                <h3 className="font-semibold">Definitions and coverage</h3>
                <p className="mt-2 text-sm text-slate-300">{report.note}</p>
                {data.coverage.map((note: string) => (
                  <p key={note} className="mt-1 text-xs text-slate-400">
                    {note}
                  </p>
                ))}
              </div>
              {active === "users" ? (
                <div className={panel}>
                  <h3 className="mb-3 text-lg font-semibold">
                    Verification workflow
                  </h3>
                  <WorkflowDiagram />
                  <Bars
                    rows={Object.entries(report.funnel || {})
                      .filter(([key]) => key !== "_id")
                      .map(([key, count]) => ({ _id: key, count }))}
                    label="Current verification states for the selected registration cohort"
                  />
                </div>
              ) : null}
              <div className="grid gap-5 xl:grid-cols-2">
                {report.breakdown ? (
                  <div className={panel}>
                    <h3 className="mb-5 text-lg font-semibold">
                      {active === "demand"
                        ? "Requests by Kigali hour"
                        : "Category counts"}
                    </h3>
                    <Bars
                      rows={report.breakdown}
                      onPick={
                        [
                          "users",
                          "rides",
                          "drivers",
                          "withdrawals",
                          "referrals",
                          "support",
                          "security",
                        ].includes(active)
                          ? pick
                          : undefined
                      }
                    />
                  </div>
                ) : null}
                {report.daily ? (
                  <div className={panel}>
                    <h3 className="mb-3 text-lg font-semibold">
                      Daily trend · records
                    </h3>
                    <Trend rows={report.daily} />
                  </div>
                ) : report.breakdown ? (
                  <div className={panel}>
                    <h3 className="mb-5 text-lg font-semibold">
                      Category share
                    </h3>
                    <Donut rows={report.breakdown.slice(0, 10)} />
                    <p className="mt-2 text-xs text-slate-400">
                      Share of the shown categories only (maximum 10).
                    </p>
                  </div>
                ) : null}
              </div>
              {["finance", "withdrawals"].includes(active) &&
              report.breakdown ? (
                <div className={panel}>
                  <h3 className="mb-4 text-lg font-semibold">
                    Amounts by category (RWF)
                  </h3>
                  <DataTable rows={report.breakdown} />
                </div>
              ) : null}
              {active === "demand" && report.cells ? (
                <div className={panel}>
                  <h3 className="mb-4 text-lg font-semibold">
                    Aggregated demand map
                  </h3>
                  <DemandMap cells={report.cells} />
                  <DataTable
                    rows={report.cells.map((r: any) => ({
                      latitudeCell: r._id.lat,
                      longitudeCell: r._id.lng,
                      bookings: r.count,
                    }))}
                  />
                </div>
              ) : null}
              {Object.entries(report)
                .filter(
                  ([key, value]) =>
                    Array.isArray(value) &&
                    !["breakdown", "daily", "cells"].includes(key),
                )
                .map(([key, rows]) => (
                  <div key={key} className={panel}>
                    <h3 className="mb-4 text-lg font-semibold capitalize">
                      {key}
                    </h3>
                    <DataTable
                      rows={rows as any[]}
                      onRow={
                        can("audit:view")
                          ? (row) => {
                              const id = String(row.userId || row._id || "");
                              if (/^[a-f0-9]{24}$/i.test(id))
                                window.location.assign(
                                  `/audit?targetType=User&targetId=${id}`,
                                );
                            }
                          : undefined
                      }
                    />
                  </div>
                ))}
              <div className={panel}>
                <h3 className="mb-4 text-xl font-semibold">
                  Filtered detail records
                </h3>
                <p className="mb-3 text-xs text-slate-400">
                  Status / ID search: {filters.status || "all statuses"} ·{" "}
                  {filters.q || "all IDs"} · {list?.total || 0} matching records
                </p>
                <DataTable rows={list?.rows || []} />
                {list?.note ? (
                  <p className="text-slate-400">{list.note}</p>
                ) : null}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    disabled={page === 1 || loading}
                    onClick={() => setPage((v) => v - 1)}
                    className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {Math.max(1, list?.pages || 1)}
                  </span>
                  <button
                    disabled={page >= (list?.pages || 1) || loading}
                    onClick={() => setPage((v) => v + 1)}
                    className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
function DemandMap({ cells }: { cells: any[] }) {
  if (!cells.length)
    return (
      <p className="text-slate-400">No cells meet the minimum of 5 bookings.</p>
    );
  const lats = cells.map((c) => c._id.lat),
    lngs = cells.map((c) => c._id.lng),
    minLat = Math.min(...lats),
    maxLat = Math.max(...lats),
    minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs),
    maxCount = Math.max(...cells.map((c) => c.count));
  return (
    <svg
      viewBox="0 0 700 360"
      className="w-full rounded-lg bg-black/30"
      role="img"
      aria-label="Pickup demand cells, longitude horizontally and latitude vertically"
    >
      <text x="20" y="25" fill="#ccc" fontSize="12">
        Latitude vs longitude · aggregated cells · no individual locations
      </text>
      {cells.map((c, i) => (
        <circle
          key={i}
          cx={
            40 + ((c._id.lng - minLng) / Math.max(0.01, maxLng - minLng)) * 620
          }
          cy={
            310 - ((c._id.lat - minLat) / Math.max(0.01, maxLat - minLat)) * 260
          }
          r={5 + Math.sqrt(c.count / maxCount) * 20}
          fill="#dc2626"
          fillOpacity="0.65"
        >
          <title>
            {c._id.lat}, {c._id.lng}: {c.count} bookings
          </title>
        </circle>
      ))}
      <text x="30" y="345" fill="#ccc" fontSize="12">
        Longitude {minLng.toFixed(2)} to {maxLng.toFixed(2)} · Latitude{" "}
        {minLat.toFixed(2)} to {maxLat.toFixed(2)}
      </text>
    </svg>
  );
}
