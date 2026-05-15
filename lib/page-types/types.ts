/**
 * Page-type registry — typer.
 *
 * En sidtyp deklareras som *data* (server + UI) snarare än som handskrivna
 * builder/route-klasser. Detta är kärnan i "Bygg ett typed plugin-system
 * för sidtyper" från utvecklingsplanen.
 *
 * ───────────────────────────────────────────────────────────────────────
 *  Server vs UI — varför två filer?
 * ───────────────────────────────────────────────────────────────────────
 *
 * I Next App Router kan client components inte ta emot funktioner som
 * props över server/client-gränsen. Vi splittrar därför definitionen i
 * två icke-överlappande halvor:
 *
 *   - `PageTypeServerDef<TState>` — innehåller server-funktioner
 *     (fromRecord, stateToFields, validate, listItemMapper, relations).
 *     Importeras bara från API-routes och server-komponenter.
 *
 *   - `PageTypeUIDef<TState>`     — innehåller React-komponenter
 *     (sections, previewLayout). Importeras bara i client-komponenter.
 *
 * Server-pages kör `serverDef.fromRecord(record)` och passar resultatet
 * som *plain JSON* (`initialState`) till `<PageTypeBuilder uiDef=… />`.
 *
 * ───────────────────────────────────────────────────────────────────────
 *  Trelagsmodellen för routes
 * ───────────────────────────────────────────────────────────────────────
 *
 *   Lager 1 — Standard CRUD: bara `primary` (tableId + fromRecord + toFields).
 *     Direkt stateToFields-skrivning ska bara användas för interna/systemiska fält. Publika page-save-vägar i den här appen använder Claude-overrides innan Airtable skrivs.
 *
 *   Lager 2 — Declarative relations: `primary` + `relations[]`. Ramverket
 *     hanterar diff (skapa/uppdatera/ta bort eller unlink) per relation.
 *     Stödjer två modeller:
 *       - parentLinkArray: parent har en linked-array av child-IDs.
 *       - childBacklink: child har ett link-fält som pekar till parent.
 *     Används av framtida sidtyper med linked records, t.ex. en case-sida
 *     med egna content-blocks i en separat tabell.
 *
 *   Lager 3 — Full override: skriv egen `create`/`update`/`delete` när
 *     ingen av de andra två räcker. Reserverat för verkligt udda fall
 *     (specifik ordning mellan tre tabeller, villkorlig logik, etc).
 *
 * ───────────────────────────────────────────────────────────────────────
 *  Failure-semantik
 * ───────────────────────────────────────────────────────────────────────
 *
 * Airtable saknar transaktioner. Ramverket lovar därför INTE atomär
 * rollback. Beteendet är:
 *
 *   1. Spara primary record först. Failar det → returnera fel, inga
 *      relationer rörs.
 *   2. För varje relation i ordning: skapa → uppdatera → radera/unlinka.
 *   3. Failar en operation inom en relation: stoppa den relationen,
 *      fortsätt med nästa relation, ackumulera fel i `RelationSyncResult.errors`.
 *   4. Returnera `SaveResult` med full status. Klienten visar fel tydligt
 *      och låter användaren retrya.
 */

import { ReactNode, ComponentType } from 'react';
import { AirtableRecord } from '../airtable';
import { AirtableFields } from '../airtable-helpers';

// ─── Server-side definition ─────────────────────────────────────────────────

export interface PageTypeServerDef<TState, TListItem = unknown> {
  /** Unikt ID för sidtypen, t.ex. 'audience', 'product-area', 'case'. */
  id: string;

  /** Visningsnamn — används i loggning, error-meddelanden. UI-label sätts
   *  separat i `PageTypeUIDef.label`. */
  label: string;

  /** Vilken Airtable-tabell sidtypens records lever i. */
  tableId: string;

  /** Vilken Airtable-bas. Default är SSOT-basen om utelämnad. */
  baseId?: string;

