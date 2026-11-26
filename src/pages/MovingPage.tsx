import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, RemoteTable, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';

// MOTA Kwimuka (house moving), partner-first: a customer books in the app, the team calls,
// visits when asked, sends a price, and assigns a partner truck once the customer accepts.

type Stop = { name: string; address?: string; latitude: number; longitude: number; placeType: string; floor: number; hasElevator: boolean; truckAccess: string; landmark?: string; contactName?: string; contactPhone?: string };
type Move = {
  _id: string; ref: string; status: string; createdAt: string; userId?: { firstName?: string; lastName?: string; phone?: string; email?: string } | null;
  from: Stop; to: Stop; homeSize: string; items: { key: string; qty: number }[]; truckKey: string | null; wantsVisit: boolean;
  visit?: { preferredDate?: string; timeWindow?: string; scheduledAt?: string | null }; moveDate?: string | null; timeWindow: string;
  loaders: number; packing: boolean; assembly: boolean; notes?: string; contactPhone: string; photos?: string[];
  estimate?: { min: number; max: number; distanceKm: number }; quote?: { amount?: number | null; note?: string };
  partner?: { company?: string; driverName?: string; phone?: string; plate?: string };
  statusHistory: { status: string; at: string; note?: string; by?: { firstName?: string; lastName?: string } | null }[];
  source?: string; campaign?: string; staffNotes?: string; cancelReason?: string;
};
type Truck = { _id: string; key: string; name: string; model: string; capacityTonnes: number; priceMin: number; priceMax: number; perKmOutside: number; imageUrl: string; photoCredit: string; active: boolean };

const STATUS_LABEL: Record<string, string> = { requested: 'New request', visit_scheduled: 'Visit booked', visited: 'Visited', quoted: 'Price sent', accepted: 'Price accepted', confirmed: 'Truck booked', in_progress: 'Moving now', completed: 'Completed', cancelled: 'Cancelled' };
const STATUS_STYLE: Record<string, string> = { requested: 'bg-amber-400/15 text-amber-300', visit_scheduled: 'bg-sky-400/15 text-sky-300', visited: 'bg-sky-400/15 text-sky-300', quoted: 'bg-violet-400/15 text-violet-300', accepted: 'bg-lime/15 text-lime', confirmed: 'bg-lime/15 text-lime', in_progress: 'bg-lime/25 text-lime', completed: 'bg-white/10 text-slate-300', cancelled: 'bg-white/5 text-slate-500' };
const FILTERS = ['active', 'requested', 'visit_scheduled', 'quoted', 'accepted', 'confirmed', 'in_progress', 'completed', 'cancelled', ''];
const SIZE: Record<string, string> = { few_items: 'A few items', studio: 'Studio', one_bedroom: '1 bedroom', two_bedroom: '2 bedrooms', three_bedroom: '3 bedrooms', four_plus: '4+ bedrooms', office: 'Office' };
const ACCESS: Record<string, string> = { at_door: 'truck at the door', short_walk: 'short walk', long_walk: 'long walk / steep' };
const rwf = (n?: number | null) => `${Math.round(n || 0).toLocaleString()} RWF`;
const day = (iso?: string | null, time = false) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—');
const message = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const toLocalInput = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const mapLink = (s: Stop) => `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`;

