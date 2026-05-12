import { fetchJson } from '../util/fetchJson.js';
import { AdapterError, type Availability, type CityAdapter, type ParkingLot } from './types.js';

const CITY = '台北' as const;
const CATALOG_URL = 'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json';
const AVAILABILITY_URL =
  'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json';

interface RawCatalog {
  data?: {
    park?: Array<{
      id?: unknown;
      name?: unknown;
      area?: unknown;
      address?: unknown;
      totalcar?: unknown;
    }>;
  };
}

interface RawAvailability {
  data?: {
    UPDATETIME?: unknown;
    park?: Array<{ id?: unknown; availablecar?: unknown }>;
  };
}

export const adapter: CityAdapter = {
  city: CITY,
  async fetchCatalog() {
    try {
      const raw = await fetchJson<RawCatalog>(CATALOG_URL);
      return normalizeCatalog(raw);
    } catch (err) {
      throw new AdapterError(CITY, 'fetchCatalog failed', err);
    }
  },
  async fetchAvailability(lotIds) {
    try {
      const raw = await fetchJson<RawAvailability>(AVAILABILITY_URL);
      const all = normalizeAvailability(raw);
      return lotIds ? all.filter((a) => lotIds.includes(a.id)) : all;
    } catch (err) {
      throw new AdapterError(CITY, 'fetchAvailability failed', err);
    }
  },
};

function normalizeCatalog(raw: RawCatalog): ParkingLot[] {
  const list = raw.data?.park ?? [];
  const out: ParkingLot[] = [];
  for (const p of list) {
    const id = typeof p.id === 'string' ? p.id : undefined;
    const name = typeof p.name === 'string' ? p.name : undefined;
    if (!id || !name) continue;
    const area = typeof p.area === 'string' ? p.area : undefined;
    const address = typeof p.address === 'string' ? p.address : undefined;
    const totalcar = typeof p.totalcar === 'number' ? p.totalcar : undefined;
    out.push({
      city: CITY,
      id,
      name,
      address: address ?? area,
      totalSpaces: totalcar && totalcar > 0 ? totalcar : undefined,
    });
  }
  return out;
}

function normalizeAvailability(raw: RawAvailability): Availability[] {
  const list = raw.data?.park ?? [];
  const updatedAt = parseUpdateTime(raw.data?.UPDATETIME);
  const out: Availability[] = [];
  for (const p of list) {
    const id = typeof p.id === 'string' ? p.id : undefined;
    const avail = typeof p.availablecar === 'number' ? p.availablecar : undefined;
    if (!id || avail === undefined || avail < 0) continue;
    out.push({ city: CITY, id, availableSpaces: avail, updatedAt });
  }
  return out;
}

function parseUpdateTime(raw: unknown): Date {
  if (typeof raw !== 'string') return new Date();
  // "Wed May 13 01:54:00 CST 2026" — Date.parse handles this on modern Node
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : new Date();
}
