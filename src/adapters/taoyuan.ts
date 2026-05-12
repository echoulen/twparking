import { fetchJson } from '../util/fetchJson.js';
import { AdapterError, type Availability, type CityAdapter, type ParkingLot } from './types.js';

const CITY = '桃園' as const;
// 單一端點同時提供 catalog (parkName/address/totalSpace) 與 availability (surplusSpace)
const URL =
  'https://opendata.tycg.gov.tw/api/dataset/f4cc0b12-86ac-40f9-8745-885bddc18f79/resource/0381e141-f7ee-450e-99da-2240208d1773/download';

interface RawRow {
  parkId?: unknown;
  parkName?: unknown;
  address?: unknown;
  areaName?: unknown;
  totalSpace?: unknown;
  surplusSpace?: unknown;
  wgsX?: unknown;
  wgsY?: unknown;
}

export const adapter: CityAdapter = {
  city: CITY,
  async fetchCatalog() {
    try {
      const raw = await fetchJson<RawRow[]>(URL);
      return normalizeCatalog(raw);
    } catch (err) {
      throw new AdapterError(CITY, 'fetchCatalog failed', err);
    }
  },
  async fetchAvailability(lotIds) {
    try {
      const raw = await fetchJson<RawRow[]>(URL);
      const all = normalizeAvailability(raw);
      return lotIds ? all.filter((a) => lotIds.includes(a.id)) : all;
    } catch (err) {
      throw new AdapterError(CITY, 'fetchAvailability failed', err);
    }
  },
};

function normalizeCatalog(raw: RawRow[]): ParkingLot[] {
  const out: ParkingLot[] = [];
  for (const r of raw) {
    const id = asString(r.parkId);
    const name = asString(r.parkName);
    if (!id || !name) continue;
    const total = asInt(r.totalSpace);
    out.push({
      city: CITY,
      id,
      name,
      address: asString(r.address) ?? asString(r.areaName),
      totalSpaces: total && total > 0 ? total : undefined,
      lat: asFloat(r.wgsX),
      lng: asFloat(r.wgsY),
    });
  }
  return out;
}

function normalizeAvailability(raw: RawRow[]): Availability[] {
  const now = new Date();
  const out: Availability[] = [];
  for (const r of raw) {
    const id = asString(r.parkId);
    const avail = asInt(r.surplusSpace);
    if (!id || avail === undefined || avail < 0) continue;
    out.push({ city: CITY, id, availableSpaces: avail, updatedAt: now });
  }
  return out;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
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