export function MovingPage() {
  const { can } = useAuth();
  const canUpdate = can('support:update');
  const [tab, setTab] = useState<'requests' | 'trucks'>('requests');
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Move[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Move | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await adminApi.moves.list({ status: status || undefined, q: q.trim() || undefined })).data.data;
      setRows(data.items); setCounts(data.counts || {}); setError('');
    } catch (e) { setError(message(e, 'Could not load moving requests.')); }
    finally { setLoading(false); }
  }, [status, q]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => void refresh(), 60_000); return () => clearInterval(timer); }, [refresh]);

  const open = async (id: string) => {
    try { setSelected((await adminApi.moves.get(id)).data.data); } catch (e) { setError(message(e, 'Could not open this move.')); }
  };
  const activeCount = ['requested', 'visit_scheduled', 'visited', 'quoted', 'accepted', 'confirmed', 'in_progress'].reduce((n, s) => n + (counts[s] || 0), 0);

  return (
    <section className="space-y-6">
      <PageHeader title="House moving (MOTA Kwimuka)" description="Customers book a truck in the app. Call them, visit when asked, send the price, then book a partner truck." />
      <div className="flex gap-2">
        <button className={tab === 'requests' ? buttonClass : secondaryButtonClass} onClick={() => setTab('requests')}>Requests{counts.requested ? ` · ${counts.requested} new` : ''}</button>
        <button className={tab === 'trucks' ? buttonClass : secondaryButtonClass} onClick={() => setTab('trucks')}>Trucks & prices</button>
      </div>

      {tab === 'trucks' ? <TrucksPanel /> : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">Status<select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {FILTERS.map((s) => <option key={s} value={s}>{s === 'active' ? `Open (${activeCount})` : s ? `${STATUS_LABEL[s]} (${counts[s] || 0})` : 'All'}</option>)}
            </select></label>
            <label className="text-sm">Search<input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="KW-… , phone or place" /></label>
            <button className={secondaryButtonClass} onClick={() => void refresh()}>Refresh</button>
          </div>
          {error ? <ErrorBanner message={error} retry={() => void refresh()} /> : null}
          <RemoteTable heads={['Ref', 'Customer', 'From → To', 'Home', 'Date', 'Price', 'Came from', 'Status']} loading={loading} empty={!rows.length}>
            {rows.map((m) => (
              <tr key={m._id} className="cursor-pointer border-t border-white/5 align-top hover:bg-white/5" onClick={() => void open(m._id)}>
                <td className="p-3 font-mono text-lime">{m.ref}<span className="block text-xs text-slate-500">{day(m.createdAt, true)}</span></td>
                <td className="p-3">{m.userId ? `${m.userId.firstName || ''} ${m.userId.lastName || ''}` : '—'}<span className="block text-xs text-slate-400">{m.contactPhone}</span></td>
                <td className="p-3">{m.from.name} → {m.to.name}<span className="block text-xs text-slate-400">{m.estimate?.distanceKm} km</span></td>
                <td className="p-3">{SIZE[m.homeSize] || m.homeSize}<span className="block text-xs text-slate-400">{m.wantsVisit ? 'Wants a home visit' : m.truckKey}</span></td>
                <td className="p-3 text-xs">{m.wantsVisit && !['quoted', 'accepted', 'confirmed', 'in_progress', 'completed'].includes(m.status) ? `Visit ${day(m.visit?.scheduledAt || m.visit?.preferredDate)}` : day(m.moveDate)}</td>
                <td className="p-3">{m.quote?.amount ? rwf(m.quote.amount) : <span className="text-xs text-slate-400">est. {rwf(m.estimate?.min)}–{rwf(m.estimate?.max)}</span>}</td>
                <td className="p-3 text-xs">{m.source || 'app'}{m.campaign ? <span className="block text-slate-400">{m.campaign}</span> : null}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span></td>
              </tr>
            ))}
          </RemoteTable>
        </>
      )}

      {selected ? <MoveDialog move={selected} canUpdate={canUpdate} onClose={() => setSelected(null)} onSaved={(m) => { setSelected(m); void refresh(); }} /> : null}
    </section>
  );
}

