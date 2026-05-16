/**
 * Airtable REST client.
 *
 * Default-basen är Wexoe NY (appokKSTaBdCa8YiW) för alla nya tabeller
 * (cms_landing_pages, cms_customer_type_pages, cms_case_pages, cms_articles,
 * core_*, etc.).
 *
 * `LEGACY_BASE_ID` (Wexoe, appXoUcK68dQwASjF) finns kvar för automation-
 * pillar-plugins (offerings, product_navigation, team_rack) som ännu inte
 * migrerats. Tabeller där: pass `baseId: LEGACY_BASE_ID` explicit.
 */

export { BASE_ID, LEGACY_BASE_ID, SSOT_BASE_ID, TABLE_IDS } from './airtable-registry';
import { BASE_ID } from './airtable-registry';

function resolveBaseId(baseId?: string): string {
  return baseId && baseId.length > 0 ? baseId : BASE_ID;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/** Create a single record in an Airtable table. */
export async function createRecord(
  apiKey: string,
  tableId: string,
  fields: Record<string, unknown>,
  baseId?: string,
): Promise<AirtableRecord> {
  const res = await fetch(
    `https://api.airtable.com/v0/${resolveBaseId(baseId)}/${tableId}`,
    {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ fields }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `Airtable error ${res.status}: ${tableId}`,
    );
  }

  return res.json();
}

/** Fetch a single record by ID. */
export async function getRecord(
  apiKey: string,
  tableId: string,
  recordId: string,
  baseId?: string,
): Promise<AirtableRecord> {
  const res = await fetch(
    `https://api.airtable.com/v0/${resolveBaseId(baseId)}/${tableId}/${recordId}`,
    { headers: authHeaders(apiKey) },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `Airtable error ${res.status}: ${tableId}/${recordId}`,
    );
  }
  return res.json();
}

/** PATCH a single record (partial update). */
export async function updateRecord(
  apiKey: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
  baseId?: string,
): Promise<AirtableRecord> {
  const res = await fetch(
    `https://api.airtable.com/v0/${resolveBaseId(baseId)}/${tableId}/${recordId}`,
    {
      method: 'PATCH',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `Airtable update error ${res.status}: ${tableId}/${recordId}`,
    );
  }
  return res.json();
}

/** Batch-PATCH records (max 10 per request). */
export async function updateRecords(
  apiKey: string,
  tableId: string,
  records: Array<{ id: string; fields: Record<string, unknown> }>,
  baseId?: string,
): Promise<AirtableRecord[]> {
  if (records.length === 0) return [];
  const results: AirtableRecord[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(
      `https://api.airtable.com/v0/${resolveBaseId(baseId)}/${tableId}`,
      {
        method: 'PATCH',
        headers: authHeaders(apiKey),
        body: JSON.stringify({ records: batch }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Airtable batch update error ${res.status}: ${tableId}`,
      );
    }
    const data = await res.json();
    results.push(...data.records);
  }
  return results;
}

/** Batch-DELETE records (max 10 per request). */
export async function deleteRecords(
  apiKey: string,
  tableId: string,
  recordIds: string[],
  baseId?: string,
): Promise<void> {
  if (recordIds.length === 0) return;
  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const params = batch.map((id) => `records[]=${encodeURIComponent(id)}`).join('&');
    const res = await fetch(
      `https://api.airtable.com/v0/${resolveBaseId(baseId)}/${tableId}?${params}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Airtable delete error ${res.status}: ${tableId}`,
      );
    }
  }
}

/** List records (auto-paginates). */
export async function listRecords(
  apiKey: string,
  tableId: string,
  opts: { filterByFormula?: string; fields?: string[]; sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>; baseId?: string } = {},
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    if (opts.filterByFormula) params.set('filterByFormula', opts.filterByFormula);
    if (opts.fields) opts.fields.forEach((f) => params.append('fields[]', f));
    if (opts.sort) {
      opts.sort.forEach((s, i) => {
        params.set(`sort[${i}][field]`, s.field);
        if (s.direction) params.set(`sort[${i}][direction]`, s.direction);
      });
    }
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${resolveBaseId(opts.baseId)}/${tableId}?${params.toString()}`,
      { headers: authHeaders(apiKey) },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Airtable list error ${res.status}: ${tableId}`,
      );
    }
    const data = await res.json();
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

/** Batch-create records (max 10 per Airtable request). */
export async function createRecords(
  apiKey: string,
  tableId: string,
  records: Array<{ fields: Record<string, unknown> }>,
  baseId?: string,
): Promise<AirtableRecord[]> {
  if (records.length === 0) return [];

  const results: AirtableRecord[] = [];

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(
      `https://api.airtable.com/v0/${resolveBaseId(baseId)}/${tableId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: batch }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Airtable batch error ${res.status}: ${tableId}`,
      );
    }

    const data = await res.json();
    results.push(...data.records);
  }

  return results;
}
