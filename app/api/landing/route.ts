import { landingServer, loadLandingPageState } from '@/lib/page-types/landing.server';
import { createPageRoute, pageTypeToRouteConfig } from '@/lib/route-factory';

export const { GET, POST, PATCH, DELETE } = createPageRoute(
  pageTypeToRouteConfig(landingServer, process.env.AIRTABLE_API_KEY, loadLandingPageState),
);
