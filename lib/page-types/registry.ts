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

export type PageTypeId =
  | 'landing'
  | 'product'
  | 'audience'
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
  /** Wexoe Core cache entities som ska invalideras när typen publiceras/sparas. */
  cacheEntities: readonly string[];
  /** Konvertera ett list-response till homepage:ns PageRow[]. */
  mapList: (data: RawListResponse) => PageRow[];
}


type DuplicatePageTypeIdError<TId extends string> = {
  __duplicatePageTypeId: TId;
};

type AssertUniquePageTypeIds<
  TItems extends readonly { id: string }[],
  TSeen extends string = never,
> = TItems extends readonly [infer THead, ...infer TTail]
  ? THead extends { id: infer TId extends string }
    ? TId extends TSeen
      ? DuplicatePageTypeIdError<TId>
      : TTail extends readonly { id: string }[]
        ? readonly [THead, ...AssertUniquePageTypeIds<TTail, TSeen | TId>]
        : TItems
    : TItems
  : TItems;

function definePageTypes<const TItems extends readonly PageTypeMeta[]>(
  items: TItems & AssertUniquePageTypeIds<TItems>,
): TItems {
  return items;
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

export const PAGE_TYPES = definePageTypes([
  {
    id: 'landing',
    label: 'Landing',
    description: 'Kampanj- och konverteringssida',
    creatable: true,
    listUrl: '/api/read?action=list',
    cacheEntities: ['landing_pages', 'lp_tabs', 'lp_downloads'],
    createPath: '/editor',
    editPath: (id) => `/editor/${id}`,
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
    cacheEntities: ['product_areas', 'products', 'solutions'],
    createPath: '/editor/product-area',
    editPath: (id) => `/editor/product-area/${id}`,
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
    id: 'audience',
    label: 'Kundtyp',
    description: 'Kundtyp hero + värdeproposition',
    creatable: true,
    listUrl: '/api/audience?action=list',
    cacheEntities: ['audience_heroes'],
    createPath: '/editor/audience',
    editPath: (id) => `/editor/audience/${id}`,
    mapList: (data) =>
      (data.pages ?? []).map((p) => ({
        id: pickString(p, 'id'),
        name: pickString(p, 'name', 'slug'),
        slug: pickString(p, 'slug'),
        h1: pickString(p, 'h1'),
        type: 'audience',
      })),
  },
  {
    id: 'unique',
    label: 'Egen',
    description: 'Tier 2-sida (om-oss, karriär osv.) med fast sektion-struktur',
    creatable: true,
    listUrl: '/api/unique-page?action=list',
    cacheEntities: ['cms_unique_pages'],
    createPath: '/editor/unique',
    editPath: (id) => `/editor/unique/${id}`,
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
