import { AdapterError, type Availability, type CityAdapter, type ParkingLot } from './types.js';

const CITY = '基隆' as const;
const PAGE_URL = 'https://e-traffic.klcg.gov.tw/KeelungTraffic/pages/park.jsp/';

interface ParsedRow {
  name: string;
  available: number;
  updatedAt: Date;
}

export const adapter: CityAdapter = {
  city: CITY,
  async fetchCatalog() {
    try {
      const rows = await fetchAndParse();
      return rows.map((r): ParkingLot => ({ city: CITY, id: nameToId(r.name), name: r.name }));
    } catch (err) {
      throw new AdapterError(CITY, 'fetchCatalog failed', err);
    }
  },
  async fetchAvailability(lotIds) {
    try {
      const rows = await fetchAndParse();
      const all = rows.map(
        (r): Availability => ({
          city: CITY,
          id: nameToId(r.name),
          availableSpaces: r.available,
          updatedAt: r.updatedAt,
        }),
      );
      return lotIds ? all.filter((a) => lotIds.includes(a.id)) : all;
    } catch (err) {
      throw new AdapterError(CITY, 'fetchAvailability failed', err);
    }
  },
};

async function fetchAndParse(): Promise<ParsedRow[]> {
  const res = await fetch(PAGE_URL, {
    headers: { 'User-Agent': 'twparking', Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${PAGE_URL}`);
  const html = await res.text();
  return parseRows(html);
}

export function parseRows(html: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const trRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRegex.exec(html)) !== null) {
    const name = m[1]!.trim();
    const available = Number.parseInt(m[2]!, 10);
    const ts = parseTime(m[3]!.trim());
    if (!name || Number.isNaN(available)) continue;
    rows.push({ name, available, updatedAt: ts });
  }
  return rows;
}

function parseTime(raw: string): Date {
  // "2026-05-13 02:00" — 視為台北時區
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(raw);
  if (!m) return new Date();
  const [, y, mo, d, h, mi] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:00+08:00`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : new Date();
}

function nameToId(name: string): string {
  return name.replace(/\s+/g, '');
}
