import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { adminApi } from "../api";
import { useAuth } from "../auth";
import {
  ErrorBanner,
  PageHeader,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "../components/RemoteTable";
type Point = {
  latitude?: number;
  longitude?: number;
  address?: string;
  name?: string;
};
type Person = {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  lastLocation?: Point;
  lastLocationAt?: string;
};
type Ride = {
  _id: string;
  passengerId?: Person;
  driverId?: Person;
  rideStatus: string;
  paymentStatus?: string;
  paymentMethod?: string;
  fare?: number;
  offeredFare?: number;
  pickup?: Point;
  destination?: Point;
  requestedAt?: string;
};
type Case = {
  _id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category?: string;
  customerId?: Person;
  driverId?: Person;
  rideId?: Ride;
  assignedTo?: Person;
  createdBy?: Person & { role?: string };
  createdAt?: string;
  resolution?: string;
  escalated?: boolean;
  lastPassengerNotificationAt?: string;
  contactHistory?: unknown[];
};
type Operations = { cases: Case[]; rides: Ride[]; drivers: Person[] };
const empty = {
  subject: "",
  description: "",
  priority: "normal",
  category: "acceptance_notification",
  rideId: "",
  customerId: "",
  driverId: "",
  assignedTo: "",
};
const msg = (e: unknown) =>
  axios.isAxiosError(e)
    ? String(e.response?.data?.message || e.message)
    : "Unexpected error";
export function SupportPage() {
  const { staff, can } = useAuth();
  const [data, setData] = useState<Operations>({
    cases: [],
    rides: [],
    drivers: [],
  });
  const [selected, setSelected] = useState<Case | null>(null);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [caseFilter, setCaseFilter] = useState("all");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.supportOperations();
      setData(response.data.data);
      setError("");
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load]);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createSupportCase({
        ...form,
        assignedTo: form.assignedTo || staff?.id,
      });
      setOpen(false);
      setForm(empty);
      await load();
    } catch (err) {
      setError(msg(err));
    }
  };
  const patch = async (item: Case, changes: Record<string, unknown>) => {
    try {
      await adminApi.updateSupportCase(item._id, changes);
      await load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const logContact = async (item: Case) => {
    const note = window.prompt("Contact note");
    if (!note) return;
    const channel =
      window.prompt("Channel: call, sms, email, push, in_app", "call") ||
      "call";
    const outcome =
      window.prompt(
        "Outcome: answered, no_answer, sent, failed, callback_requested, resolved",
        "answered",
      ) || "answered";
    try {
      await adminApi.logSupportContact(item._id, {
        channel,
        outcome,
        direction: "outbound",
        note,
      });
      await load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const notify = async (item: Case) => {
    if (
      !window.confirm(
        "Resend this ride update by in-app, SMS, email and push where configured?",
      )
    )
      return;
    try {
      await adminApi.notifySupportPassenger(item._id);
      await load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const assign = async (ride: Ride) => {
    const driverId = window.prompt(
      `Available driver ID:\n${data.drivers.map((d) => `${d.firstName} ${d.lastName}: ${d._id}`).join("\n")}`,
    );
    if (!driverId) return;
    try {
      await adminApi.assignSupportRide(ride._id, driverId, selected?._id);
      await load();
    } catch (e) {
      setError(msg(e));
    }
  };
  const createRide = async () => {
    const passengerId = window.prompt("Passenger account ID");
    if (!passengerId) return;
    const pickupLat = Number(window.prompt("Pickup latitude", "-1.9441"));
    const pickupLng = Number(window.prompt("Pickup longitude", "30.0619"));
    const destinationLat = Number(window.prompt("Destination latitude", "-1.9536"));
    const destinationLng = Number(window.prompt("Destination longitude", "30.0606"));
    const offeredFare = Number(window.prompt("Offered fare (RWF)", "3000"));
    try {
      await adminApi.createSupportRide({ passengerId, pickup: { latitude: pickupLat, longitude: pickupLng, name: "Caller-provided pickup" }, destination: { latitude: destinationLat, longitude: destinationLng, name: "Caller-provided destination" }, offeredFare, paymentMethod: "cash" });
      await load();
    } catch (e) { setError(msg(e)); }
  };
  const updateRide = async (ride: Ride) => {
    const rideStatus = window.prompt("Ride status", ride.rideStatus);
    if (!rideStatus) return;
    const fare = Number(window.prompt("Fare (RWF)", String(ride.fare || ride.offeredFare || 0)));
    try { await adminApi.updateSupportRide(ride._id, { rideStatus, fare, offeredFare: fare }); await load(); }
    catch (e) { setError(msg(e)); }
  };
  const trackRide = (ride: Ride) => {
    const location = ride.driverId?.lastLocation || ride.pickup;
    if (location?.latitude == null || location.longitude == null) { setError("No live GPS location is available for this ride."); return; }
    window.open(`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`, "_blank", "noopener,noreferrer");
  };
  const unassigned = data.rides.filter((ride) =>
    ["requested", "searching"].includes(ride.rideStatus),
  );
  const accepted = data.rides.filter(
    (ride) => !["requested", "searching"].includes(ride.rideStatus),
  );
  const source = (item: Case) => item.createdBy?.role || "unknown";
  const cases = data.cases.filter((item) => caseFilter === "all" || source(item) === caseFilter);
  return (
    <section>
      <PageHeader
        title="Call-center ride operations"
        description="Coordinate passengers and drivers, recover missed notifications, record contact attempts, assign cases, and escalate ride problems."
        action={
          can("support:update") ? (
            <div className="flex flex-wrap gap-2">
              <button className={secondaryButtonClass} onClick={() => void createRide()}>Create ride request</button>
              <button className={buttonClass} onClick={() => setOpen(true)}>Open support case</button>
            </div>
          ) : undefined
        }
      />
      {error ? <ErrorBanner message={error} retry={load} /> : null}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["Open cases", data.cases.length],
          ["Agent requests", data.cases.filter((item) => source(item) === "agent").length],
          ["Unassigned rides", unassigned.length],
          ["Active accepted rides", accepted.length],
          ["Available drivers", data.drivers.length],
        ].map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-2xl border border-white/10 bg-panel p-5"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      {loading ? (
        <p className="text-slate-400">Refreshing live operations…</p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-panel p-5">
            <h2 className="font-semibold">Ride intervention queue</h2>
            <p className="mb-4 text-sm text-slate-500">
              Requested rides can be manually assigned only to currently
              available drivers.
            </p>
            <div className="space-y-3">
              {data.rides.map((ride) => (
                <article
                  key={ride._id}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <b>
                        {ride.passengerId
                          ? `${ride.passengerId.firstName} ${ride.passengerId.lastName}`
                          : "Passenger unavailable"}
                      </b>
                      <p className="text-xs text-slate-500">
                        {ride.pickup?.name || ride.pickup?.address || "Pickup"}{" "}
                        →{" "}
                        {ride.destination?.name ||
                          ride.destination?.address ||
                          "Destination"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                      {ride.rideStatus}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <span>
                      Driver:{" "}
                      {ride.driverId
                        ? `${ride.driverId.firstName} ${ride.driverId.lastName}`
                        : "Unassigned"}
                    </span>
                    <span>Payment: {ride.paymentStatus || "pending"}</span>
                    <span>
                      Fare: {ride.fare || ride.offeredFare || "—"} RWF
                    </span>
                  </div>
                  {["requested", "searching"].includes(ride.rideStatus) && can("ride:manage") ? <label className="mt-3 block text-xs text-slate-400">Assign nearby driver<select aria-label="Assign nearby driver" className={`${inputClass} mt-1`} defaultValue="" onChange={async e=>{if(!e.target.value)return;try{await adminApi.assignSupportRide(ride._id,e.target.value,selected?._id);await load()}catch(error){setError(msg(error))}}}><option value="">Select available driver</option>{data.drivers.map(driver=><option className="bg-ink" key={driver._id} value={driver._id}>{driver.firstName} {driver.lastName}{driver.lastLocationAt?' · GPS active':''}</option>)}</select></label> : null}
                  {can("ride:manage") ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select aria-label="Update ride status" className={inputClass} value={ride.rideStatus} onChange={async e=>{try{await adminApi.updateSupportRide(ride._id,{rideStatus:e.target.value});await load()}catch(error){setError(msg(error))}}}>{['requested','searching','approaching','arrived','start_requested','in_progress','stop_requested','awaiting_payment','completed','cancelled','expired'].map(status=><option className="bg-ink" key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select>
                      <button className={secondaryButtonClass} onClick={() => trackRide(ride)}>Track live GPS</button>
                    </div>
                  ) : null}
                  {ride.driverId?.lastLocation ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Driver GPS: {ride.driverId.lastLocation.latitude}, {ride.driverId.lastLocation.longitude} • {ride.driverId.lastLocationAt ? new Date(ride.driverId.lastLocationAt).toLocaleString() : "live"}
                    </p>
                  ) : null}
                </article>
              ))}
              {!data.rides.length ? (
                <p className="text-sm text-slate-500">
                  No active ride operations.
                </p>
              ) : null}
            </div>
          </section>
        </div>
        <section className="rounded-2xl border border-white/10 bg-panel p-5">
          <h2 className="font-semibold">Support cases</h2>
          <p className="mb-4 text-sm text-slate-500">
            Review requests from agents, passengers, drivers, and staff. Select a case before assigning its linked ride.
          </p>
          <label className="mb-4 block text-sm text-slate-400">Request source
            <select className={`${inputClass} mt-1`} value={caseFilter} onChange={(event) => setCaseFilter(event.target.value)}>
              <option value="all">All sources</option>
              <option value="agent">Agents</option>
              <option value="driver">Drivers</option>
              <option value="client">Passengers</option>
              <option value="admin">Admins</option>
              <option value="superadmin">Superadmins</option>
              <option value="caller_support">Support staff</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <div className="space-y-3">
            {cases.map((item) => (
              <article
                key={item._id}
                className={`rounded-xl border p-4 ${selected?._id === item._id ? "border-lime" : "border-white/10"}`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setSelected(item)}
                >
                  <div className="flex justify-between gap-2">
                    <b>{item.subject}</b>
                    <span className="text-xs uppercase text-slate-500">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {item.description}
                  </p>
                  <p className="mt-2 text-xs text-lime">
                    From {source(item)}: {item.createdBy ? `${item.createdBy.firstName} ${item.createdBy.lastName}` : "Account unavailable"}
                    {item.createdBy?.phone ? ` · ${item.createdBy.phone}` : ""}
                    {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}
                    {` · ${item.status.replaceAll("_", " ")}`}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.driverId ? `Driver: ${item.driverId.firstName} ${item.driverId.lastName}` : item.customerId
                      ? `${item.customerId.firstName} ${item.customerId.lastName}`
                      : "No passenger linked"}{" "}
                    • {item.category || "other"} •{" "}
                    {item.contactHistory?.length || 0} contacts
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  {can("call_log:create") ? (
                    <button
                      className={secondaryButtonClass}
                      onClick={() => logContact(item)}
                    >
                      Log contact
                    </button>
                  ) : null}
                  {can("notification:send") && item.rideId ? (
                    <button
                      className={secondaryButtonClass}
                      onClick={() => notify(item)}
                    >
                      Resend passenger update
                    </button>
                  ) : null}
                  {can("support:update") ? (
                    <>
                      <button
                        className={secondaryButtonClass}
                        onClick={() =>
                          patch(item, {
                            assignedTo: staff?.id,
                            status: "in_progress",
                          })
                        }
                      >
                        Assign to me
                      </button>
                      <button
                        className={secondaryButtonClass}
                        onClick={() =>
                          patch(item, { escalated: !item.escalated })
                        }
                      >
                        {item.escalated ? "Remove escalation" : "Escalate"}
                      </button>
                      <button className={secondaryButtonClass} onClick={() => { const resolution = window.prompt("Resolution to send back to the requester"); if (resolution?.trim()) void patch(item, { status: "resolved", resolution: resolution.trim() }); }}>Resolve with note</button>
                    </>
                  ) : null}
                </div>
                {item.lastPassengerNotificationAt ? (
                  <p className="mt-2 text-xs text-lime">
                    Passenger notified{" "}
                    {new Date(
                      item.lastPassengerNotificationAt,
                    ).toLocaleString()}
                  </p>
                ) : null}
              </article>
            ))}
            {!cases.length ? (
              <p className="text-sm text-slate-500">No open cases for this source.</p>
            ) : null}
          </div>
        </section>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <form
            onSubmit={create}
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/10 bg-panel p-6"
          >
            <h3 className="text-xl font-semibold">Open ride-support case</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                required
                className={inputClass}
                placeholder="Subject"
                value={form.subject}
                onChange={(e) =>
                  setForm((v) => ({ ...v, subject: e.target.value }))
                }
              />
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) =>
                  setForm((v) => ({ ...v, category: e.target.value }))
                }
              >
                {[
                  "ride_assignment",
                  "acceptance_notification",
                  "driver_arrival",
                  "ride_start",
                  "ride_stop",
                  "payment",
                  "cancellation",
                  "other",
                ].map((v) => (
                  <option className="bg-ink" key={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={form.priority}
                onChange={(e) =>
                  setForm((v) => ({ ...v, priority: e.target.value }))
                }
              >
                {["low", "normal", "high", "urgent"].map((v) => (
                  <option className="bg-ink" key={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={form.rideId}
                onChange={(e) => {
                  const ride = data.rides.find((r) => r._id === e.target.value);
                  setForm((v) => ({
                    ...v,
                    rideId: e.target.value,
                    customerId: ride?.passengerId?._id || "",
                    driverId: ride?.driverId?._id || "",
                  }));
                }}
              >
                <option value="">Link a ride</option>
                {data.rides.map((ride) => (
                  <option className="bg-ink" key={ride._id} value={ride._id}>
                    {ride._id.slice(-8)} • {ride.rideStatus}
                  </option>
                ))}
              </select>
              <textarea
                required
                className={`${inputClass} md:col-span-2`}
                rows={5}
                placeholder="Describe the communication or operational problem"
                value={form.description}
                onChange={(e) =>
                  setForm((v) => ({ ...v, description: e.target.value }))
                }
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className={buttonClass}>Create and assign</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