function StopCard({ title, s }: { title: string; s: Stop }) {
  return (
    <div className="space-y-1 rounded-xl bg-white/5 p-3 text-sm">
      <span className="block text-xs uppercase text-slate-500">{title}</span>
      <a className="font-semibold text-lime hover:underline" href={mapLink(s)} target="_blank" rel="noreferrer">{s.name} ↗</a>
      {s.address ? <p className="text-slate-400">{s.address}</p> : null}
      <p>{s.placeType} · {s.floor ? `floor ${s.floor}${s.hasElevator ? ' (lift)' : ' (stairs)'}` : 'ground floor'} · {ACCESS[s.truckAccess] || s.truckAccess}</p>
      {s.landmark ? <p className="text-slate-300">“{s.landmark}”</p> : null}
      {s.contactName || s.contactPhone ? <p className="text-slate-400">On site: {[s.contactName, s.contactPhone].filter(Boolean).join(' · ')}</p> : null}
    </div>
  );
}

function MoveDialog({ move: m, canUpdate, onClose, onSaved }: { move: Move; canUpdate: boolean; onClose: () => void; onSaved: (m: Move) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visitAt, setVisitAt] = useState(toLocalInput(m.visit?.scheduledAt || m.visit?.preferredDate));
  const [amount, setAmount] = useState(String(m.quote?.amount || (m.estimate ? Math.round((m.estimate.min + m.estimate.max) / 2 / 1000) * 1000 : '')));
  const [quoteNote, setQuoteNote] = useState(m.quote?.note || '');
  const [partner, setPartner] = useState({ company: m.partner?.company || '', driverName: m.partner?.driverName || '', phone: m.partner?.phone || '', plate: m.partner?.plate || '' });
  const [moveDate, setMoveDate] = useState(toLocalInput(m.moveDate));
  const [notes, setNotes] = useState(m.staffNotes || '');
  const [reason, setReason] = useState('');

  const send = async (body: Record<string, unknown>) => {
    setBusy(true); setError('');
    try {
      await adminApi.moves.update(m._id, body);
      onSaved((await adminApi.moves.get(m._id)).data.data);
    } catch (e) { setError(message(e, 'Could not update this move.')); }
    finally { setBusy(false); }
  };
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);
  const can = (...s: string[]) => canUpdate && s.includes(m.status);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="mt-6 w-full max-w-3xl space-y-4 rounded-2xl border border-white/10 bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold"><span className="font-mono">{m.ref}</span> <span className={`ml-2 rounded-full px-2 py-1 text-xs ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span></h3>
          <button className={secondaryButtonClass} onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>{m.userId ? `${m.userId.firstName || ''} ${m.userId.lastName || ''}` : 'Customer'}</span>
          <a className="text-lime hover:underline" href={`tel:${m.contactPhone}`}>Call {m.contactPhone}</a>
          {m.userId?.phone && m.userId.phone !== m.contactPhone ? <span className="text-slate-400">Account phone {m.userId.phone}</span> : null}
          <span className="text-slate-400">From: {m.source || 'app'}{m.campaign ? ` · ${m.campaign}` : ''}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2"><StopCard title="Moving from" s={m.from} /><StopCard title="Moving to" s={m.to} /></div>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-500">Home</span>{SIZE[m.homeSize]}<span className="block text-slate-400">{m.items.map((i) => `${i.qty} ${i.key.replace('_', ' ')}`).join(', ') || 'No items listed'}</span></div>
          <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-500">Truck & extras</span>{m.wantsVisit ? 'Home visit requested' : m.truckKey}<span className="block text-slate-400">{m.loaders} loaders{m.packing ? ' · packing' : ''}{m.assembly ? ' · furniture assembly' : ''}</span></div>
          <div className="rounded-xl bg-white/5 p-3"><span className="block text-xs text-slate-500">Estimate shown</span>{rwf(m.estimate?.min)} – {rwf(m.estimate?.max)}<span className="block text-slate-400">{m.estimate?.distanceKm} km · move {day(m.moveDate)} {m.timeWindow}</span></div>
        </div>
        {m.wantsVisit ? <p className="text-sm text-sky-300">Visit wanted around {day(m.visit?.preferredDate)} ({m.visit?.timeWindow}){m.visit?.scheduledAt ? ` · booked for ${day(m.visit.scheduledAt, true)}` : ''}</p> : null}
        {m.notes ? <p className="rounded-xl bg-white/5 p-3 text-sm">Customer note: “{m.notes}”</p> : null}
        {m.photos?.length ? <div className="flex flex-wrap gap-2">{m.photos.map((p) => <a key={p} href={p} target="_blank" rel="noreferrer"><img src={p} alt="Customer photo" className="h-20 w-28 rounded-lg object-cover" /></a>)}</div> : null}

        {canUpdate ? (
          <div className="space-y-4 rounded-xl border border-white/10 p-4">
            {can('requested', 'visit_scheduled') && m.wantsVisit ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">Home visit date & time<input type="datetime-local" className={inputClass} value={visitAt} onChange={(e) => setVisitAt(e.target.value)} /></label>
                <button className={buttonClass} disabled={busy || !visitAt} onClick={() => void send({ status: 'visit_scheduled', visitScheduledAt: iso(visitAt) })}>{m.status === 'visit_scheduled' ? 'Change visit' : 'Book visit'}</button>
                {m.status === 'visit_scheduled' ? <button className={secondaryButtonClass} disabled={busy} onClick={() => void send({ status: 'visited' })}>Visit done</button> : null}
              </div>
            ) : null}
            {can('requested', 'visit_scheduled', 'visited', 'quoted', 'accepted') ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">Final price (RWF)<input type="number" min={1000} step={1000} className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                <label className="min-w-[240px] flex-1 text-sm">What's included (customer sees this)<input className={inputClass} value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} placeholder="Medium truck, 3 loaders, packing" /></label>
                <button className={buttonClass} disabled={busy || !Number(amount)} onClick={() => void send({ status: 'quoted', quoteAmount: Number(amount), quoteNote })}>{m.status === 'quoted' || m.status === 'accepted' ? 'Send new price' : 'Send price'}</button>
                {m.status === 'quoted' ? <button className={secondaryButtonClass} disabled={busy} onClick={() => void send({ status: 'accepted', note: 'Accepted by phone' })}>Customer accepted by phone</button> : null}
              </div>
            ) : null}
            {can('accepted', 'confirmed') ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Partner truck (the customer sees the plate, driver and phone).</p>
                <div className="grid gap-3 md:grid-cols-5">
                  <label className="text-sm">Partner company<input className={inputClass} value={partner.company} onChange={(e) => setPartner({ ...partner, company: e.target.value })} /></label>
                  <label className="text-sm">Driver<input className={inputClass} value={partner.driverName} onChange={(e) => setPartner({ ...partner, driverName: e.target.value })} /></label>
                  <label className="text-sm">Driver phone<input className={inputClass} value={partner.phone} onChange={(e) => setPartner({ ...partner, phone: e.target.value })} /></label>
                  <label className="text-sm">Plate<input className={`${inputClass} uppercase`} value={partner.plate} onChange={(e) => setPartner({ ...partner, plate: e.target.value })} /></label>
                  <label className="text-sm">Moving date<input type="datetime-local" className={inputClass} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} /></label>
                </div>
                <button className={buttonClass} disabled={busy} onClick={() => void send({ status: 'confirmed', partner, moveDate: iso(moveDate) })}>{m.status === 'confirmed' ? 'Update truck' : 'Book this truck'}</button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {can('confirmed') ? <button className={buttonClass} disabled={busy} onClick={() => void send({ status: 'in_progress' })}>Move started</button> : null}
              {can('in_progress') ? <button className={buttonClass} disabled={busy} onClick={() => void send({ status: 'completed' })}>Move completed</button> : null}
            </div>
            {can('requested', 'visit_scheduled', 'visited', 'quoted', 'accepted', 'confirmed') ? (
              <div className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
                <label className="min-w-[240px] flex-1 text-sm">Cancel reason (customer sees it)<input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                <button className={`${secondaryButtonClass} text-red-300`} disabled={busy} onClick={() => { if (window.confirm(`Cancel ${m.ref}? The customer is told.`)) void send({ status: 'cancelled', cancelReason: reason }); }}>Cancel move</button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
              <label className="min-w-[240px] flex-1 text-sm">Team notes (only staff see these)<textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <button className={secondaryButtonClass} disabled={busy} onClick={() => void send({ staffNotes: notes })}>Save notes</button>
            </div>
            {error ? <p role="alert" className="text-red-300">{error}</p> : null}
          </div>
        ) : null}

        <div className="text-sm">
          <span className="block text-xs uppercase text-slate-500">History</span>
          <ul className="mt-2 space-y-1">
            {m.statusHistory.map((h, i) => <li key={i}>{day(h.at, true)} · {STATUS_LABEL[h.status]}{h.by?.firstName ? ` · ${h.by.firstName} ${h.by.lastName || ''}` : ''}{h.note ? ` · ${h.note}` : ''}</li>)}
          </ul>
          {m.cancelReason ? <p className="mt-2 text-slate-400">Cancel reason: {m.cancelReason}</p> : null}
        </div>
      </div>
    </div>
  );
}

function TrucksPanel() {
  const { can } = useAuth();
  const canEdit = can('settings:general');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<Truck>>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    try { setTrucks((await adminApi.moves.trucks()).data.data); } catch (e) { setNotice({ ok: false, text: message(e, 'Could not load trucks.') }); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const set = (key: string, patch: Partial<Truck>) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const save = async (t: Truck) => {
    try {
      await adminApi.moves.updateTruck(t.key, drafts[t.key] || {});
      setDrafts((d) => ({ ...d, [t.key]: {} })); setNotice({ ok: true, text: `${t.name} saved. The app shows the new prices right away.` }); await load();
    } catch (e) { setNotice({ ok: false, text: message(e, 'Could not save this truck.') }); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Price ranges customers see before the team quotes. Inside Kigali (first 25 km) the range covers the trip; further away adds the per-km price. Leave the photo link empty to use MOTA's sample photo, or paste an https link to a photo of a partner's real truck.</p>
      {notice ? <p role="status" className={notice.ok ? 'text-lime' : 'text-red-300'}>{notice.text}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {trucks.map((t) => {
          const d = { ...t, ...drafts[t.key] };
          return (
            <div key={t.key} className="space-y-3 rounded-2xl border border-white/10 bg-panel p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold">{t.name} <span className="text-xs text-slate-400">{t.model} · {t.capacityTonnes} t</span></h3>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={d.active} onChange={(e) => set(t.key, { active: e.target.checked })} /> Offered</label></div>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-sm">From (RWF)<input type="number" disabled={!canEdit} className={inputClass} value={d.priceMin} onChange={(e) => set(t.key, { priceMin: Number(e.target.value) })} /></label>
                <label className="text-sm">To (RWF)<input type="number" disabled={!canEdit} className={inputClass} value={d.priceMax} onChange={(e) => set(t.key, { priceMax: Number(e.target.value) })} /></label>
                <label className="text-sm">Per km after 25 km<input type="number" disabled={!canEdit} className={inputClass} value={d.perKmOutside} onChange={(e) => set(t.key, { perKmOutside: Number(e.target.value) })} /></label>
              </div>
              <label className="block text-sm">Photo link (optional)<input disabled={!canEdit} className={inputClass} value={d.imageUrl} onChange={(e) => set(t.key, { imageUrl: e.target.value })} placeholder="https://…" /></label>
              <label className="block text-sm">Photo credit<input disabled={!canEdit} className={inputClass} value={d.photoCredit} onChange={(e) => set(t.key, { photoCredit: e.target.value })} /></label>
              {d.imageUrl ? <img src={d.imageUrl} alt={t.name} className="h-32 w-full rounded-xl object-cover" /> : null}
              {canEdit ? <button className={buttonClass} disabled={!Object.keys(drafts[t.key] || {}).length} onClick={() => void save(t)}>Save</button> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
