/**
 * Route-factory för sidtypsspecifika CRUD-routes.
 *
 * Trelagsmodellen:
 *   Lager 1 — Standard CRUD för primary record (behålls som infrastruktur, men publika page-saves ska använda Claude-overrides).
 *   Lager 2 — Declarative relations (RelationDef) — ramverket diff:ar
 *             state mot Airtable och skapar/uppdaterar/raderar child-records.
 *   Lager 3 — Full override via `create` / `update` / `delete` hooks när
 *             ingen av de andra två räcker.
 *
 * Endpoints (alla returnerar `{ success: false, error, code? }` vid fel):
 *   GET    ?action=list             — lista records
 *   GET    ?action=get&id=recXXX    — ladda en records state (om loadState gives)
 *   POST                            — create
 *   PATCH  ?id=recXXX               — update
 *   DELETE ?id=recXXX               — delete (cascade owned relations)
 *
 * Save-responsen från POST/PATCH inkluderar `relations: Record<id, RelationSyncResult>`
 * så klienten kan applicera clientId→recordId-mappningar utan reload.
 *
 * Se `lib/page-types/types.ts` för typer och `lib/page-types/relation-sync.ts`
 * för synkningsmotorn.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AirtableRecord,
  createRecord,
  updateRecord,
  deleteRecords,
  listRecords,
  getRecord,
} from './airtable';
import { invalidateWexoeCoreCache } from './wexoe-cache';
import { isReservedSlug } from './core/reserved-slugs';
import {
  syncRelations,
  computeFinalParentArrays,
  deleteRelationChildren,
} from './page-types/relation-sync';
import type { PageTypeServerDef, RelationDef, RelationSyncResult } from './page-types/types';

// ─── Response shapes ───────────────────────────────────────────────────────

export interface PageRouteListResponse<TListItem> {
  success: true;
  pages: TListItem[];
}

export interface PageRouteErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export interface PageRouteSaveResponse {
  success: true;
  mode: 'create' | 'update';
  recordId: string;
  relations: Record<string, RelationSyncResult>;
}

// ─── Route config ──────────────────────────────────────────────────────────

export interface RouteContext {
  apiKey: string;
}

export type CreateFn<TState> = (
  state: TState,
  ctx: RouteContext,
) => Promise<{ recordId: string; relations?: Record<string, RelationSyncResult> }>;

export type UpdateFn<TState> = (
  recordId: string,
  state: TState,
  ctx: RouteContext,
) => Promise<{ relations?: Record<string, RelationSyncResult> }>;

export type DeleteFn = (recordId: string, ctx: RouteContext) => Promise<void>;

export interface PageRouteConfig<TState, TListItem> {
  // ─── Lager 1: primary ────────────────────────────────────────────────
  /** Vilken Airtable-tabell sidtypen lever i. */
  tableId: string;
  /** Vilken Airtable-bas. Default är SSOT-basen (BASE_ID i airtable.ts). */
  baseId?: string;
  /** API-nyckel — typiskt `process.env.AIRTABLE_API_KEY`. */
  apiKey: string | undefined;

  /** Vilka core-entiteter som ska cache-invalideras efter mutation. */
  cacheEntities?: readonly string[];
  /** Prefix för cache-context-loggning, t.ex. 'unique-page' → 'unique-page/create'. */
  cacheContext: string;

  /** Hämta full state för en record (för ?action=get). Om utelämnad
   *  returnerar GET 400 för action=get. */
  loadState?: (apiKey: string, recordId: string) => Promise<TState>;
  /** State → Airtable-fält (mode-aware för create-drops-empties etc).
   *  Krävs när `create`/`update`-overrides inte används. */
  stateToFields?: (state: TState, mode: 'create' | 'update') => Record<string, unknown>;
  /** Fält som ska hämtas vid list (mappas sen via listMapper). */
  listFields?: readonly string[];
  /** Hur en Airtable-record presenteras i list-svaret. */
  listMapper: (record: AirtableRecord) => TListItem;
  /** Sort-instruktion till list. Default: ingen sortering. */
  listSort?: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>;

  /** Slug-policy — om utelämnad körs ingen slug-logik. */
  slugAccessor?: (state: TState) => string;
  /** Airtable-fältnamnet för slug — krävs om slugAccessor satt. Default 'Slug'. */
  slugField?: string;
  validateSlugFormat?: boolean;
  checkReservedSlug?: boolean;
  checkDuplicateSlug?: boolean;

  /** Valfri extra validering — returnera felmeddelande eller null. */
  validate?: (state: TState) => string | null;

  // ─── Lager 2: relations ──────────────────────────────────────────────
  /** Declarative relations. Tomma/utelämnat = bara primary record. */
  relations?: ReadonlyArray<RelationDef<TState, unknown>>;

  // ─── Lager 3: full overrides ─────────────────────────────────────────
  /**
   * Helt egen create-logik. Anropas istället för stateToFields + createRecord
   * + relations-sync. Override:n är ansvarig för att skriva både primary och
   * eventuella relations själv. Returnera samma shape som standardimplementationen.
   * Slug-validering, validate-hooken och cache-invalidering körs fortfarande
   * av factory:n runtomkring.
   */
  create?: CreateFn<TState>;
  /** Som `create` men för update. */
  update?: UpdateFn<TState>;
  /**
   * Egen delete-logik. Default tar bort primary + cascade owned relations.
   * Override:n är ansvarig för båda delar.
   */
  delete?: DeleteFn;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function badRequest(error: string, code?: string): NextResponse<PageRouteErrorResponse> {
  return NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status: 400 });
}
function conflict(error: string, code: string): NextResponse<PageRouteErrorResponse> {
  return NextResponse.json({ success: false, error, code }, { status: 409 });
}
function serverError(error: string): NextResponse<PageRouteErrorResponse> {
  return NextResponse.json({ success: false, error }, { status: 500 });
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

async function runSlugChecks<TState, TListItem>(
  cfg: PageRouteConfig<TState, TListItem>,
  apiKey: string,
  state: TState,
  excludeRecordId: string | null,
): Promise<NextResponse<PageRouteErrorResponse> | null> {
  if (!cfg.slugAccessor) return null;
  const slug = cfg.slugAccessor(state);
  if (!slug || !slug.trim()) return badRequest('Slug är obligatoriskt.');

  if (cfg.validateSlugFormat && !SLUG_REGEX.test(slug)) {
    return badRequest('Slug får bara innehålla lower-case bokstäver, siffror och bindestreck.');
  }
  if (cfg.checkReservedSlug && isReservedSlug(slug)) {
    return badRequest(`Slug "${slug}" är reserverad och kan inte användas.`);
  }
  if (cfg.checkDuplicateSlug) {
    const slugField = cfg.slugField ?? 'Slug';
    const existing = await listRecords(apiKey, cfg.tableId, {
      baseId: cfg.baseId,
      filterByFormula: `{${slugField}}="${slug.replace(/"/g, '\\"')}"`,
    });
    const collision = existing.find((r) => r.id !== excludeRecordId);
    if (collision) {
      return conflict(
        excludeRecordId
          ? 'En annan sida har redan den slug:en.'
          : 'En sida med den slug:en finns redan.',
        'duplicate_slug',
      );
    }
  }
  return null;
}

async function invalidateCache<TState, TListItem>(
  cfg: PageRouteConfig<TState, TListItem>,
  action: 'create' | 'update' | 'delete',
): Promise<void> {
  if (!cfg.cacheEntities || cfg.cacheEntities.length === 0) return;
  await invalidateWexoeCoreCache(cfg.cacheEntities, `${cfg.cacheContext}/${action}`);
}

/**
 * Lager 2-implementation av create: skapa primary, sen sync:a relations,
 * sen skriv parent.parentField för alla parentLinkArray-relationer.
 */
async function defaultCreate<TState, TListItem>(
  cfg: PageRouteConfig<TState, TListItem>,
  state: TState,
  ctx: RouteContext,
): Promise<{ recordId: string; relations: Record<string, RelationSyncResult> }> {
  if (!cfg.stateToFields) {
    throw new Error('createPageRoute: behöver stateToFields eller `create` override.');
  }
  const primaryFields = cfg.stateToFields(state, 'create');
  const created = await createRecord(ctx.apiKey, cfg.tableId, primaryFields, cfg.baseId);

  if (!cfg.relations || cfg.relations.length === 0) {
    return { recordId: created.id, relations: {} };
  }

  // Vid create finns inga existing children — sync ger oss bara create-grenen.
  // Vi passar in den nya parent-record:en (parentField är tom).
  const relations = await syncRelations(ctx.apiKey, created.id, created, state, cfg.relations);
  const parentArrayUpdates = computeFinalParentArrays(state, cfg.relations, relations);
  if (Object.keys(parentArrayUpdates).length > 0) {
    await updateRecord(ctx.apiKey, cfg.tableId, created.id, parentArrayUpdates, cfg.baseId);
  }
  return { recordId: created.id, relations };
}

/**
 * Lager 2-implementation av update: läs parent (för parentField), skriv
 * primary, sync:a relations, skriv parent.parentField för alla
 * parentLinkArray-relationer.
 */
async function defaultUpdate<TState, TListItem>(
  cfg: PageRouteConfig<TState, TListItem>,
  recordId: string,
  state: TState,
  ctx: RouteContext,
): Promise<{ relations: Record<string, RelationSyncResult> }> {
  if (!cfg.stateToFields) {
    throw new Error('createPageRoute: behöver stateToFields eller `update` override.');
  }
  const primaryFields = cfg.stateToFields(state, 'update');

  // Vi behöver parent-record:en för parentLinkArray-diff. Skriv primary
  // FÖRST, läs efteråt — då har vi senaste tillståndet av parentField
  // (även om PATCH inte ändrade det, så är det det aktuella värdet).
  // OBS: alternativet är att läsa innan PATCH, men då riskerar vi race
  // conditions. Att läsa efter är konsekvent.
  await updateRecord(ctx.apiKey, cfg.tableId, recordId, primaryFields, cfg.baseId);

  if (!cfg.relations || cfg.relations.length === 0) {
    return { relations: {} };
  }

  const parentRecord = await getRecord(ctx.apiKey, cfg.tableId, recordId, cfg.baseId);
  const relations = await syncRelations(ctx.apiKey, recordId, parentRecord, state, cfg.relations);
  const parentArrayUpdates = computeFinalParentArrays(state, cfg.relations, relations);
  if (Object.keys(parentArrayUpdates).length > 0) {
    await updateRecord(ctx.apiKey, cfg.tableId, recordId, parentArrayUpdates, cfg.baseId);
  }
  return { relations };
}

async function defaultDelete<TState, TListItem>(
  cfg: PageRouteConfig<TState, TListItem>,
  recordId: string,
  ctx: RouteContext,
): Promise<void> {
  if (cfg.relations && cfg.relations.length > 0) {
    const parentRecord = await getRecord(ctx.apiKey, cfg.tableId, recordId, cfg.baseId);
    await deleteRelationChildren(ctx.apiKey, recordId, parentRecord, cfg.relations);
  }
  await deleteRecords(ctx.apiKey, cfg.tableId, [recordId], cfg.baseId);
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createPageRoute<TState, TListItem>(
  cfg: PageRouteConfig<TState, TListItem>,
) {
  // Konfigurationssanity — fångas vid första requesten, inte vid modul-laddning,
  // för att inte krascha vid bygg-tid om en sidtyp inte används än.
  function assertCfgValid(): NextResponse<PageRouteErrorResponse> | null {
    if (!cfg.stateToFields && (!cfg.create || !cfg.update)) {
      return serverError(
        'createPageRoute: konfigurationen saknar stateToFields OCH create/update-overrides.',
      );
    }
    return null;
  }

  async function GET(req: NextRequest): Promise<NextResponse> {
    if (!cfg.apiKey) return serverError('AIRTABLE_API_KEY ej konfigurerad.');
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    try {
      if (action === 'list') {
        const records = await listRecords(cfg.apiKey, cfg.tableId, {
          baseId: cfg.baseId,
          fields: cfg.listFields ? [...cfg.listFields] : undefined,
          sort: cfg.listSort ? [...cfg.listSort] : undefined,
        });
        const pages = records.map(cfg.listMapper);
        const response: PageRouteListResponse<TListItem> = { success: true, pages };
        return NextResponse.json(response);
      }

      if (action === 'get') {
        if (!cfg.loadState) return badRequest('action=get stöds inte för denna sidtyp.');
        const recordId = url.searchParams.get('id');
        if (!recordId) return badRequest('Saknar ?id=recXXX.');
        const state = await cfg.loadState(cfg.apiKey, recordId);
        return NextResponse.json({ success: true, state });
      }

      return badRequest('Okänd action. Använd ?action=list eller ?action=get&id=recXXX.');
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Okänt fel.');
    }
  }

  async function POST(req: NextRequest): Promise<NextResponse> {
    const cfgError = assertCfgValid();
    if (cfgError) return cfgError;
    if (!cfg.apiKey) return serverError('AIRTABLE_API_KEY ej konfigurerad.');

    let state: TState;
    try { state = (await req.json()) as TState; } catch { return badRequest('Ogiltig JSON.'); }

    // Slug-validering, custom validate och mutation körs alla inom samma
    // try/catch så Airtable/nätverksfel under duplicate-slug-lookupen blir
    // ett 500-JSON-svar (`{ success: false, error }`) istället för att
    // bubbla upp som en oformaterad Next.js-500 utan body.
    try {
      const slugError = await runSlugChecks(cfg, cfg.apiKey, state, null);
      if (slugError) return slugError;

      if (cfg.validate) {
        const msg = cfg.validate(state);
        if (msg) return badRequest(msg);
      }

      const ctx: RouteContext = { apiKey: cfg.apiKey };
      const result = cfg.create
        ? await cfg.create(state, ctx)
        : await defaultCreate(cfg, state, ctx);
      await invalidateCache(cfg, 'create');
      const response: PageRouteSaveResponse = {
        success: true,
        mode: 'create',
        recordId: result.recordId,
        relations: result.relations ?? {},
      };
      return NextResponse.json(response, { status: 201 });
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Create misslyckades.');
    }
  }

  async function PATCH(req: NextRequest): Promise<NextResponse> {
    const cfgError = assertCfgValid();
    if (cfgError) return cfgError;
    if (!cfg.apiKey) return serverError('AIRTABLE_API_KEY ej konfigurerad.');
    const url = new URL(req.url);
    const recordId = url.searchParams.get('id');
    if (!recordId) return badRequest('Saknar ?id=recXXX.');

    let state: TState;
    try { state = (await req.json()) as TState; } catch { return badRequest('Ogiltig JSON.'); }

    // Se POST-kommentaren — slug-validering inom samma try så Airtable/
    // nätverksfel under duplicate-slug-lookupen ger ett 500-JSON-svar.
    try {
      const slugError = await runSlugChecks(cfg, cfg.apiKey, state, recordId);
      if (slugError) return slugError;

      if (cfg.validate) {
        const msg = cfg.validate(state);
        if (msg) return badRequest(msg);
      }

      const ctx: RouteContext = { apiKey: cfg.apiKey };
      const result = cfg.update
        ? await cfg.update(recordId, state, ctx)
        : await defaultUpdate(cfg, recordId, state, ctx);
      await invalidateCache(cfg, 'update');
      const response: PageRouteSaveResponse = {
        success: true,
        mode: 'update',
        recordId,
        relations: result.relations ?? {},
      };
      return NextResponse.json(response);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Update misslyckades.');
    }
  }

  async function DELETE(req: NextRequest): Promise<NextResponse> {
    if (!cfg.apiKey) return serverError('AIRTABLE_API_KEY ej konfigurerad.');
    const url = new URL(req.url);
    const recordId = url.searchParams.get('id');
    if (!recordId) return badRequest('Saknar ?id=recXXX.');
    try {
      const ctx: RouteContext = { apiKey: cfg.apiKey };
      if (cfg.delete) {
        await cfg.delete(recordId, ctx);
      } else {
        await defaultDelete(cfg, recordId, ctx);
      }
      await invalidateCache(cfg, 'delete');
      return NextResponse.json({ success: true, deleted: true });
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Delete misslyckades.');
    }
  }

  return { GET, POST, PATCH, DELETE };
}

// ─── Adapter: PageTypeServerDef → PageRouteConfig ──────────────────────────

/**
 * Bygger `PageRouteConfig` från en `PageTypeServerDef`. Tillåter sidtyper
 * att deklareras en gång i `lib/page-types/<type>.server.ts` och drivas av
 * factory:n utan att duplicera fält:
 *
 *   const { GET, POST, PATCH, DELETE } = createPageRoute(
 *     pageTypeToRouteConfig(audienceServer, process.env.AIRTABLE_API_KEY, loadAudienceState),
 *   );
 */
export function pageTypeToRouteConfig<TState, TListItem>(
  serverDef: PageTypeServerDef<TState, TListItem>,
  apiKey: string | undefined,
  loadState?: (apiKey: string, recordId: string) => Promise<TState>,
): PageRouteConfig<TState, TListItem> {
  return {
    apiKey,
    tableId: serverDef.tableId,
    baseId: serverDef.baseId,
    cacheEntities: serverDef.cacheEntities,
    cacheContext: serverDef.id,

    loadState,
    stateToFields: serverDef.stateToFields,
    listMapper: serverDef.listItemMapper,
    listFields: serverDef.listFields,
    listSort: serverDef.listSort,

    slugAccessor: serverDef.slug?.accessor,
    slugField: serverDef.slug?.field,
    validateSlugFormat: serverDef.slug?.validateFormat,
    checkReservedSlug: serverDef.slug?.checkReserved,
    checkDuplicateSlug: serverDef.slug?.checkDuplicate,

    validate: serverDef.validate
      ? (s: TState) => {
          const issue = serverDef.validate!(s);
          return issue ? issue.message : null;
        }
      : undefined,

    relations: serverDef.relations,

    create: serverDef.create,
    update: serverDef.update,
    delete: serverDef.delete,
  };
}
