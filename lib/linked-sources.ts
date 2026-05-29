/**
 * Linkade-records-källor — registry för `Field.LinkedRecords`-pickern och
 * preview-uppslag via `useLinkedRecord` / `useLinkedRecords`.
 *
 * En "källa" är en Airtable-tabell som kan visas i en multi-select-picker.
 * Två kategorier:
 *
 *   - core_*-källor — delegeras till befintlig `/api/core/[entity]`-route
 *     internt (normaliseringen i `lib/core/mapper.ts` återanvänds). De är
 *     deklarerade i `lib/core/registry.ts::CORE_ENTITIES`.
 *
 *   - cms_*-källor — Airtable-tabeller som projekteras tunt (bara fält
 *     pickern behöver för label/thumbnail). Källorna deklareras nedan i
 *     `CMS_LINKED_SOURCES`.
 *
 * Båda kategorierna hämtas via en enda klient-endpoint `/api/linked/[source]`
 * som dispatchar internt. Whitelist-typen `LinkedSourceName` säkerställer
 * att klienten inte kan fritextspecificera ett tableId.
 *
 * När en ny sidtyp behöver en ny picker-källa: lägg till entry här (för
 * cms_*-tabeller) eller utöka `CORE_ENTITIES` (för core_*-tabeller). Lägg
 * sedan en `defaultLabel`-case i `LinkedRecords.tsx`.
 */

import { CORE_ENTITIES, type CoreEntityName } from './core/registry';

/**
 * CMS-tabeller som finns som linkbara källor (utöver core_*-mängden).
 * `fields` är minimal-projektionen — håll den smal så pickern blir snabb.
 */
export const CMS_LINKED_SOURCES = {
  /** cms_products — delar/komponenter med artikelnummer. Linkas av case-sidor. */
  products: {
    tableId: 'tblN23V7uAMpeZoO1',
    fields: [
      'name',
      'image_url',
      'is_active',
      'supplier_ids',
      'description',
    ] as const,
    sortField: 'name',
  },
  /** cms_articles — produktartiklar (SKU-nivå). Linkas av case-sidor. */
  articles: {
    tableId: 'tblhnz3MQG1JwfKrN',
    fields: [
      'name',
      'image_url',
      'article_number',
      'is_active',
      'supplier_ids',
      'description',
    ] as const,
    sortField: 'name',
  },
  /** cms_cases — kundcase-stories. Linkas av partner-sidor (success cases). */
  cases: {
    tableId: 'tblxH3ECSMvDTYrIQ',
    fields: [
      'slug',
      'title',
      'subtitle',
      'customer_name',
      'industry',
      'lead_image_url',
      'is_active',
      // Kort-lager — låter pickers/previews (t.ex. LP case-sidebar) visa kortet.
      'card_title',
      'card_description',
      'card_result',
      'card_image_url',
      'card_cta_text',
    ] as const,
    sortField: 'slug',
  },
  /** cms_product_pages — produktområdessidor. Linkas av partner-sidor (kategorier). */
  product_areas: {
    tableId: 'tbl5PQR7FNHCogeya',
    fields: [
      'slug',
      'name',
      'h1',
      'card_image_url',
      'card_description',
      'is_active',
    ] as const,
    sortField: 'slug',
  },
} as const;

export type CmsLinkedSourceName = keyof typeof CMS_LINKED_SOURCES;
export type LinkedSourceName = CoreEntityName | CmsLinkedSourceName;

export function isCmsLinkedSource(name: string): name is CmsLinkedSourceName {
  return name in CMS_LINKED_SOURCES;
}

export function isCoreLinkedSource(name: string): name is CoreEntityName {
  return name in CORE_ENTITIES;
}

export function isLinkedSourceName(name: string): name is LinkedSourceName {
  return isCmsLinkedSource(name) || isCoreLinkedSource(name);
}
