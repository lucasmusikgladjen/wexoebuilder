/**
 * Unique-page write actions.
 *
 * cms_unique_pages innehåller flera rich long text-fält (t.ex. FAQ) där den
 * publika renderingen förväntar sig exakt format. Därför ska Claude alltid
 * vara sista transformeringssteget mellan builder-state och Airtable.
 */

import { createRecord, updateRecord, SSOT_BASE_ID } from '../airtable';
import { UNIQUE_PAGES_TABLE_ID } from '../unique-page-mapper';
import type { UniquePageState } from '../unique-page-types';
import { transformUniquePage } from '../claude-transform';
import type { CreateFn, UpdateFn } from '../route-factory';

function anthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY ej konfigurerad. Unique pages måste transformeras via Claude före Airtable.');
  return key;
}

export const uniquePageCreate: CreateFn<UniquePageState> = async (state, ctx) => {
  const fields = await transformUniquePage(anthropicKey(), state, 'create');
  const created = await createRecord(ctx.apiKey, UNIQUE_PAGES_TABLE_ID, fields, SSOT_BASE_ID);
  return { recordId: created.id, relations: {} };
};

export const uniquePageUpdate: UpdateFn<UniquePageState> = async (recordId, state, ctx) => {
  const fields = await transformUniquePage(anthropicKey(), state, 'update');
  await updateRecord(ctx.apiKey, UNIQUE_PAGES_TABLE_ID, recordId, fields, SSOT_BASE_ID);
  return { relations: {} };
};
