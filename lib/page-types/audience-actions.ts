/**
 * Audience write actions.
 *
 * Viktigt: även om Audience-schemat är platt ska användarens builder-state
 * alltid passera Claude innan Airtable skrivs. Det håller samma invariant som
 * LP/PA: UI:t är för människor, Claude producerar Airtable-ready fields.
 */

import { createRecord, updateRecord } from '../airtable';
import { AUDIENCE_BASE_ID, AUDIENCE_TABLE_IDS } from '../audience-mapper';
import type { AudienceState } from '../audience-types';
import { transformAudiencePage } from '../claude-transform';
import type { CreateFn, UpdateFn } from '../route-factory';

function anthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY ej konfigurerad. Audience-sidor måste transformeras via Claude före Airtable.');
  return key;
}

export const audienceCreate: CreateFn<AudienceState> = async (state, ctx) => {
  const fields = await transformAudiencePage(anthropicKey(), state, 'create');
  const created = await createRecord(ctx.apiKey, AUDIENCE_TABLE_IDS.audienceHeroes, fields, AUDIENCE_BASE_ID);
  return { recordId: created.id, relations: {} };
};

export const audienceUpdate: UpdateFn<AudienceState> = async (recordId, state, ctx) => {
  const fields = await transformAudiencePage(anthropicKey(), state, 'update');
  await updateRecord(ctx.apiKey, AUDIENCE_TABLE_IDS.audienceHeroes, recordId, fields, AUDIENCE_BASE_ID);
  return { relations: {} };
};
