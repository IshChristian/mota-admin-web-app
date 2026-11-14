// <input type="datetime-local"> works in the viewer's local time (Kigali for MOTA staff).
// toISOString() is UTC, so formatting with it shifted every saved date by the timezone offset.
const pad = (n: number) => String(n).padStart(2, '0');

/** Stored ISO date → "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
export const toDateInput = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value (local time) → ISO string for the API, or null when empty. */
export const fromDateInput = (value: string): string | null => (value ? new Date(value).toISOString() : null);
