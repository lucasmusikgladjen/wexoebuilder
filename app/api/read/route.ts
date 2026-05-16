/**
 * Back-compat alias for the old Landing Page read endpoint.
 *
 * New code should use /api/landing, which is driven by the page-type route
 * factory. This alias keeps older bookmarks/integrations working while the
 * builder registry has moved to /api/landing.
 */

export { GET } from '../landing/route';
