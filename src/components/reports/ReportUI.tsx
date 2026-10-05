import { useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
export const panel = "rounded-2xl border border-white/10 bg-panel p-5 min-w-0";
export const field =
  "rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white w-full";
export type Filters = {
  from: string;
  to: string;
  role: string;
  status: string;
  q: string;
  compare: string;
};
const kigaliDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const initialFilters = (): Filters => ({
  from: kigaliDate(new Date(Date.now() - 29 * 86400000)),
  to: kigaliDate(new Date()),
  role: "",
  status: "",
  q: "",
  compare: "false",
});
export function FilterForm({
  value,
  onApply,
  users = false,
}: {
  value: Filters;
  onApply: (f: Filters) => void;
  users?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className={`${panel} grid gap-3 sm:grid-cols-2 xl:grid-cols-6`}
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <label className="text-sm">
        From (Kigali)
        <input
          type="date"
          required
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          className={field}
        />
      </label>
      <label className="text-sm">
        Through (Kigali)
        <input
          type="date"
          required
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          className={field}
        />
      </label>
      {users ? (
        <label className="text-sm">
          Account type
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className={field}
          >
            <option value="">All</option>
            <option value="driver">Driver</option>
            <option value="client">Passenger</option>
            <option value="agent">Agent</option>
            {[
              "admin",
              "superadmin",
              "financial",
              "caller_support",
              "manager",
              "moderator",
            ].map((role) => (
              <option key={role} value={role}>
                {role.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-sm">
        Detail status
        <input
          placeholder="All statuses"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          className={field}
        />
      </label>
      <label className="text-sm">
        Record / user ID
        <input
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          maxLength={100}
          className={field}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.compare === "true"}
          onChange={(e) =>
            setDraft({ ...draft, compare: String(e.target.checked) })
          }
        />
        Compare previous period
      </label>
      <button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white">
        Apply filters
      </button>
      <p className="text-xs text-slate-400 sm:col-span-2 xl:col-span-6">
        Maximum 366 days. Charts summarize the date/account cohort. Status and
        ID search narrow the detail list and export detail rows.
      </p>
    </form>
  );
}
export function ExportButtons({
  section,
  filters,
}: {
  section: string;
  filters: Record<string, unknown>;
}) {
  const { can } = useAuth();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const allowed = can(
    section === "security" ? "audit:export" : "analytics:export",
  );
  const download = async (format: string) => {
    setBusy(format);
    setError("");
    try {
      const response = await api.get(`/reports/export/${section}/${format}`, {
        params: filters,
        responseType: "blob",
        timeout: 120000,
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mota-${section}-${kigaliDate(new Date())}.${format}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      let message = "Export failed. Please retry.";
      try {
        const body = JSON.parse(await e.response.data.text());
        message = body.message || message;
      } catch {}
      setError(message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {["pdf", "xlsx"].map((format) => (
          <button
            key={format}
            disabled={!allowed || Boolean(busy)}
            onClick={() => void download(format)}
            className="rounded-lg border border-red-400/50 px-4 py-2 text-sm disabled:opacity-40"
          >
            {busy === format
              ? "Generating…"
              : format === "pdf"
                ? "Export PDF"
                : "Export spreadsheet (.xlsx)"}
          </button>
        ))}
      </div>
      {!allowed ? (
        <p className="text-xs text-slate-400">Export permission is required.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-slate-400">
        Exports include all summary tables and up to 2,000 matching detail
        records; totals and the limit appear in the file.
      </p>
    </div>
  );
}
const stringify = (v: unknown): string =>
  v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
export function DataTable({
  rows,
  onRow,
}: {
  rows: Record<string, unknown>[];
  onRow?: (r: Record<string, unknown>) => void;
}) {
  const [sort, setSort] = useState(""),
    [asc, setAsc] = useState(true);
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const sorted = sort
    ? [...rows].sort((a, b) => {
        const x = a[sort],
          y = b[sort];
        return (
          (asc ? 1 : -1) *
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : stringify(x).localeCompare(stringify(y)))
        );
      })
    : rows;
  if (!rows.length)
    return (
      <p className="py-6 text-slate-400">No records match this selection.</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((key) => (
              <th key={key} className="border-b border-white/20 px-3 py-3">
                <button
                  onClick={() => {
                    setAsc(sort === key ? !asc : true);
                    setSort(key);
                  }}
                  className="whitespace-nowrap"
                >
                  {key.replaceAll("_", " ")}{" "}
                  {sort === key ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
            ))}
            {onRow ? <th>Details</th> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr
              key={String(row._id || index)}
              className="border-b border-white/5 hover:bg-white/5"
            >
              {columns.map((key) => (
                <td
                  key={key}
                  className="max-w-[360px] break-words px-3 py-3 align-top"
                >
                  {stringify(row[key]).slice(0, 400)}
                  {stringify(row[key]).length > 400 ? "…" : ""}
                </td>
              ))}
              {onRow ? (
                <td>
                  <button
                    className="rounded-lg border border-red-400/50 px-3 py-2"
                    onClick={() => onRow(row)}
                  >
                    Investigate
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">
        Sorting applies to this loaded page. Long values are shortened here;
        investigation displays the complete safe metadata.
      </p>
    </div>
  );
}
export function Bars({
  rows,
  onPick,
  label = "Count",
}: {
  rows: any[];
  onPick?: (key: string) => void;
  label?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r.count || 0)));
  return (
    <div className="space-y-3">
      {rows.slice(0, 24).map((r, i) => (
        <button
          key={String(r._id ?? i)}
          className="block w-full text-left"
          disabled={!onPick}
          onClick={() => onPick?.(String(r._id))}
        >
          <div className="flex justify-between gap-3 text-sm">
            <span className="break-all">
              {typeof r._id === "object"
                ? JSON.stringify(r._id)
                : String(r._id ?? "Unknown")}
            </span>
            <span>{Number(r.count || 0).toLocaleString()}</span>
          </div>
          <div className="mt-1 h-3 rounded bg-white/10">
            <div
              className="h-full rounded bg-red-600"
              style={{ width: `${(100 * Number(r.count || 0)) / max}%` }}
            />
          </div>
        </button>
      ))}
      {!rows.length ? <p className="text-slate-400">No chart data.</p> : null}
      <p className="text-xs text-slate-400">
        {label} · maximum 24 categories · select a category to filter details
        when enabled.
      </p>
    </div>
  );
}
export function Trend({ rows }: { rows: any[] }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.count || 0)));
  const points = rows
    .map(
      (r, i) =>
        `${30 + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * 640)},${180 - (Number(r.count || 0) / max) * 150}`,
    )
    .join(" ");
  return (
    <>
      <svg
        viewBox="0 0 700 220"
        className="w-full"
        role="img"
        aria-label="Daily record count trend"
      >
        <line x1="30" y1="180" x2="670" y2="180" stroke="#666" />
        <text x="5" y="30" fill="#ccc" fontSize="12">
          {max}
        </text>
        <text x="12" y="180" fill="#ccc" fontSize="12">
          0
        </text>
        <polyline
          points={points}
          stroke="#dc2626"
          fill="none"
          strokeWidth="3"
        />
        {rows.map((r, i) => (
          <circle
            key={i}
            cx={30 + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * 640)}
            cy={180 - (Number(r.count || 0) / max) * 150}
            r="4"
            fill="#fff"
          >
            <title>
              {r._id}: {r.count}
            </title>
          </circle>
        ))}
        <text x="30" y="210" fill="#ccc" fontSize="12">
          {rows[0]?._id || "No data"}
        </text>
        <text x="580" y="210" fill="#ccc" fontSize="12">
          {rows.at(-1)?._id || ""}
        </text>
      </svg>
      <details>
        <summary className="cursor-pointer text-sm text-slate-400">
          View daily values
        </summary>
        <DataTable rows={rows} />
      </details>
    </>
  );
}
export function Donut({ rows }: { rows: any[] }) {
  const total = rows.reduce((s, r) => s + Number(r.count || 0), 0);
  let offset = 0;
  const colors = [
    "#dc2626",
    "#fff",
    "#9ca3af",
    "#7f1d1d",
    "#fca5a5",
    "#4b5563",
  ];
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        role="img"
        aria-label="Category share"
      >
        <circle
          cx="80"
          cy="80"
          r="60"
          fill="none"
          stroke="#333"
          strokeWidth="20"
        />
        {rows.map((r, i) => {
          const length = total ? (Number(r.count || 0) / total) * 377 : 0,
            start = offset;
          offset += length;
          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r="60"
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="20"
              strokeDasharray={`${length} ${377 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 80 80)"
            >
              <title>
                {String(r._id)}: {r.count}
              </title>
            </circle>
          );
        })}
        <text x="80" y="86" fill="white" textAnchor="middle" fontSize="20">
          {total}
        </text>
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {rows.map((r, i) => (
          <p key={i} className="break-words text-sm">
            <span
              style={{ background: colors[i % colors.length] }}
              className="mr-2 inline-block h-3 w-3 rounded"
            />
            {String(r._id)} · {total ? ((100 * r.count) / total).toFixed(1) : 0}
            %
          </p>
        ))}
      </div>
    </div>
  );
}
export function WorkflowDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 690 160"
        className="min-w-[550px] w-full"
        role="img"
        aria-label="Registration workflow: register, phone verification, KYC, passenger activation; drivers also pay registration and receive approval"
      >
        {["Register", "Phone verified", "KYC approved", "Passenger active"].map(
          (label, i) => (
            <g key={label}>
              <rect
                x={i * 170 + 5}
                y="10"
                width="150"
                height="40"
                rx="10"
                fill={i === 3 ? "#dc2626" : "#222"}
                stroke="#aaa"
              />
              <text
                x={i * 170 + 80}
                y="35"
                textAnchor="middle"
                fill="white"
                fontSize="12"
              >
                {label}
              </text>
              {i < 3 ? (
                <path d={`M${i * 170 + 155} 30 h20`} stroke="#aaa" />
              ) : null}
            </g>
          ),
        )}
        <path d="M420 50 V95 H505" stroke="#aaa" fill="none" />
        <rect
          x="505"
          y="75"
          width="180"
          height="60"
          rx="10"
          fill="#222"
          stroke="#dc2626"
        />
        <text x="595" y="99" textAnchor="middle" fill="white" fontSize="12">
          Driver: fee + approval
        </text>
        <text x="595" y="119" textAnchor="middle" fill="#bbb" fontSize="11">
          Passenger fee: none
        </text>
      </svg>
    </div>
  );
}