  /** Tom state-skapelse — används vid standard-create-flödet. Layer 3-sidtyper kan utelämna. */
  emptyState?: () => TState;

  /** Airtable record → state. Server-side, körs i route handler eller
   *  server component. Layer 3-sidtyper med egen loader kan utelämna. */
  fromRecord?: (record: AirtableRecord) => TState;

  /** State → Airtable-fält. Mode-aware så create kan utelämna tomma
   *  fält och update kan skriva tomsträng/null för att rensa. Krävs bara
   *  för standard CRUD; Layer 3 med create/update overrides kan utelämna. */
  stateToFields?: (state: TState, mode: 'create' | 'update') => AirtableFields;

  /** Returnerar felmeddelande eller null. Körs på server före skrivning. */
  validate?: (state: TState) => ValidationIssue | null;

  /** Hur en record presenteras i list-svaret (GET ?action=list). */
  listItemMapper: (record: AirtableRecord) => TListItem;
  /** Fält som ska hämtas vid list. Default: alla fält. */
  listFields?: readonly string[];
  /** Sort-instruktion till list. Default: ingen sortering. */
  listSort?: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>;

  /** Lager 2 — deklarativa relationer mot andra tabeller. Tomt array eller
   *  utelämnat = bara primary record. */
  relations?: RelationDef<TState, unknown>[];

  /** Lager 3 — full override av create. När satt struntar factory:n i
   *  `stateToFields`+`relations` och anropar denna istället. Använd när
   *  sidtypen har egna förhandsregler (default-injection, Claude-transform,
   *  multi-tabell-create i specifik ordning) som inte passar i Lager 2.
   *  Slug-validering och cache-invalidering körs fortfarande av factory:n. */
  create?: (
    state: TState,
    ctx: { apiKey: string },
  ) => Promise<{ recordId: string; relations?: Record<string, RelationSyncResult> }>;

  /** Lager 3 — full override av update. Se `create`. */
  update?: (
    recordId: string,
    state: TState,
    ctx: { apiKey: string },
  ) => Promise<{ relations?: Record<string, RelationSyncResult> }>;

  /** Lager 3 — full override av delete. Default = ta bort primary +
   *  cascade owned relations. */
  delete?: (recordId: string, ctx: { apiKey: string }) => Promise<void>;

  /** Vilka core-entiteter som ska cache-invalideras efter mutation. */
  cacheEntities?: readonly string[];

  /** Slug-policy. Om utelämnad körs ingen slug-logik. */
  slug?: SlugPolicy<TState>;
}

export interface SlugPolicy<TState> {
  /** Hur slug:en plockas ur staten. */
  accessor: (state: TState) => string;
  /** Airtable-fältnamn för slug (för duplikat-kollen). Default 'Slug'. */
  field?: string;
  /** Kolla `^[a-z0-9][a-z0-9-]*$`. */
  validateFormat?: boolean;
  /** Kolla reservedSlugs-listan. */
  checkReserved?: boolean;
  /** Kolla att slug:en är unik bland records i tabellen. */
  checkDuplicate?: boolean;
}

export interface ValidationIssue {
  field?: string;
  message: string;
  /** Stable code för programmatisk hantering ("duplicate_slug", "missing_title", ...). */
  code?: string;
}

// ─── Relations (Lager 2) ────────────────────────────────────────────────────

export type RelationDef<TState, TItem> =
  | ParentLinkArrayRelation<TState, TItem>
  | ChildBacklinkRelation<TState, TItem>;

interface RelationDefBase<TState, TItem> {
  /** Stabilt ID för relationen, t.ex. 'products'. Används i loggning och i
   *  save-resultets `relations` map. */
  id: string;

  /** Vilken Airtable-tabell relationens records lever i. */
  tableId: string;
  baseId?: string;

  /** Vilken del av staten är denna relation. Förväntas returnera arrayen
   *  av items i den ordning de visas i UI:t. */
  select: (state: TState) => TItem[];

