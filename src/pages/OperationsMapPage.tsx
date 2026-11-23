import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, MessageSquare, Phone, Search, X } from 'lucide-react';
import { adminApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner, PageHeader, buttonClass, inputClass, secondaryButtonClass } from '../components/RemoteTable';
import { distanceLabel, metersBetween, parseCoordinates, validPoint, type Point } from '../utils/geo';

type Person = Point & { id: string; type: 'driver' | 'passenger'; name: string; phone?: string; status: string; seenAt?: string };
type Place = Point & { name: string; address?: string };
const KIGALI: Point = { latitude: -1.9536, longitude: 30.0606 };
const RADII = [1, 2, 3, 5, 10];
const COLORS = { driver: '#84cc16', busy: '#f59e0b', passenger: '#6366f1' };
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const safe = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');
const errorText = (e: unknown, fallback: string) => (axios.isAxiosError(e) ? String(e.response?.data?.message || e.message) : fallback);
const ago = (iso?: string) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
};
const colorOf = (p: Person) => (p.type === 'passenger' ? COLORS.passenger : p.status === 'available' ? COLORS.driver : COLORS.busy);

/** Built from text nodes: names come from users and must never be read as HTML. */
function popupOf(p: Person) {
  const node = document.createElement('div');
  [p.name, p.type, p.status.replace(/_/g, ' ')].forEach((text) => { const line = document.createElement('div'); line.textContent = text; node.append(line); });
  if (p.phone) {
    const links = document.createElement('div');
    links.style.cssText = 'margin-top:6px;display:flex;gap:12px';
    [['tel', 'Call'], ['sms', 'SMS']].forEach(([scheme, label]) => { const a = document.createElement('a'); a.href = `${scheme}:${p.phone}`; a.textContent = label; links.append(a); });
    node.append(p.phone, links);
  }
  return node;
}

