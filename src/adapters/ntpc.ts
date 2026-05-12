import { fetchJson } from '../util/fetchJson.js';
import { AdapterError, type Availability, type CityAdapter, type ParkingLot } from './types.js';

const CITY = '新北' as const;

const CATALOG_URL =
  'https://data.ntpc.gov.tw/api/datasets/B1464EF0-9C7C-4A6F-ABF7-6BDF32847E68/json';
const AVAILABILITY_URL =
  'https://data.ntpc.gov.tw/api/datasets/E09B35A5-A738-48CC-B0F5-570B67AD9C78/json';

interface RawCatalogRow {
  ID?: unknown;
  NAME?: unknown;
  AREA?: unknown;
  ADDRESS?: unknown;
  TOTALCAR?: unknown;
}

interface RawAvailabilityRow {
  ID?: unknown;
  AVAILABLECAR?: unknown;
}

export const adapter: CityAdapter = {
  city: CITY,
  async fetchCatalog() {
    try {
      const raw = await fetchJson<RawCatalogRow[]>(CATALOG_URL);
      return normalizeCatalog(raw);
    } catch (err) {
      throw new AdapterError(CITY, 'fetchCatalog failed', err);
    }
  },
  async fetchAvailability(lotIds) {
    try {
      const raw = await fetchJson<RawAvailabilityRow[]>(AVAILABILITY_URL);
      const all = normalizeAvailability(raw);
      return lotIds ? all.filter((a) => lotIds.includes(a.id)) : all;
    } catch (err) {
      throw new AdapterError(CITY, 'fetchAvailability failed', err);
    }
  },
};

function normalizeCatalog(raw: RawCatalogRow[]): ParkingLot[] {
  const out: ParkingLot[] = [];
  for (const r of raw) {
    const id = asString(r.ID);
    const name = asString(r.NAME);
    if (!id || !name) continue;
    const address = asString(r.ADDRESS);
    const area = asString(r.AREA);
    const total = asInt(r.TOTALCAR);
    out.push({
      city: CITY,
      id,
      name,
      address: address ?? area,
      totalSpaces: total && total > 0 ? total : undefined,
    });
  }
  return out;
}

function normalizeAvailability(raw: RawAvailabilityRow[]): Availability[] {
  const now = new Date();
  const out: Availability[] = [];
  for (const r of raw) {
    const id = asString(r.ID);
    const avail = asInt(r.AVAILABLECAR);
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