  /** Befintligt Airtable record-ID för item:et, eller null om det är nyt
   *  och inte sparats än. Klassiskt: `item.recordId ?? null`. */
  identity: (item: TItem) => string | null;

  /** Stabilt klient-side ID per item — används för att returnera mappningen
   *  från klient-temp-ID till Airtable-record-ID efter create. UI:t använder
   *  resultatet för att uppdatera state utan att behöva reload. */
  clientIdentity: (item: TItem) => string;

  /** Airtable record → item. För load-flödet (om relationen laddas via
   *  loadState). Inte alla page types laddar relationer separat (vissa
   *  inkluderar dem i fromRecord); då är denna oanvänd och kan vara en
   *  stub. */
  fromRecord: (record: AirtableRecord) => TItem;

  /** Item → Airtable-fält. `ctx.parentRecordId` är säker att använda —
   *  ramverket säkerställer att parent finns innan relations skrivs.
   *  `ctx.index` är 0-baserad ordning för items i `select(state)`. */
  toFields: (
    item: TItem,
    ctx: { parentRecordId: string; index: number },
  ) => AirtableFields;

  /**
   * Vad händer med items som finns i Airtable men inte i state (= raderade
   * i UI):
   *   - 'delete'   — radera Airtable-record:en
   *   - 'unlink'   — bara avlänka (parent-fältet uppdateras; child består)
   *   - 'ignore'   — gör inget
   * Default väljs av `ownership`: owned → 'delete', shared → 'unlink'.
   */
  onMissing?: 'delete' | 'unlink' | 'ignore';

  /**
   * Vad händer om state refererar ett recordId som inte längre finns i
   * Airtable (t.ex. en annan användare raderade det):
   *   - 'error'  — vägra spara, returnera fel
   *   - 'create' — behandla som nytt item (släpp recordId:et)
   *   - 'skip'   — hoppa över item:et tyst
   * Default: 'error' (vägra korrumpera data).
   */
  onStaleId?: 'error' | 'create' | 'skip';

  /**
   * Semantisk markering: är dessa child-records "ägda" av parent (raderas
   * när parent raderas) eller "delade" (existerar oberoende)?
   * Default: 'owned'.
   */
  ownership?: 'owned' | 'shared';
}

export interface ParentLinkArrayRelation<TState, TItem>
  extends RelationDefBase<TState, TItem> {
  kind: 'parentLinkArray';
  /** Fält på PARENT-recorden som håller arrayen av child-record-IDs.
   *  T.ex. 'Products' på en Product Area-record. */
  parentField: string;
  /** Bevara items-ordningen i parent-arrayen (default true). */
  ordered?: boolean;
}

export interface ChildBacklinkRelation<TState, TItem>
  extends RelationDefBase<TState, TItem> {
  kind: 'childBacklink';
  /** Fält på CHILD-recorden som länkar tillbaka till parent.
   *  T.ex. 'Product Area' på en Product-record. */
  childField: string;
  /**
   * Valfri kolumn på child för explicit ordning. Om utelämnat sparas
   * ingen ordning (children:s ordning vid load är då Airtable-orderad).
   */
  orderField?: string;
}

// ─── Save-resultat ──────────────────────────────────────────────────────────

export interface RelationSyncResult {
  /** Nya items + deras nyligen tilldelade Airtable record-IDs. Klienten
   *  använder detta för att uppdatera state:t utan reload. */
  created: Array<{ clientId: string; recordId: string }>;
  /** Records som uppdaterades. */
  updated: string[];
  /** Records som raderades helt (`onMissing: 'delete'` eller ownership='owned'). */
  deleted: string[];
  /** Records som bara avlänkades (`onMissing: 'unlink'`). */
  unlinked: string[];
  /** Fel per item — tomt om allt gick bra. */
  errors: Array<{ clientId?: string; recordId?: string; message: string }>;
}

export interface SaveResult {
  success: true;
  recordId: string;
  mode: 'create' | 'update';
  /** Resultat per relation, keyed by `RelationDef.id`. */
  relations: Record<string, RelationSyncResult>;
}

