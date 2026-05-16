/** Landing-page — server-side sidtypsdefinition. */

import { AirtableRecord } from '../airtable';
import { AIRTABLE_FAMILIES } from '../airtable-registry';
import { loadLandingPageState } from '../landing-page-loader';
import { pageStateFromRecords } from '../page-mapper';
import { initialState } from '../state';
import { PageState } from '../types';
import { LP_ENTITIES } from '../wexoe-cache';
import { landingCreate, landingUpdate, landingDelete } from './landing-actions';
import type { PageTypeServerDef } from './types';

export interface LandingPageListItem {
  id: string;
  name: string;
  slug: string;
  h1: string;
  divisionIds: string[];
  countryIds: string[];
}

function emptyLandingState(): PageState {
  return { ...initialState, tabs: [], contactForm: { ...initialState.contactForm } };
}

export const landingServer: PageTypeServerDef<PageState, LandingPageListItem> = {
  id: 'landing',
  label: 'Landing',
  tableId: AIRTABLE_FAMILIES.landing.tables.landingPages,
  baseId: AIRTABLE_FAMILIES.landing.baseId,
  emptyState: emptyLandingState,
  fromRecord: (record) => pageStateFromRecords({ landingPage: record, tabs: [], downloadsByTabId: {} }),

  // Lager 3 — landing har specialflöde för tabs/downloads och Claude-transform.
  create: async (state, ctx) => {
    const result = await landingCreate(state, ctx);
    return { recordId: result.recordId, relations: {} };
  },
  update: async (recordId, state, ctx) => {
    await landingUpdate(recordId, state, ctx);
    return { relations: {} };
  },
  delete: landingDelete,

  validate: (s) => {
    if (!s.h1?.trim()) return { field: 'h1', message: 'H1 (rubrik) är obligatoriskt.' };
    return null;
  },
  listItemMapper: (r: AirtableRecord): LandingPageListItem => ({
    id: r.id,
    name: (r.fields.slug as string) || '',
    slug: (r.fields.slug as string) || '',
    h1: (r.fields.h1 as string) || '',
    divisionIds: (r.fields.division_ids as string[] | undefined) ?? [],
    countryIds: (r.fields.country_ids as string[] | undefined) ?? [],
  }),
  listFields: ['slug', 'h1', 'division_ids', 'country_ids'],
  listSort: [{ field: 'slug', direction: 'asc' }],
  cacheEntities: LP_ENTITIES,
  slug: {
    accessor: (s) => s.slug,
    field: 'slug',
    validateFormat: true,
    checkReserved: true,
    checkDuplicate: true,
  },
};

export { loadLandingPageState };
