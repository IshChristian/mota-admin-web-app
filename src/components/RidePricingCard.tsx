import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { adminApi } from '../api';
import { buttonClass, inputClass } from './RemoteTable';

type Config = { key: string; value: unknown };

// Same defaults the backend uses when a setting has never been saved.
const FIELDS = [
  { vehicle: 'Moto', key: 'ride_base_fare', label: 'Base fare', fallback: 500 },
  { vehicle: 'Moto', key: 'ride_per_km_rate', label: 'Price per km', fallback: 500 },
  { vehicle: 'Moto', key: 'ride_minimum_fare', label: 'Minimum fare', fallback: 500 },
  { vehicle: 'Car', key: 'car_ride_base_fare', label: 'Base fare', fallback: 1500 },
  { vehicle: 'Car', key: 'car_ride_per_km_rate', label: 'Price per km', fallback: 500 },
  { vehicle: 'Car', key: 'car_ride_minimum_fare', label: 'Minimum fare', fallback: 2500 },
  { vehicle: 'Parcel', key: 'parcel_surcharge', label: 'Extra per delivery', fallback: 300 },
] as const;

const current = (rows: Config[], key: string, fallback: number) => {
  const n = Number(rows.find((r) => r.key === key)?.value);
  return Number.isFinite(n) ? n : fallback;
};

/** Edits the fare formula: base + distance × price per km, never below the minimum. */
export function RidePricingCard({ rows, onSaved }: { rows: Config[]; onSaved: () => Promise<void> | void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(current(rows, f.key, f.fallback))])));
  }, [rows]);

  const changed = FIELDS.filter((f) => values[f.key] !== undefined && Number(values[f.key]) !== current(rows, f.key, f.fallback));
  const invalid = FIELDS.find((f) => !/^\d+$/.test(values[f.key] ?? ''));
  const example = (prefix: 'Moto' | 'Car', km: number) => {
    const [base, perKm, min] = FIELDS.filter((f) => f.vehicle === prefix).map((f) => Number(values[f.key]) || 0);
    return Math.max(base + Math.round(km * perKm), min);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid || !changed.length) return;
    setSaving(true);
    setMessage(null);
    try {
      for (const f of changed) await adminApi.updateConfig(f.key, Number(values[f.key]), `${f.vehicle}: ${f.label.toLowerCase()} in RWF`);
      setMessage({ ok: true, text: 'Prices saved. New estimates use them right away.' });
      await onSaved();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setMessage({
        ok: false,
        text: status === 403
          ? 'Changing prices needs the "settings:financial" permission (superadmin or finance).'
          : axios.isAxiosError(err) ? String(err.response?.data?.message || err.message) : 'Could not save prices.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 rounded-2xl border border-white/10 bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Ride pricing</h2>
          <p className="text-sm text-slate-400">Fare = base fare + distance × price per km, never below the minimum. Amounts in RWF.</p>
        </div>
        <p className="text-sm text-slate-400">
          5 km trip: <span className="font-semibold text-white">Moto {example('Moto', 5).toLocaleString()}</span> ·{' '}
          <span className="font-semibold text-white">Car {example('Car', 5).toLocaleString()}</span>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(['Moto', 'Car', 'Parcel'] as const).map((vehicle) => (
          <fieldset key={vehicle} className="rounded-xl border border-white/5 p-4">
            <legend className="px-1 text-sm font-semibold text-lime">{vehicle}</legend>
            {FIELDS.filter((f) => f.vehicle === vehicle).map((f) => (
              <label key={f.key} className="mb-3 block text-sm last:mb-0">
                <span className="mb-1 block text-slate-400">{f.label}</span>
                <input
                  inputMode="numeric"
                  className={inputClass}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.trim() }))}
                  aria-invalid={!/^\d+$/.test(values[f.key] ?? '')}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={buttonClass} disabled={saving || !!invalid || !changed.length}>
          {saving ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length > 1 ? 's' : ''}` : 'No changes'}
        </button>
        {invalid ? <span className="text-sm text-red-300">{invalid.vehicle} {invalid.label.toLowerCase()} must be a whole number.</span> : null}
        {message ? <span role="status" className={`text-sm ${message.ok ? 'text-lime' : 'text-red-300'}`}>{message.text}</span> : null}
      </div>
    </form>
  );
}
