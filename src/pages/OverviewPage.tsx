import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
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
  const [data, setData] = useState<Record<string, unknown>>({});
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [stats, operations] = await Promise.allSettled([adminApi.stats(), adminApi.operationsInsights()]);
    if (stats.status === "fulfilled") setData(stats.value.data.data || stats.value.data || {});
    if (operations.status === "fulfilled") setInsights(operations.value.data.data);
    if (stats.status === "rejected" || operations.status === "rejected") {
      const failure = stats.status === "rejected" ? stats.reason : operations.status === "rejected" ? operations.reason : null;
      setError(axios.isAxiosError(failure) ? String(failure.response?.data?.message || failure.message) : "Some live statistics are unavailable.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const groups = insights ? [
    ["Active rides", insights.activeRidesByStatus, "/rides"],
    ["Open support cases", insights.supportCasesByStatus, "/support"],
    ["Requests by source", insights.supportCasesBySource, "/support"],
    ["Driver KYC review", insights.driverKycByStatus, "/kyc"],
  ] as const : [];
  return <section>
    <PageHeader title="Operations overview" description="Live platform statistics and work awaiting staff review." action={<button onClick={() => void load()} className="rounded-xl border border-white/10 px-4 py-2">Refresh</button>} />
    {error ? <ErrorBanner message={error} retry={load} /> : null}
    {loading ? <p className="text-slate-400">Loading live statistics…</p> : null}
    {insights ? <div className="mb-6 rounded-2xl border border-white/10 bg-panel p-5"><p className="text-sm text-slate-400">Pending driver registrations</p><p className="mt-2 text-3xl font-semibold">{insights.pendingDriverRegistrations}</p><Link className="text-sm text-lime" to="/registrations">Review registrations</Link></div> : null}
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([title, values, destination]) => <article key={title} className="rounded-2xl border border-white/10 bg-panel p-5">
        <h2 className="font-semibold">{title} <span className="text-lime">{count(values)}</span></h2>
        <dl className="mt-4 grid grid-cols-2 gap-3">{Object.entries(values).map(([key, value]) => <div key={key}><dt className="text-sm capitalize text-slate-400">{label(key)}</dt><dd className="text-xl font-semibold">{value}</dd></div>)}</dl>
        {!Object.keys(values).length ? <p className="mt-3 text-sm text-slate-400">No items awaiting action.</p> : null}
        <Link className="mt-4 inline-block text-sm text-lime" to={destination}>Open queue</Link>
      </article>)}
    </div>
    <h2 className="mb-4 mt-8 text-lg font-semibold">Platform totals</h2>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data).map(([key, value]) => <div key={key} className="rounded-2xl border border-white/10 bg-panel p-5"><div className="text-sm capitalize text-slate-400">{label(key)}</div><div className="mt-5 break-words text-2xl font-semibold">{typeof value === "object" ? JSON.stringify(value) : String(value)}</div></div>)}</div>
  </section>;
}