// ─── UI-side definition ─────────────────────────────────────────────────────

export interface PageTypeUIDef<TState> {
  /** Måste matcha `PageTypeServerDef.id` så registry kan paras ihop. */
  id: string;

  /** Visningsnamn i navigeringen, t.ex. "Kundtyp", "Produktområde", "Case". */
  label: string;

  /** Ikon (valfritt) — visas i nav-menyn. */
  icon?: ReactNode;

  /** Sektioner i editor-panelen, top-to-bottom. */
  sections: SectionDef<TState>[];

  /** Preview-layout för sidan. Renderas till höger i builder-shellet.
   *  Ansvarar för att rendera `data-section={id}` på rätt ställe för
   *  scroll-sync. */
  previewLayout: ComponentType<PreviewLayoutProps<TState>>;

  /** Slug-input config för toolbarens slug-fält. Om utelämnat visas
   *  ingen slug-input i toolbaren. */
  slugInput?: SlugInputConfig<TState>;

  /** Extra innehåll i toolbarens vänstra del, direkt efter slug-input:en.
   *  Används för t.ex. en prominent "Publicerad"-toggle. */
  toolbarExtras?: ComponentType<{
    state: TState;
    setState: (next: TState) => void;
  }>;
}

export interface PreviewLayoutProps<TState> {
  state: TState;
  activeSection: string | null;
  /** Bumpa för att trigga scroll till activeSection (klick i editor). */
  scrollTrigger: number;
  /** Callback för att flytta active section när användaren klickar i previewen. */
  onSectionClick: (id: string) => void;
}

export interface SlugInputConfig<TState> {
  /** Hur slug:en plockas ur staten. */
  accessor: (state: TState) => string;
  /** Hur slug:en uppdateras i staten. */
  setter: (state: TState, slug: string) => TState;
  /** Placeholder för slug-input:en. */
  placeholder?: string;
  /** Liten gråtext bredvid slug:en, t.ex. "Ny sida"/"Audience-sida". */
  badge?: (state: TState, mode: 'create' | 'edit') => string;
}

export interface SectionDef<TState> {
  /** Stabilt ID — används i quickNav, data-section-ankare i preview, och i
   *  editor-sidans scroll-sync. */
  id: string;

  /** Label i quickNav och som sektionsrubrik i editor-panelen. */
  label: string;

  /** Liten gråtext under sektionsrubriken. */
  description?: string;

  /** Renderar sektionens fält. Tar `state` + `onChange` av hela page-state
   *  så sektionen kan läsa/skriva sin del. Får INTE wrappa sig själv i
   *  `<SectionEditor>` — buildern äger den wrappern. */
  Editor: ComponentType<SectionEditorProps<TState>>;

  /** Om sektionen kan döljas i preview via en "Visa"-toggle i editor-headern.
   *  Returnerar { value, onChange } för toggle:n. */
  visibilityToggle?: (
    state: TState,
    setState: (next: TState) => void,
  ) => { value: boolean; onChange: (next: boolean) => void };

  /** Om sektionen ska börja kollapsad (default false = öppen). */
  defaultCollapsed?: boolean;

  /** Returnerar true om sektionen är "ifylld" — kan användas för en
   *  visuell indikator i quickNav. */
  isFilled?: (state: TState) => boolean;
}

export interface SectionEditorProps<TState> {
  state: TState;
  onChange: (next: TState) => void;
}

// ─── Registry ──────────────────────────────────────────────────────────────

/**
 * Hela sidtyps-definitionen, server + UI hopparade. Används bara på platser
 * som behöver båda halvor (t.ex. development-only auto-nav-byggning). I
 * vanlig kod importeras `serverDef` på servern och `uiDef` på klienten
 * separat — annars drar man in React i server-bundlen.
 */
export interface PageType<TState, TListItem = unknown> {
  server: PageTypeServerDef<TState, TListItem>;
  ui: PageTypeUIDef<TState>;
}