export function OperationsMapPage() {
  const { can } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'open' | 'google'>('open');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [radiusKm, setRadiusKm] = useState(3);
  const [smsTo, setSmsTo] = useState<Person | null>(null);
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ ok: boolean; text: string } | null>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const placeLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const fitted = useRef(false);
  const searchRun = useRef(0);

  const load = useCallback(async () => {
    try {
      const d = (await adminApi.supportOperations()).data.data;
      const rides: any[] = d.rides || [];
      const busy = new Map(rides.filter((r) => r.driverId).map((r) => [String(r.driverId._id || r.driverId), String(r.rideStatus)]));
      const next: Person[] = [];
      const nameOf = (u: any) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unnamed';
      (d.drivers || []).forEach((u: any) => { if (validPoint(u.lastLocation)) next.push({ id: u._id, type: 'driver', name: nameOf(u), phone: u.phone, latitude: u.lastLocation.latitude, longitude: u.lastLocation.longitude, status: busy.get(String(u._id)) || 'available', seenAt: u.lastLocationAt }); });
      rides.forEach((r) => { if (validPoint(r.pickup) && r.passengerId) next.push({ id: `ride-${r._id}`, type: 'passenger', name: nameOf(r.passengerId), phone: r.passengerId.phone, latitude: r.pickup.latitude, longitude: r.pickup.longitude, status: r.rideStatus }); });
      setPeople(next);
      setError('');
    } catch (e) { setError(errorText(e, 'Unable to load live locations')); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, [load]);

  useEffect(() => {
    if (provider !== 'open' || !mapNode.current) return;
    const m = L.map(mapNode.current).setView([KIGALI.latitude, KIGALI.longitude], 13);
    // OpenStreetMap refuses tile requests that don't say which site they come from ("Access blocked").
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    placeLayer.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(mapNode.current);
    return () => { resize.disconnect(); m.remove(); map.current = null; markers.current.clear(); };
  }, [provider]);

  // Move existing markers instead of redrawing, so an open popup and the admin's view survive each refresh.
  useEffect(() => {
    if (!map.current || !layer.current) return;
    const seen = new Set<string>();
    people.forEach((p) => {
      seen.add(p.id);
      const old = markers.current.get(p.id);
      if (old) { old.setLatLng([p.latitude, p.longitude]).setStyle({ fillColor: colorOf(p) }); if (!old.isPopupOpen()) old.setPopupContent(popupOf(p)); }
      else markers.current.set(p.id, L.circleMarker([p.latitude, p.longitude], { radius: 10, color: '#fff', weight: 3, fillColor: colorOf(p), fillOpacity: 1 }).bindPopup(popupOf(p)).addTo(layer.current!));
    });
    markers.current.forEach((marker, id) => { if (!seen.has(id)) { marker.remove(); markers.current.delete(id); } });
    if (!fitted.current && !place && people.length) { fitted.current = true; map.current.fitBounds(L.latLngBounds(people.map((p) => [p.latitude, p.longitude])), { padding: [40, 40], maxZoom: 15 }); }
  }, [people, provider, place]);

  useEffect(() => {
    if (!map.current || !placeLayer.current) return;
    placeLayer.current.clearLayers();
    if (!place) return;
    const at: L.LatLngExpression = [place.latitude, place.longitude];
    const circle = L.circle(at, { radius: radiusKm * 1000, color: '#E63946', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(placeLayer.current);
    L.circleMarker(at, { radius: 8, color: '#fff', weight: 3, fillColor: '#E63946', fillOpacity: 1 }).bindTooltip(document.createTextNode(place.name) as unknown as HTMLElement, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(placeLayer.current);
    // The circle is centred on the place, so fitting it puts the place in the middle of the map.
    map.current.fitBounds(circle.getBounds(), { padding: [12, 12] });
  }, [place, radiusKm, provider]);

  const choose = (p: Place) => { searchRun.current++; setPlace(p); setResults(null); setSearching(false); setQuery(p.name); };
  const clearPlace = () => { searchRun.current++; setPlace(null); setResults(null); setQuery(''); setSearchError(''); };
  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    const coordinates = parseCoordinates(q);
    setSearchError('');
    if (coordinates) { choose({ ...coordinates, name: q }); return; }
    if (q.length < 3) { setSearchError('Type at least 3 letters.'); return; }
    const run = ++searchRun.current;
    setSearching(true);
    try {
      const center = map.current?.getCenter();
      const found: Place[] = ((await adminApi.searchPlaces(q, center ? { latitude: center.lat, longitude: center.lng } : KIGALI)).data.data || []).filter(validPoint);
      if (run !== searchRun.current) return;
      if (found.length === 1) choose(found[0]); else setResults(found);
    } catch (e) { if (run === searchRun.current) setSearchError(errorText(e, 'Place search failed.')); }
    finally { if (run === searchRun.current) setSearching(false); }
  };

  const drivers = useMemo(() => {
    const rows = people.filter((p) => p.type === 'driver').map((p) => ({ ...p, meters: place ? metersBetween(place, p) : null }));
    return place ? rows.filter((r) => r.meters! <= radiusKm * 1000).sort((a, b) => a.meters! - b.meters!) : rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [people, place, radiusKm]);
  const focus = (p: Person) => { map.current?.setView([p.latitude, p.longitude], 17); markers.current.get(p.id)?.openPopup(); };
  const openSms = (p: Person) => { setSmsTo(p); setSmsText(''); setSmsResult(null); };
  const sendSms = async (event: FormEvent) => {
    event.preventDefault();
    if (!smsTo || sending || !smsText.trim()) return;
    setSending(true); setSmsResult(null);
    try { await adminApi.smsDriver(smsTo.id, smsText.trim()); setSmsResult({ ok: true, text: 'SMS sent.' }); setSmsText(''); }
    catch (e) { setSmsResult({ ok: false, text: errorText(e, 'Could not send the SMS.') }); }
    finally { setSending(false); }
  };

  const googleHtml = useMemo(() => {
    if (provider !== 'google') return '';
    const c = place || people[0] || KIGALI;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#m{height:100%;margin:0}</style></head><body><div id="m"></div><script>const a=${safe(people)},place=${safe(place)};function initMap(){const m=new google.maps.Map(document.getElementById('m'),{center:{lat:${c.latitude},lng:${c.longitude}},zoom:15});if(place)new google.maps.Marker({map:m,position:{lat:place.latitude,lng:place.longitude},title:place.name});a.forEach(x=>{const n=document.createElement('div');n.textContent=[x.name,x.type,x.phone||'',x.status].join(' · ');const q=new google.maps.Marker({map:m,position:{lat:x.latitude,lng:x.longitude},title:x.name,label:x.type==='driver'?'D':'P'}),i=new google.maps.InfoWindow({content:n});q.addListener('click',()=>i.open({map:m,anchor:q}))})}</script><script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY || '')}&callback=initMap"></script></body></html>`;
  }, [people, place, provider]);

  return (
    <section>
      <PageHeader title="Live operations map" description="Search a place or street code to see the drivers around it, then call or text them." action={GOOGLE_KEY ? <div className="flex gap-2"><button aria-pressed={provider === 'open'} className={secondaryButtonClass} onClick={() => setProvider('open')}>OpenStreetMap</button><button aria-pressed={provider === 'google'} className={secondaryButtonClass} onClick={() => setProvider('google')}>Google</button></div> : undefined} />
      {error ? <ErrorBanner message={error} retry={load} /> : null}

      <div className="relative mb-4">
        <form onSubmit={search} className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input aria-label="Search a place or street code" className={`${inputClass} pl-9 pr-9`} value={query} onChange={(e) => { setQuery(e.target.value); setResults(null); }} placeholder="Place or street code, e.g. Kimironko, KG 11 Ave" />
            {query || place ? <button type="button" aria-label="Clear search" onClick={clearPlace} className="absolute right-2 top-2 p-1 text-slate-400"><X size={16} /></button> : null}
          </div>
          <button className={buttonClass} disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
          <label className="flex items-center gap-2 text-sm text-slate-400">Within<select className="rounded-xl border border-white/10 bg-panel px-3 py-2 text-slate-100" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>{RADII.map((r) => <option key={r} value={r}>{r} km</option>)}</select></label>
        </form>
        {searchError ? <p role="alert" className="mt-2 text-sm text-red-300">{searchError}</p> : null}
        {results ? (
          <ul className="absolute z-[1100] mt-2 max-h-72 w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-panel shadow-xl">
            {results.length ? results.map((r, i) => <li key={`${r.latitude},${r.longitude},${i}`}><button type="button" onClick={() => choose(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5"><MapPin size={16} className="mt-0.5 shrink-0 text-lime" /><span className="min-w-0"><span className="block text-sm">{r.name}</span><span className="block truncate text-xs text-slate-400">{r.address}</span></span></button></li>) : <li className="px-4 py-3 text-sm text-slate-400">No place found. Check the spelling, or paste coordinates such as -1.9536, 30.0606.</li>}
          </ul>
        ) : null}
      </div>

      <p className="mb-3 text-sm text-slate-400"><span style={{ color: COLORS.driver }}>●</span> Available driver · <span style={{ color: COLORS.busy }}>●</span> Driver on a ride · <span style={{ color: COLORS.passenger }}>●</span> Passenger pickup · updates every 10 seconds</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {provider === 'open' ? <div ref={mapNode} aria-label="Live operations map" className="isolate h-[60vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-200 lg:h-[70vh]" /> : <iframe sandbox="allow-scripts" title="Live operations map" srcDoc={googleHtml} className="h-[60vh] w-full rounded-2xl border border-white/10 bg-slate-200 lg:h-[70vh]" />}
        <aside className="flex max-h-[70vh] min-h-0 flex-col rounded-2xl border border-white/10 bg-panel">
          <div className="border-b border-white/10 p-4"><h3 className="font-semibold">{place ? `${drivers.length} driver${drivers.length === 1 ? '' : 's'} within ${radiusKm} km` : `${drivers.length} driver${drivers.length === 1 ? '' : 's'} online`}</h3>{place ? <p className="mt-1 truncate text-sm text-slate-400">of {place.name}</p> : null}</div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {drivers.map((p) => (
              <li key={p.id} className="border-b border-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium"><span style={{ color: colorOf(p) }}>●</span> {p.name}</p><p className="text-xs text-slate-400">{p.phone || 'No phone'}</p><p className="text-xs capitalize text-slate-400">{p.status.replace(/_/g, ' ')}{p.seenAt ? ` · ${ago(p.seenAt)}` : ''}</p></div>
                  {p.meters !== null ? <span className="shrink-0 text-sm text-lime">{distanceLabel(p.meters)}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.phone ? <a href={`tel:${p.phone}`} aria-label={`Call ${p.name}`} className={`${secondaryButtonClass} inline-flex items-center gap-2`}><Phone size={14} />Call</a> : null}
                  {p.phone ? <button aria-label={`SMS ${p.name}`} onClick={() => openSms(p)} className={`${secondaryButtonClass} inline-flex items-center gap-2`}><MessageSquare size={14} />SMS</button> : null}
                  {provider === 'open' ? <button aria-label={`Show ${p.name} on the map`} onClick={() => focus(p)} className={secondaryButtonClass}><Crosshair size={14} /></button> : null}
                </div>
              </li>
            ))}
            {!drivers.length ? <li className="p-6 text-center text-sm text-slate-400">{place ? 'No online driver here. Try a wider distance.' : 'No driver is online right now.'}</li> : null}
          </ul>
        </aside>
      </div>

      {smsTo ? (
        <div role="dialog" aria-modal="true" aria-label={`SMS ${smsTo.name}`} className="fixed inset-0 z-[1200] grid place-items-center bg-black/60 p-4" onKeyDown={(e) => e.key === 'Escape' && setSmsTo(null)}>
          <form onSubmit={sendSms} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-panel p-6">
            <div><h3 className="text-lg font-semibold">SMS {smsTo.name}</h3><p className="text-sm text-slate-400">{smsTo.phone}</p></div>
            <label className="block text-sm">Message<textarea autoFocus required maxLength={320} rows={4} className={`${inputClass} mt-2`} value={smsText} onChange={(e) => setSmsText(e.target.value)} /><span className="text-xs text-slate-400">{smsText.length}/320</span></label>
            {smsResult ? <p role="status" className={`text-sm ${smsResult.ok ? 'text-lime' : 'text-red-300'}`}>{smsResult.text}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setSmsTo(null)}>Close</button>
              <a className={secondaryButtonClass} href={`sms:${smsTo.phone}${smsText ? `?body=${encodeURIComponent(smsText)}` : ''}`}>Open my SMS app</a>
              {can('notification:send') ? <button className={buttonClass} disabled={sending || !smsText.trim()}>{sending ? 'Sending…' : 'Send from MOTA'}</button> : null}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
