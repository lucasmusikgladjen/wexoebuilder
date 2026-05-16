/**
 * Central Airtable configuration.
 *
 * Keep base IDs, table IDs and field-casing expectations in one place so
 * migration status is expressed as data instead of drifting comments.
 */

export const BASE_ID = 'appokKSTaBdCa8YiW';
export const LEGACY_BASE_ID = 'appXoUcK68dQwASjF';
export const SSOT_BASE_ID = BASE_ID;

export const LANDING_TABLE_IDS = {
  landingPages: 'tblpPlk17FZIKawXY',
  landingPageTabs: 'tblp8d32aj5BgGMvE',
  landingPageDownloads: 'tbltAtilGKnQ2wc7I',
  // Legacy aliases (matches old key names while we phase out call sites)
  tabs: 'tblp8d32aj5BgGMvE',
  downloads: 'tbltAtilGKnQ2wc7I',
} as const;

export const PRODUCT_AREA_TABLE_IDS = {
  productAreas: 'tbl5PQR7FNHCogeya',
  productPageSections: 'tbl1r3T3ukIPJ0S3N',
  products: 'tblN23V7uAMpeZoO1',
  articles: 'tblhnz3MQG1JwfKrN',
  solutions: 'tblxK7ikOgLFuze6m',
  divisions: 'tblyxs2zsoRBozxQS',
} as const;

export const CUSTOMER_TYPE_TABLE_IDS = {
  customerTypePages: 'tblZufoWVNKPuJdMK',
  casePages: 'tbl3uMV6IpRIZeucA',
} as const;

export const CORE_TABLE_IDS = {
  coreCompany: 'tblwq9y74ertsNyYG',
  coreGraphicProfile: 'tbl4c4HjiKVCcJI5v',
  coreCountries: 'tblCZ082jWGUBrUAK',
  coreDivisions: 'tblyxs2zsoRBozxQS',
  coreCustomerTypes: 'tblLsYRMZz6JA6GBK',
  coreCoworkers: 'tblYwMQlW9HFd41pg',
  corePartners: 'tblZ5YIYFelxA0nBm',
  coreTestimonials: 'tbl1pe0bWz5zdkqJF',
} as const;

export const AIRTABLE_FAMILIES = {
  landing: {
    baseId: BASE_ID,
    fieldCase: 'snake_case',
    tables: LANDING_TABLE_IDS,
    status: 'migrated',
  },
  productArea: {
    baseId: BASE_ID,
    fieldCase: 'snake_case',
    tables: PRODUCT_AREA_TABLE_IDS,
    status: 'migrated',
  },
  customerType: {
    baseId: BASE_ID,
    fieldCase: 'snake_case',
    tables: CUSTOMER_TYPE_TABLE_IDS,
    status: 'migrated',
  },
  core: {
    baseId: BASE_ID,
    fieldCase: 'snake_case',
    tables: CORE_TABLE_IDS,
    status: 'migrated',
  },
  legacyAutomation: {
    baseId: LEGACY_BASE_ID,
    fieldCase: 'legacy_mixed',
    tables: {},
    status: 'legacy',
  },
} as const;

export type AirtableFamilyName = keyof typeof AIRTABLE_FAMILIES;

// Back-compat export for legacy callers that still import TABLE_IDS from
// lib/airtable.ts. New code should prefer AIRTABLE_FAMILIES.<family>.tables.
export const TABLE_IDS = LANDING_TABLE_IDS;
