import { fetchJson } from '../util/fetchJson.js';
import { AdapterError, type Availability, type CityAdapter, type ParkingLot } from './types.js';

const CITY = '台中' as const;
const URL = 'https://motoretag.taichung.gov.tw/DataAPI/api/ParkingSpotListAPIV2';

interface RawLot {
  ID?: unknown;
  Position?: unknown;
  X?: unknown;
  Y?: unknown;
  TotalCar?: unknown;
  AvailableCar?: unknown;
  Updatetime?: unknown;
}

interface RawArea {
  ParkingLots?: RawLot[];
}

export const adapter: CityAdapter = {
  city: CITY,
  async fetchCatalog() {
    try {
      const raw = await fetchJson<RawArea[]>(URL);
      return normalizeCatalog(raw);
    } catch (err) {
      throw new AdapterError(CITY, 'fetchCatalog failed', err);
    }
  },
  async fetchAvailability(lotIds) {
    try {
      const raw = await fetchJson<RawArea[]>(URL);
      const all = normalizeAvailability(raw);
      return lotIds ? all.filter((a) => lotIds.includes(a.id)) : all;
    } catch (err) {
      throw new AdapterError(CITY, 'fetchAvailability failed', err);
    }
  },
};

function* flatten(raw: RawArea[]): Generator<RawLot> {
  for (const area of raw) {
    if (!Array.isArray(area.ParkingLots)) continue;
    for (const lot of area.ParkingLots) yield lot;
  }
}

function normalizeCatalog(raw: RawArea[]): ParkingLot[] {
  const out: ParkingLot[] = [];
  for (const lot of flatten(raw)) {
    const id = asString(lot.ID);
    const name = asString(lot.Position);
    if (!id || !name) continue;
    const total = asInt(lot.TotalCar);
    out.push({
      city: CITY,
      id,
      name,
      totalSpaces: total && total > 0 ? total : undefined,
      lat: asFloat(lot.Y),
      lng: asFloat(lot.X),
    });
  }
  return out;
}

function normalizeAvailability(raw: RawArea[]): Availability[] {
  const out: Availability[] = [];
  for (const lot of flatten(raw)) {
    const id = asString(lot.ID);
    const avail = asInt(lot.AvailableCar);
    if (!id || avail === undefined || avail < 0) continue;
    out.push({
      city: CITY,
      id,
      availableSpaces: avail,
      updatedAt: parseTime(lot.Updatetime),
    });
  }
  return out;
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

function asInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }
  return undefined;
}

function asFloat(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseTime(raw: unknown): Date {
  if (typeof raw !== 'string') return new Date();
  // "2026-05-13 02:06:38" — 台北時區
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return new Date();
  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : new Date();
}
