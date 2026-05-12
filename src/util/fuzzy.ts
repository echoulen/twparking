export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()【】\[\]『』「」]/g, '');
}

export function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return true;
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return true;
  }
  return false;
}

export function fuzzyScore(haystack: string, needle: string): number {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return 0;
  const idx = h.indexOf(n);
  if (idx >= 0) return 1000 - idx;
  if (!fuzzyMatch(haystack, needle)) return -1;
  return 100;
}
