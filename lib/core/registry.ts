/**
 * SSOT-entity registry för builder /globals/*-vyn.
 *
 * Definierar vilka entiteter som kan editeras, deras Airtable table IDs,
 * och vilken roll varje har.
 *
 * Måste hållas i synk med:
 *   - `wexoeplugins/wexoe-core/entities/{name}.php`
 *   - `wexoeplugins/wexoe-core/src/EntityRestApi.php::CORE_EDITABLE_ENTITIES`
 */

import { CORE_TABLE_IDS } from '../airtable-registry';

export type CoreEntityRole = 'singleton' | 'taxonomy' | 'collection';

export interface CoreEntityDef {
  tableId: string;
  role: CoreEntityRole;
  label: string;
  description: string;
  /** Default sort field — primary key i schemat. */
  primaryKey: string;
  /** Låst till exakt ett record — builder visar ingen list-panel, inget skapa/radera. */
  singleRecord?: boolean;
}

export const CORE_ENTITIES = {
  core_company: {
    tableId: CORE_TABLE_IDS.coreCompany,
    role: 'singleton',
    label: 'Företag',
    description: 'Företagsinformation. Visas i headers, footers och mail-signaturer.',
    primaryKey: 'slug',
    singleRecord: true,
  },
  core_graphic_profile: {
    tableId: CORE_TABLE_IDS.coreGraphicProfile,
    role: 'singleton',
    label: 'Grafisk profil',
    description: 'Färger, loggor och typsnitt. Sätt Is Default på default-profilen.',
    primaryKey: 'slug',
  },
  core_countries: {
    tableId: CORE_TABLE_IDS.coreCountries,
    role: 'taxonomy',
    label: 'Länder',
    description: 'De marknader Wexoe är aktivt på.',
    primaryKey: 'code',
  },
  core_divisions: {
    tableId: CORE_TABLE_IDS.coreDivisions,
    role: 'taxonomy',
    label: 'Divisioner',
    description: 'Interna affärsindelningar (Industri, Automation, Kassasystem).',
    primaryKey: 'slug',
  },
  core_customer_types: {
    tableId: CORE_TABLE_IDS.coreCustomerTypes,
    role: 'taxonomy',
    label: 'Kundtyper',
    description: 'Kundsegment (Industri, Bygg, Offentlig sektor).',
    primaryKey: 'slug',
  },
  core_coworkers: {
    tableId: CORE_TABLE_IDS.coreCoworkers,
    role: 'collection',
    label: 'Medarbetare',
    description: 'Säljare, tekniker, övriga som ska visas på publika sidor.',
    primaryKey: 'full_name',
  },
  core_partners: {
    tableId: CORE_TABLE_IDS.corePartners,
    role: 'collection',
    label: 'Partners',
    description: 'Samarbetspartners (tillverkare, distributörer, certifieringsorgan).',
    primaryKey: 'name',
  },
  core_testimonials: {
    tableId: CORE_TABLE_IDS.coreTestimonials,
    role: 'collection',
    label: 'Citat',
    description: 'Kundreferenser med scope per customer type / division / country.',
    primaryKey: 'internal_name',
  },
} as const satisfies Record<string, CoreEntityDef>;

export type CoreEntityName = keyof typeof CORE_ENTITIES;

export const CORE_ENTITY_NAMES = Object.keys(CORE_ENTITIES) as CoreEntityName[];

export function isCoreEntityName(s: string): s is CoreEntityName {
  return s in CORE_ENTITIES;
}

/** Returnera entity-def som widened `CoreEntityDef` så optionella fält syns vid uppslag på unionstypen. */
export function getCoreEntityDef(name: CoreEntityName): CoreEntityDef {
  return CORE_ENTITIES[name] as CoreEntityDef;
}

export function isSingleRecordEntity(name: CoreEntityName): boolean {
  return getCoreEntityDef(name).singleRecord === true;
}
