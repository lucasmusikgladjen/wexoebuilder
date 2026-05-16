/**
 * CRUD-route för Product Area-records.
 *
 * Drivs av createPageRoute() (Lager 3 — `create`/`update`-overrides bor i
 * `lib/page-types/product-area-actions.ts`). Routen får standardiserad
 * slug-validering, felformat och cache-invalidering, men skrivvägen är
 * fortfarande Claude-driven via productAreaCreate/Update.
 *
 * `?action=list-divisions` är borttagen — server-pages använder
 * loadDivisions() direkt istället för att gå via routen.
 *
 * Product Area-familjen ligger i Wexoe NY och hämtar `baseId` från
 * productAreaServer/PA_BASE_ID så route, loader och copy delar samma sanning.
 */

import { productAreaServer, loadProductAreaState } from '@/lib/page-types/product-area.server';
import { createPageRoute, pageTypeToRouteConfig } from '@/lib/route-factory';

export const { GET, POST, PATCH, DELETE } = createPageRoute(
  pageTypeToRouteConfig(productAreaServer, process.env.AIRTABLE_API_KEY, loadProductAreaState),
);
