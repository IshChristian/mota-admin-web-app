export type Point = { latitude: number; longitude: number };
export function metersBetween(a: Point, b: Point) {
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}
export const distanceLabel = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
export const validPoint = (p: any): p is Point => Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
/** "-1.95, 30.06" typed or pasted as a search. */
export function parseCoordinates(text: string): Point | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)[\s,]+(-?\d{1,3}(?:\.\d+)?)$/);
  const point = m ? { latitude: Number(m[1]), longitude: Number(m[2]) } : null;
  return point && validPoint(point) ? point : null;
}
