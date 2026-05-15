/**
 * Unique-page — server-side sidtypsdefinition.
 *
 * Country/Division är linked-record-FÄLT direkt på record:en
 * (multipleRecordLinks som arrayer av IDs), inte separata child-records.
 * Field.LinkedRecords hanterar dem via /api/core. Skrivvägen är Layer 3:
 * Claude producerar Airtable-ready fields så rich long text-format (FAQ m.m.)
 * aldrig behöver skrivas manuellt av användaren.
 */

import { AirtableRecord, SSOT_BASE_ID } from '../airtable';
import {
  UNIQUE_PAGES_TABLE_ID,
  uniquePageStateFromRecord,
} from '../unique-page-mapper';
import { UniquePageState, emptyUniquePageState } from '../unique-page-types';
import { UNIQUE_PAGES_ENTITIES } from '../wexoe-cache';
import { uniquePageCreate, uniquePageUpdate } from './unique-page-actions';
import type { PageTypeServerDef } from './types';

export interface UniquePageListItem {
  id: string;
  slug: string;
  h1: string;
  published: boolean;
  divisionIds: string[];
  countryIds: string[];
}

export const uniquePageServer: PageTypeServerDef<UniquePageState, UniquePageListItem> = {
  id: 'unique-page',
  label: 'Egen sida',
  tableId: UNIQUE_PAGES_TABLE_ID,
  baseId: SSOT_BASE_ID,
  emptyState: emptyUniquePageState,
  fromRecord: uniquePageStateFromRecord,
  // Skrivvägen går alltid via Claude (se unique-page-actions.ts).
  create: uniquePageCreate,
  update: uniquePageUpdate,
  validate: (s) => {
    if (!s.h1?.trim()) return { field: 'h1', message: 'H1 är obligatorisk.' };
    return null;
  },
  listItemMapper: (r: AirtableRecord): UniquePageListItem => ({
    id: r.id,
    slug: (r.fields['slug'] as string) ?? '',
    h1: (r.fields['h1'] as string) ?? '',
    published: r.fields['is_published'] === true,
    divisionIds: (r.fields['division_ids'] as string[] | undefined) ?? [],
    countryIds: (r.fields['country_ids'] as string[] | undefined) ?? [],
  }),
  cacheEntities: UNIQUE_PAGES_ENTITIES,
  slug: {
    accessor: (s) => s.slug,
    field: 'slug',
    validateFormat: true,
    checkReserved: true,
    checkDuplicate: true,
  },
};
