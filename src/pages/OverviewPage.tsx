import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../auth";
import { adminApi } from "../api";
import { ErrorBanner, PageHeader } from "../components/RemoteTable";

type Insights = {
  activeRidesByStatus: Record<string, number>;
  driverKycByStatus: Record<string, number>;
  pendingDriverRegistrations: number;
  supportCasesByStatus: Record<string, number>;
  supportCasesBySource: Record<string, number>;
};
const label = (key: string) => key.replace(/([A-Z_])/g, " $1").replaceAll("_", " ");
const count = (items: Record<string, number>) => Object.values(items).reduce((sum, value) => sum + value, 0);

export function OverviewPage() {
  const { can } = useAuth();
  const analyticsAllowed = can("analytics:view");
  const requestVersion = useRef(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!analyticsAllowed) { setData({}); setInsights(null); setUpdatedAt(null); setLoading(false); setError(""); return; }
    setLoading(true);
    setError("");
    const [stats, operations] = await Promise.allSettled([adminApi.stats(), adminApi.operationsInsights()]);
    if (version !== requestVersion.current) return;
    if (stats.status === "rejected") setData({});
    if (operations.status === "rejected") setInsights(null);
    if (stats.status === "fulfilled") setData(stats.value.data.data || stats.value.data || {});
    if (operations.status === "fulfilled") setInsights(operations.value.data.data);
    if (stats.status === "rejected" || operations.status === "rejected") {
      const failure = stats.status === "rejected" ? stats.reason : operations.status === "rejected" ? operations.reason : null;
      setError(axios.isAxiosError(failure) ? String(failure.response?.data?.message || failure.message) : "Some live statistics are unavailable.");
    }
    setUpdatedAt(new Date());
    setLoading(false);
  }, [analyticsAllowed]);
  useEffect(() => { void load(); return () => { requestVersion.current++; }; }, [load]);
  const groups = insights ? [
    ["Active rides", insights.activeRidesByStatus, "/rides", "ride:view"],
    ["Open support cases", insights.supportCasesByStatus, "/support", "support:view"],
    ["Requests by source", insights.supportCasesBySource, "/support", "support:view"],
    ["Driver KYC review", insights.driverKycByStatus, "/kyc", "kyc:view"],
  ] as const : [];
  if (!analyticsAllowed) return <section><PageHeader title="Operations overview" description="Analytics access is required to view platform statistics." /><p className="text-slate-400">Use the available navigation pages for your assigned work. Ask an authorized administrator to assign analytics access if needed.</p></section>;
  return <section>
    <PageHeader title="Operations overview" description="Live platform statistics and work awaiting staff review." action={<button disabled={loading} onClick={() => void load()} className="rounded-xl border border-white/10 px-4 py-2">Refresh</button>} />
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    {updatedAt ? <p role="status" className="mb-4 text-sm text-slate-400">Last refresh attempt: {updatedAt.toLocaleTimeString()}{error ? " · some data unavailable" : ""}</p> : null}
    {loading ? <p className="text-slate-400">Loading live statistics…</p> : null}
    {insights ? <div className="mb-6 rounded-2xl border border-white/10 bg-panel p-5"><p className="text-sm text-slate-400">Pending driver registrations</p><p className="mt-2 text-3xl font-semibold">{insights.pendingDriverRegistrations}</p>{can("registration:view") && can("user:view") ? <Link className="text-sm text-lime" to="/registrations">Review registrations</Link> : null}</div> : null}
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([title, values, destination, permission]) => <article key={title} className="rounded-2xl border border-white/10 bg-panel p-5">
        <h2 className="font-semibold">{title} <span className="text-lime">{count(values)}</span></h2>
        <dl className="mt-4 grid grid-cols-2 gap-3">{Object.entries(values).map(([key, value]) => <div key={key}><dt className="text-sm capitalize text-slate-400">{label(key)}</dt><dd className="text-xl font-semibold">{value}</dd></div>)}</dl>
        {!Object.keys(values).length ? <p className="mt-3 text-sm text-slate-400">No items awaiting action.</p> : null}
        {can(permission) ? <Link className="mt-4 inline-block text-sm text-lime" to={destination}>Open queue</Link> : <p className="mt-4 text-sm text-slate-400">Queue access is not assigned to your account.</p>}
      </article>)}
    </div>
    <h2 className="mb-4 mt-8 text-lg font-semibold">Platform totals</h2>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data).map(([key, value]) => <div key={key} className="rounded-2xl border border-white/10 bg-panel p-5"><div className="text-sm capitalize text-slate-400">{label(key)}</div><div className="mt-5 break-words text-2xl font-semibold">{typeof value === "object" ? JSON.stringify(value) : String(value)}</div></div>)}</div>
  </section>;
}
