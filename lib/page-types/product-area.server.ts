/**
 * Product Area — server-side sidtypsdefinition (Lager 3).
 *
 * Product-area passar inte i Lager 2 (declarative relations) eftersom dess
 * Airtable-fält genereras av Claude. Vi använder Lager 3:s `create`/`update`-
 * overrides via factory:n och håller den befintliga Claude+products+solutions-
 * koden i `product-area-actions.ts`.
 *
 * Routen får trots det samma standarder som övriga sidtyper:
 *   - Slug-validering + duplikat-koll
 *   - `{ success, error, code? }`-felformat
 *   - DELETE-endpoint
 *   - Wexoe Core cache-invalidering
 *
 * `emptyState` / `fromRecord` / `stateToFields` lämnas oexponerade här
 * eftersom (a) factory:n behöver dem inte när create/update är override:de,
 * (b) `loadProductAreaState()` är den enda korrekta load-vägen (den hämtar
 * PA + products + articles + solutions i en sweep), och (c) `emptyProductAreaState`
 * importeras direkt av create-page:n.
 */

import { AirtableRecord } from '../airtable';
import {
  productAreaCreate,
  productAreaUpdate,
  type ProductAreaListItem,
} from './product-area-actions';
import { loadProductAreaState } from '../product-area-loader';
import { PA_TABLE_IDS, PA_BASE_ID } from '../product-area-mapper';
import { ProductAreaState } from '../product-area-types';
import { PA_ENTITIES } from '../wexoe-cache';
import type { PageTypeServerDef } from './types';

export const productAreaServer: PageTypeServerDef<ProductAreaState, ProductAreaListItem> = {
  id: 'product-area',
  label: 'Produktområde',
  tableId: PA_TABLE_IDS.productAreas,
  baseId: PA_BASE_ID,

  // Lager 3 — hela skriv-vägen är override:d.
  create: productAreaCreate,
  update: productAreaUpdate,

  validate: (s) => {
    if (!s.h1?.trim()) return { field: 'h1', message: 'H1 är obligatoriskt.' };
    return null;
  },
  listItemMapper: (r: AirtableRecord): ProductAreaListItem => ({
    id: r.id,
    name: (r.fields.Name as string) || '',
    slug: (r.fields.Slug as string) || '',
    h1: (r.fields.H1 as string) || '',
    divisionIds: (r.fields.Division as string[] | undefined) ?? [],
  }),
  listFields: ['Name', 'Slug', 'H1', 'Division'],
  listSort: [{ field: 'Name', direction: 'asc' }],

  cacheEntities: PA_ENTITIES,

  slug: {
    accessor: (s) => s.slug,
    field: 'Slug',
    checkDuplicate: true,
  },
};

export { loadProductAreaState };
