/**
 * Page-type registry.
 *
 * Minimal klient-säker metadata om varje sidtyp. Per-sidtyp `server.ts`
 * och `ui.tsx` importeras inte härifrån — anledningen är att registry:n
 * konsumeras av både client (homepage list) och server (API routes), och
 * att dra in UI-komponenter i server-bundlen (eller server-funktioner i
 * client-bundlen) bryter App Router:s split.
 *
 * Registry:n exponerar bara:
 *   - id, label, description
 *   - list-endpoint URL
 *   - edit/create-path-generatorer
 *   - mapper för list-svaret till homepage:ns `PageRow`-shape
 *
 * När en ny sidtyp läggs till (cases, leverantörer, nyheter, …):
 *   1. Designa Airtable-tabellen (fält + relations).
 *   2. Skapa `lib/page-types/<type>.server.ts` med PageTypeServerDef.
 *   3. Skapa `lib/page-types/<type>.ui.tsx` med PageTypeUIDef.
 *   4. Skapa `app/api/<type>/route.ts`:
 *        export const { GET, POST, PATCH, DELETE } = createPageRoute(
 *          pageTypeToRouteConfig(<type>Server, process.env.AIRTABLE_API_KEY, load<Type>State),
 *        );
 *   5. Skapa server-pages under `app/editor/<type>/page.tsx` (create) och
 *      `app/editor/<type>/[recordId]/page.tsx` (edit) — peka mot
 *      <PageTypeBuilder uiDef={<type>UI} … />.
 *   6. Lägg till entry i `PAGE_TYPES` nedan.
 *
 * Steg 6 är det enda som syns för slutanvändaren — homepage:n, filter,
 * "Ny sida"-dialogen och list-fetchen drivs alla från registry:n.
 */

import {
  CUSTOMER_TYPE_PAGE_ENTITIES,
  LP_ENTITIES,
  PA_ENTITIES,
  UNIQUE_PAGES_ENTITIES,
} from '../wexoe-cache-entities';

export type PageTypeId =
  | 'landing'
  | 'product'
  | 'customer-type'
  | 'unique';

export interface PageRow {
  id: string;
  name: string;
  slug: string;
  h1: string;
  type: PageTypeId;
  /** SSOT-länkar — populeras av list-mappers när sidtypen exponerar dem. */
  divisionIds?: string[];
  countryIds?: string[];
}

/** Format på det API-route:n returnerar för `?action=list`. Olika sidtyper
 *  har olika `pages[i]`-shapes — varje registry-entry har sin egen mapper. */
interface RawListResponse {
  pages?: Array<Record<string, unknown>>;
  error?: string;
}

export interface PageTypeMeta {
  id: PageTypeId;
  /** Visningsnamn (kort), t.ex. "Kundtyp". */
  label: string;
  /** Längre beskrivning för "Ny sida"-dialogen. */
  description: string;
  /** Är typen skapbar via UI?n? Sätt false för system-typer. */
  creatable: boolean;
  /** URL till listans GET-endpoint. */
  listUrl: string;
  /** Path till create-vyn. */
  createPath: string;
  /** Path till edit-vyn för ett givet record. */
  editPath: (recordId: string) => string;
  /** Core-entiteter som ska invalidieras när sidtypen muteras. */
  cacheEntities: readonly string[];
  /** Konvertera ett list-response till homepage:ns PageRow[]. */
  mapList: (data: RawListResponse) => PageRow[];
}

function pickString(p: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

function pickStringArray(p: Record<string, unknown>, key: string): string[] | undefined {
  const v = p[key];
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : undefined;
}

function definePageTypes<const T extends readonly PageTypeMeta[]>(types: T): T {
  const seen = new Set<PageTypeId>();
  for (const type of types) {
    if (seen.has(type.id)) throw new Error(`Duplicate page type id: ${type.id}`);
    seen.add(type.id);
  }
  return types;
}

export const PAGE_TYPES = definePageTypes([
  {
    id: 'landing',
    label: 'Landing',
    description: 'Kampanj- och konverteringssida',
    creatable: true,
    listUrl: '/api/landing?action=list',
    createPath: '/editor',
    editPath: (id) => `/editor/${id}`,
    cacheEntities: LP_ENTITIES,
    mapList: (data) =>
      (data.pages ?? []).map((p) => ({
        id: pickString(p, 'id'),
        name: pickString(p, 'name', 'h1', 'slug'),
        slug: pickString(p, 'slug'),
        h1: pickString(p, 'h1'),
        type: 'landing',
        divisionIds: pickStringArray(p, 'divisionIds'),
        countryIds: pickStringArray(p, 'countryIds'),
      })),
  },
  {
    id: 'product',
    label: 'Produkt',
    description: 'Produktområdesida med produkter och lösningar',
    creatable: true,
    listUrl: '/api/product-area?action=list',
    createPath: '/editor/product-area',
    editPath: (id) => `/editor/product-area/${id}`,
    cacheEntities: PA_ENTITIES,
    mapList: (data) =>
      (data.pages ?? []).map((p) => ({
        id: pickString(p, 'id'),
        name: pickString(p, 'name', 'h1', 'slug'),
        slug: pickString(p, 'slug'),
        h1: pickString(p, 'h1'),
        type: 'product',
        divisionIds: pickStringArray(p, 'divisionIds'),
      })),
  },
  {
    id: 'customer-type',
    label: 'Kundtyp',
    description: 'Kundtyp hero + värdeproposition + länkade case',
    creatable: true,
    listUrl: '/api/customer-type?action=list',
    createPath: '/editor/customer-type',
    editPath: (id) => `/editor/customer-type/${id}`,
    cacheEntities: CUSTOMER_TYPE_PAGE_ENTITIES,
    mapList: (data) =>
      (data.pages ?? []).map((p) => ({
        id: pickString(p, 'id'),
        name: pickString(p, 'name', 'slug'),
        slug: pickString(p, 'slug'),
        h1: pickString(p, 'h1'),
        type: 'customer-type',
      })),
  },
  {
    id: 'unique',
    label: 'Egen',
    description: 'Tier 2-sida (om-oss, karriär osv.) med fast sektion-struktur',
    creatable: true,
    listUrl: '/api/unique-page?action=list',
    createPath: '/editor/unique',
    editPath: (id) => `/editor/unique/${id}`,
    cacheEntities: UNIQUE_PAGES_ENTITIES,
    mapList: (data) =>
      (data.pages ?? []).map((p) => ({
        id: pickString(p, 'id'),
        name: pickString(p, 'h1', 'slug'),
        slug: pickString(p, 'slug'),
        h1: pickString(p, 'h1'),
        type: 'unique',
        divisionIds: pickStringArray(p, 'divisionIds'),
        countryIds: pickStringArray(p, 'countryIds'),
      })),
  },
]);

export function getPageType(id: PageTypeId): PageTypeMeta {
  const found = PAGE_TYPES.find((t) => t.id === id);
  if (!found) throw new Error(`Okänd page type: ${id}`);
  return found;
}

export const TYPE_LABEL: Record<PageTypeId, string> = Object.fromEntries(
  PAGE_TYPES.map((t) => [t.id, t.label]),
) as Record<PageTypeId, string>;
