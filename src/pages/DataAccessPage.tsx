import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { field, panel } from "../components/reports/ReportUI";
import { groups } from "../permissions";

const REPORTING = new Set<string>(groups.Reporting);
const SUPERADMIN_ONLY = ["data:access_manage", "access_request:approve"];
const labels: Record<string, string> = {
  "analytics:view": "Open data analysis",
  "analytics:users": "Users and onboarding",
  "analytics:rides": "Rides and driver performance",
  "analytics:finance": "Finance, withdrawals and reconciliation",
  "analytics:operations": "Referrals, demand, documents and support",
  "analytics:export": "Export allowed analysis sections",
  "audit:view": "Open audit and investigations",
  "audit:export": "Export audit records",
  "audit:sensitive": "View sensitive audit fields (secrets always redacted)",
  "data:access_manage": "Manage staff reporting access",
};
export function DataAccessPage() {
  const { can, staff, refresh } = useAuth();
  const [users, setUsers] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [permissions, setPermissions] = useState<string[]>([]),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [effective, setEffective] = useState<string[]>([]);
  useEffect(() => {
    if (!can("data:access_manage")) return;
    let active = true;
    setError("");
    api
      .get("/reports/access/users", { params: { q: search } })
      .then((r) => {
        if (active) setUsers(r.data.data);
      })
      .catch((e) => {
        if (active)
          setError(e.response?.data?.message || "Staff list could not load.");
      });
    return () => {
      active = false;
    };
  }, [search, reload, can("data:access_manage")]);
  if (!can("data:access_manage"))
    return (
      <div role="alert" className={panel}>
        Reporting access management permission is required. The superadmin can
        grant it.
      </div>
    );
  const toggle = (key: string) => {
    setPermissions((current) => {
      const next = current.includes(key)
        ? current.filter((p) => p !== key)
        : [...current, key];
      if (
        /^analytics:(users|rides|finance|operations|export)$/.test(key) &&
        next.includes(key) &&
        !next.includes("analytics:view")
      )
        next.push("analytics:view");
      if (
        ["audit:export", "audit:sensitive"].includes(key) &&
        next.includes(key) &&
        !next.includes("audit:view")
      )
        next.push("audit:view");
      return next;
    });
  };
  // Everything except reporting (handled above): differences from the role become per-person grants/removals.
  const roleBase: string[] = selected?.rolePermissions || [];
  const grants = effective.filter((p) => !REPORTING.has(p) && !roleBase.includes(p));
  const revokes = roleBase.filter((p) => !REPORTING.has(p) && !effective.includes(p));
  const flip = (key: string) => setEffective((current) => (current.includes(key) ? current.filter((p) => p !== key) : [...current, key]));
  const savePermissions = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/reports/access/users/${selected._id}/permissions`, { grants, revokes });
      setSuccess("Permissions saved. The person's next request uses them.");
      setReload((v) => v + 1);
      if (selected._id === staff?.id) await refresh();
    } catch (e: any) {
      setError(e.response?.data?.message || "Could not save permissions.");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/reports/access/users/${selected._id}`, { permissions });
      setSuccess(
        "Reporting access saved. Other users refresh their dashboard or return to the tab to see updated access.",
      );
      setReload((v) => v + 1);
      if (selected._id === staff?.id) await refresh();
    } catch (e: any) {
      setError(e.response?.data?.message || "Could not save access.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-bold">Data access management</h2>
      <p className="text-slate-400">
        Assign reporting permissions directly to existing staff accounts. Role
        permissions remain the default until an individual override is saved.
        Saving an empty selection removes reporting access; other account
        permissions are unchanged.
      </p>
      {can("role:view") ? (
        <Link to="/roles" className="text-red-300 underline">
          Manage role permissions and role assignment
        </Link>
      ) : null}
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
        }}
      >
        <label className="flex-1 text-sm">
          Find staff by name
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={field}
          />
        </label>
        <button className="self-end rounded-lg bg-red-600 px-4 py-2">
          Search
        </button>
      </form>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-950 p-4 text-red-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className={panel}>
          {success}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {users.map((u) => (
            <button
              key={u._id}
              onClick={() => {
                setSelected(u);
                setPermissions(u.permissions || []);
                setEffective(u.allPermissions || []);
                setSuccess("");
              }}
              className={`${panel} w-full text-left ${selected?._id === u._id ? "border-red-500" : ""}`}
            >
              <b>
                {u.firstName} {u.lastName}
              </b>
              <p className="text-sm text-slate-400">
                {u.role} · {u.isActive ? "Active" : "Inactive"}
              </p>
            </button>
          ))}
          <p className="text-xs text-slate-400">
            Up to 50 staff results. Narrow your search if needed. Superadmin
            ownership permissions cannot be removed here.
          </p>
        </aside>
        <div className={panel}>
          {selected ? (
            <>
              <h3 className="text-xl font-semibold">
                {selected.firstName} {selected.lastName}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Only permissions you hold can be delegated. Sensitive fields and
                exports have separate controls.
              </p>
              <div className="my-5 grid gap-3 sm:grid-cols-2">
                {Object.entries(labels).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 rounded-lg border border-white/10 p-4"
                  >
                    <input
                      type="checkbox"
                      disabled={
                        busy ||
                        !can(key) ||
                        (key === "data:access_manage" &&
                          staff?.role !== "superadmin" &&
                          !permissions.includes(key))
                      }
                      checked={permissions.includes(key)}
                      onChange={() => toggle(key)}
                    />
                    <span>
                      <span className="block text-sm">{label}</span>
                      <code className="text-xs text-slate-500">{key}</code>
                    </span>
                  </label>
                ))}
              </div>
              <button
                disabled={busy}
                onClick={() => void save()}
                className="rounded-lg bg-red-600 px-5 py-3 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save reporting access"}
              </button>
              <h4 className="mt-10 text-lg font-semibold">All permissions</h4>
              <p className="mt-1 text-sm text-slate-400">
                Ticked = this person can do it. Changes from their role (
                <b>{selected.role}</b>) apply to this person only:{" "}
                <span className="text-lime">{grants.length} added</span>,{" "}
                <span className="text-red-300">{revokes.length} removed</span>.
                Create, update and delete stay off unless you tick them; staff
                can also ask for one action through Request access.
              </p>
              {Object.entries(groups)
                .filter(([group]) => group !== "Reporting")
                .map(([group, list]) => (
                  <fieldset key={group} className="mt-5">
                    <legend className="text-sm font-bold">{group}</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {list
                        .filter((key) => !REPORTING.has(key))
                        .map((key) => {
                          const on = effective.includes(key);
                          const changed = on !== roleBase.includes(key);
                          const locked =
                            busy ||
                            (staff?.role !== "superadmin" &&
                              (SUPERADMIN_ONLY.includes(key) || !can(key)));
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${changed ? "border-lime/60" : "border-white/10"}`}
                            >
                              <input type="checkbox" disabled={locked} checked={on} onChange={() => flip(key)} />
                              <code className="break-all text-xs">{key}</code>
                              {changed ? (
                                <span className="ml-auto text-xs text-lime">
                                  {on ? "added" : "removed"}
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                    </div>
                  </fieldset>
                ))}
              <button
                disabled={busy}
                onClick={() => void savePermissions()}
                className="mt-6 rounded-lg bg-red-600 px-5 py-3 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save permissions"}
              </button>
            </>
          ) : (
            <p>Select a staff account to configure its access.</p>
          )}
        </div>
      </div>
    </section>
  );
}
