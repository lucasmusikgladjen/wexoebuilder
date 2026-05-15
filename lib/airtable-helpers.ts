/**
 * Gemensamma fältkonverterare för Airtable-records.
 *
 * Två stilar exponeras:
 *   - Värdebaserade (asString, asBool, ...) tar ett enskilt värde.
 *   - Fältbaserade (str, bool, ...) tar ett fields-objekt + nyckel.
 *
 * `bool`/`asBool` är trevägs: returnerar true/false vid explicita boolean-värden
 * och `fallback` (default false) annars. Det skiljer på "medvetet av" och
 * "inte satt" så contact-form-toggles kan behålla sin default när record:en
 * saknar fältet.
 */

export type AirtableFields = Record<string, unknown>;

// ─── Värdebaserade ─────────────────────────────────────────────────────────

export function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return '';
}

export function asBool(v: unknown, fallback = false): boolean {
  if (v === true || v === 'true' || v === 1) return true;
  if (v === false || v === 'false' || v === 0) return false;
  return fallback;
}

export function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export function asLinkIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

// ─── Fältbaserade (shorthand) ──────────────────────────────────────────────

export function str(fields: AirtableFields, key: string): string {
  return asString(fields[key]);
}

export function bool(fields: AirtableFields, key: string, fallback = false): boolean {
  return asBool(fields[key], fallback);
}

export function num(fields: AirtableFields, key: string, fallback = 0): number {
  return asNumber(fields[key], fallback);
}

export function strArray(fields: AirtableFields, key: string): string[] {
  return asLinkIds(fields[key]);
}

export function linkedIds(fields: AirtableFields, key: string): string[] {
  return asLinkIds(fields[key]);
}
