import stringWidth from 'string-width';
import type { LotView } from '../adapters/types.js';

const LOW_THRESHOLD = 10;

export interface RenderInput {
  now: Date;
  intervalSec: number;
  views: LotView[];
  width: number;
  persistentFailures?: string[];
}

export const CURSOR_HOME_CLEAR = '\x1b[H\x1b[J';

export function renderScreen(input: RenderInput): string {
  const { now, intervalSec, views, width, persistentFailures = [] } = input;
  const header = renderHeader(now, intervalSec, persistentFailures);
  const table = renderTable(views, width);
  return `${header}\n\n${table}\n`;
}

const COLS = ['城市', '停車場', '剩餘 / 總數', '更新時間', '狀態'] as const;

function renderHeader(now: Date, sec: number, failures: string[]): string {
  const ts = formatNow(now);
  const fail = failures.length ? ` · (${failures.join(', ')} 持續失敗)` : '';
  return `twparking · ${ts} · refresh every ${sec}s · Ctrl+C to stop${fail}`;
}

function renderTable(views: LotView[], termWidth: number): string {
  const rows: string[][] = views.map(rowOf);
  const allRows: string[][] = [Array.from(COLS), ...rows];
  const widths = COLS.map((_, i) =>
    Math.max(...allRows.map((r) => stringWidth(r[i] ?? ''))),
  );
  const sep = '  ';
  const totalFixed = widths.reduce((a, b) => a + b, 0) + sep.length * (widths.length - 1);
  if (totalFixed > termWidth) {
    const overflow = totalFixed - termWidth;
    widths[1] = Math.max(8, (widths[1] ?? 0) - overflow);
  }
  return allRows
    .map((r) => r.map((cell, i) => padCell(cell ?? '', widths[i] ?? 0)).join(sep))
    .join('\n');
}

function padCell(text: string, w: number): string {
  const tw = stringWidth(text);
  if (tw === w) return text;
  if (tw < w) return text + ' '.repeat(w - tw);
  let acc = '';
  let used = 0;
  for (const ch of text) {
    const cw = stringWidth(ch);
    if (used + cw > w - 1) break;
    acc += ch;
    used += cw;
  }
  return acc + '…' + ' '.repeat(Math.max(0, w - stringWidth(acc) - 1));
}

function rowOf(v: LotView): string[] {
  const city = v.city;
  const name = v.name;
  const remaining = v.availability ? String(v.availability.availableSpaces) : '─';
  const total = v.totalSpaces ? String(v.totalSpaces) : '─';
  const occ = v.availability ? `${remaining} / ${total}` : remaining;
  const ts = v.availability ? formatTime(v.availability.updatedAt) : '─';
  let status = '';
  if (v.fetchError) status = `✗ fetch error: ${v.fetchError}`;
  else if (v.availability && v.availability.availableSpaces <= LOW_THRESHOLD) status = '⚠ 將滿';
  return [city, name, occ, ts, status];
}

function formatNow(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
