# Wexoe: SSOT-system och unika sidor — utvecklingsplan

**Status:** Utkast
**Senast uppdaterad:** 2026-05-13
**Branch:** `claude/plan-unique-pages-swYlT`
**Repos berörda:** `lucasmusikgladjen/wexoebuilder`, `lucasmusikgladjen/wexoeplugins`
**Airtable-bas:** `Wexoe NY` (`appokKSTaBdCa8YiW`)

---

## Innehåll

1. [Sammanfattning](#1-sammanfattning)
2. [Bakgrund](#2-bakgrund)
3. [Syfte och avgränsningar](#3-syfte-och-avgränsningar)
4. [Designprinciper](#4-designprinciper)
5. [Datamodell — SSOT-tabeller](#5-datamodell--ssot-tabeller)
6. [Implementationsplan — faser](#6-implementationsplan--faser)
7. [Risker och mitigations](#7-risker-och-mitigations)
8. [Övervägda alternativ](#8-övervägda-alternativ)
9. [Öppna frågor / framtida beslut](#9-öppna-frågor--framtida-beslut)
10. [Bilagor](#10-bilagor)

---

## 1. Sammanfattning

Wexoe-buildern hanterar idag tre page-typer (Landing Pages, Product Areas, Audience Pages) med var sin hand-rollade editor. Unika sidor (kontakt, om-oss, nedladdningar, start) saknar editor och rendreras som statisk PHP — vilket kräver utvecklare för varje justering, även små copy-byten. Globala värden som logga, telefonnummer och färger är hårdkodade på många ställen.

Denna plan lägger fram en **two-tier-modell**:

- **Tier 1** — statiska sidor med fast layout men där all global data dras från ett **SSOT-system** (Single Source of Truth) i Airtable. Globala värden redigeras centralt i buildern under `/globals/*` och slår igenom på alla sidor som drar SSOT.
- **Tier 2** — en **composition-builder** för unika sidor som inte är statiska. Bygger på samma mönster som dagens LP-builder: en pool av återanvändbara sektioner som redaktören väljer att lägga till. Ingen drag-drop, ingen ny PHP-renderer per sida.

Vissa Tier 2-sektioner är **SSOT-drivna** — de tar bara ett scope-filter (land/division/kundtyp) och rendrerar från SSOT-collections. Detta är där tier 1 och tier 2 förenas: composition-sidor får automatiskt åtkomst till företagets datalager utan dubbel-inmatning.

Genomförandet sker i 7 faser (Fas 0–6). Bedömd total utvecklingsinsats: **3–5 veckor** för en utvecklare, exklusive AI-orkestrerad sid-generering (potentiellt "Fas 7" senare).

---

## 2. Bakgrund

### 2.1 Nuvarande arkitektur

```
[Airtable]  ◄── REST ──  [Builder (Next.js, Vercel)]
    ▲                            │
    │                            │ (Claude API för LP/PA transform)
    │ REST (read)                ▼
    │                    [Anthropic API]
    │
[Wexoe Core (PHP)]
    ▲
    │ use
[wexoe-* feature plugins (PHP)]
    │
    ▼
[WordPress frontend]
```

- **Builder** läser direkt från Airtable via REST och skriver tillbaka via Claude-transform (LP/PA) eller direkt mapper (Audience).
- **Wexoe Core** är en aktiv WordPress-plugin som exponerar `Core::entity('foo')`-API. Schemafiler i `wexoe-core/entities/*.php` deklarerar fält-typer. Cache via WP-transients, 24h default TTL.
- **Feature-plugins** (`wexoe-landing-page`, `wexoe-product-area`, `wexoe-audience-hero`, `wexoe-contact-page` etc.) använder Wexoe Core för datahämtning. Varje plugin äger sin CSS + HTML-rendering.

### 2.2 Tre page-typer idag i buildern

| Typ | State-typ | Builder-skal | Forward-mapping | Editor-URL |
|---|---|---|---|---|
| Landing Page | `PageState` (~90 fält + tabs + downloads) | `PageBuilder.tsx` | Claude via `claude-transform.ts` | `/editor/[recordId]` |
| Product Area | `ProductAreaState` | `ProductAreaBuilder.tsx` | Claude via `claude-transform.ts` | `/editor/product-area/[recordId]` |
| Audience Page | `AudienceState` (platt schema) | `AudienceBuilder.tsx` | Direkt mapper (`audience-mapper.ts`) | `/editor/audience/[recordId]` |

Mellan dessa tre familjer duplikeras toolbar, slug-input, scroll-synk mellan preview och editor, quick-nav-pills, save-status, error/saved-banners — ~200 rader plumbing per page-typ.

### 2.3 SSOT-datalager (efter omstrukturering 2026-05-13)

Under planeringen omstrukturerades 8 `core_*`-tabeller i Airtable från default-mallar till typade SSOT-tabeller med beskrivningar på varje tabell och varje fält. Se [avsnitt 5](#5-datamodell--ssot-tabeller).

### 2.4 Smärtpunkter

1. **Unika sidor saknar editor.** `wexoe-contact-page` är 60 KB hårdkodad PHP. All copy och alla kontaktuppgifter ändras genom utvecklingsarbete.
2. **Globala värden hårdkodade på många ställen.** En logga-bytning kräver att hitta och uppdatera flera plugins. En adressändring detsamma.
3. **Mycket boilerplate per ny page-typ.** Att lägga till en fjärde page-typ idag = ~10 nya filer med 60–80 % copy-paste från LP/PA/Audience.
4. **Ingen "redigera-globalt"-vy.** Redaktör som vill ändra företagets telefon har inget UI — måste antingen öppna Airtable direkt eller be utvecklare.

---

## 3. Syfte och avgränsningar

### 3.1 Mål

1. **Centralisera globala värden** (företagsnamn, kontaktuppgifter, logga, färger, team, partners, testimonials) i SSOT-tabeller med tydlig modell.
2. **Möjliggöra redigering av all SSOT i buildern** under `/globals/*`-routes. Inget av detta ska kräva att redaktörer öppnar Airtable direkt.
3. **Stödja unika sidor via composition-builder** så att nya sidor (om-oss, start, framtida tjänst-sidor) kan byggas utan att skriva en ny editor per sida.
4. **Behålla landing-pages-pluginens prestanda och CSS-kontroll.** Inget i denna plan refaktorerar bort eller skadar nuvarande LP/PA/Audience-renderingar.
5. **Per-land / per-division-scoping** ska finnas på dataplanet från dag 1 så att framtida flerlands-expansion inte kräver schema-migration.

### 3.2 Icke-mål (just nu)

- **Drag-and-drop section reordering.** Pilar upp/ner räcker. Tangentbordstillgänglig drag-drop är veckor extra arbete.
- **i18n / flerspråk** utöver per-country-records i SSOT. Riktig översättning av sid-innehåll går genom WPML / Polylang eller liknande, inte denna plan.
- **Draft/publish-workflow.** Alla ändringar är live. Lägg på senare om problemet uppstår.
- **AI-genererade sidor från svenska prompts.** Spännande men inte i denna plan. Kommer eventuellt som ett "Fas 7" när byggstenarna finns.
- **Migration av LP/PA till composition-modellen.** De stannar som dedikerade builders. Tier 2 är *additivt*, inte ersättande.

### 3.3 Framgångskriterier

- En redaktör kan byta företagets telefonnummer i buildern → alla sidor visar det nya numret efter cache-bust, utan utvecklarinvolvering.
- En ny "om-oss"-sida kan skapas i Tier 2-buildern med 6+ sektion-typer utan att skriva ny React- eller PHP-kod.
- `wexoe-contact-page` migrerad till att dra kontakt + logga från SSOT, men behåller sin CSS-layout.
- Inga regressioner på LP/PA/Audience.

---

## 4. Designprinciper

### 4.1 Two-tier-modellen för sidor

| Tier | Vad det är | Layout-redigering | Datakälla | Exempel |
|---|---|---|---|---|
| **Tier 1** | Statisk PHP-renderad sida | Inte redigerbar i builder | SSOT-pull | kontakt, nedladdningar |
| **Tier 2** | Composition-byggd sida | Redigerbar i builder (sektioner) | Sektion-data + SSOT | start, om-oss, tjänst-sidor |
| **Dedikerade** | Hand-rolled editor | Redigerbar i builder | Sid-specifika tabeller | LP, PA, Audience |

En sida börjar i tier 1 om den är genuint unik och sällan-redigerad. Den migrerar till tier 2 när den växer ur sig själv. Migration är icke-trivial men inte katastrofal — vi accepterar att 1–2 sidor per år kommer migrera.

### 4.2 Tre roller per SSOT-tabell

| Roll | Mönster | Tabeller |
|---|---|---|
| **Singleton** | 1 record per scope, `Is Default`-fallback | `core_company`, `core_graphic_profile` |
| **Collection** | Många records, scope-filter via länkfält | `core_coworkers`, `core_partners`, `core_testimonials` |
| **Taxonomy** | Referensdata som andra tabeller länkar till | `core_countries`, `core_divisions`, `core_customer_types` |

Wexoe Core ska behandla dessa olika: singletons har `Core::company_for_country($code)`-helpers, collections har `Core::coworkers_for_scope($filters)`-helpers, taxonomier har `Core::find_country_by_domain($host)`.

### 4.3 Country/Division-scoping

**WordPress-→ land-kontext:** matcha `home_url()` mot `core_countries.Domain` först, sen mot `URL Prefix` om domänen är delad. Logga fel om ingen match — fall då tillbaka till det land där `Is Default = true` i `core_company`.

**Singleton-uppslag:**
1. Försök matcha mot aktiv country.
2. Vid ingen match: fall tillbaka till `Is Default = true`-recordet.
3. Vid inget default: logga warning, returnera tom array (PHP-plugins ska kunna hantera tomt).

**Collection-uppslag:** scope-filter görs på läsning (`WHERE Country INCLUDES current_country AND Division INCLUDES current_division`). En tom scope-länk i recordet betyder "global" — synligt för alla.

### 4.4 SSOT-driven sections

Vissa Tier 2-sektioner tar inte egen data utan ett scope-filter och rendrerar från SSOT:

- **`team-grid`** scope `{ division: 'industri', country: 'SE' }` → `core_coworkers`-filtrering
- **`partner-marquee`** scope `{ division: 'automation' }` → `core_partners`-filtrering
- **`testimonial-card`** scope `{ customer_type: 'bygg' }` → `core_testimonials`-filtrering

Detta är där tier 1 och tier 2 förenas. Composition-sidor får automatiskt åtkomst till SSOT-collections.

### 4.5 Inga PR per ny sida (där möjligt)

| Vad | Kräver PR? | Var? |
|---|---|---|
| Ny SSOT-rad (coworker, partner, testimonial) | Nej | Builder |
| Ny Tier 2-sida med befintliga sektioner | Nej | Builder |
| Ny Tier 2-sektion-typ | Ja | React + PHP-renderer |
| Ny Tier 1-sida | Ja | Egen PHP-fil |
| Ny page-typ-familj utöver Tier 1/2 | Ja, stor | Båda repos |

Detta är medvetet — biblioteket växer kontrollerat och inget okontrollerat PHP rinner ut på siten.

---

## 5. Datamodell — SSOT-tabeller

Bas: `Wexoe NY` (`appokKSTaBdCa8YiW`). Alla `core_*`-tabeller har Airtable-beskrivningar på tabell- och fält-nivå. Detaljerade fältdefinitioner ligger där och bör inte dupliceras i kod — använd dem som primärkälla.

### 5.1 Översikt

| Tabell | ID | Roll | Primary key | Skala | Scope-länkar |
|---|---|---|---|---|---|
| `core_company` | `tblwq9y74ertsNyYG` | Singleton | `Slug` | 1 record per land + default | Country |
| `core_graphic_profile` | `tbl4c4HjiKVCcJI5v` | Singleton | `Slug` | 1 default + per-division | Division |
| `core_countries` | `tblCZ082jWGUBrUAK` | Taxonomy | `Name` | <10 records | — |
| `core_divisions` | `tblyxs2zsoRBozxQS` | Taxonomy | `Name` | <20 records | Country |
| `core_customer_types` | `tblLsYRMZz6JA6GBK` | Taxonomy | `Name` | <10 records | — |
| `core_coworkers` | `tblYwMQlW9HFd41pg` | Collection | `Full Name` | 10–100 | Division, Country |
| `core_partners` | `tblZ5YIYFelxA0nBm` | Collection | `Name` | 10–100 | Division, Country |
| `core_testimonials` | `tbl1pe0bWz5zdkqJF` | Collection | `Internal Name` | 10–50 | Customer Type, Division, Country |

### 5.2 `core_company` (Singleton, 1 record per land)

Centrala företagsuppgifter — namn, org.nr, kontakt, adress, sociala medier.

**Nyckelfält:** `Slug`, `Is Default`, `Country` (länk), `Company Name`, `Tagline`, `Org Number`, `VAT Number`, `Email`, `Phone`, `Phone Emergency`, `Address Line 1`, `Address Postal Code`, `Address City`, `LinkedIn URL`, `Facebook URL`, `Instagram URL`, `YouTube URL`, `Internal Notes`.

**Uppslags-mönster (PHP):** `Core::company_for_country($code)` → matchar `Country`, fall tillbaka till `Is Default`.

### 5.3 `core_graphic_profile` (Singleton, 1 default + per-division)

Varumärkesvisuell — logotyper, färger, typsnitt, favicon.

**Nyckelfält:** `Slug`, `Is Default`, `Division` (länk), `Logo Primary`, `Logo Dark Background`, `Favicon`, `Color Primary`, `Color Secondary`, `Color Accent`, `Color Background Light`, `Color Background Dark`, `Color Text Primary`, `Color Text Secondary`, `Font Heading`, `Font Body`, `Font CSS URL`.

**Uppslags-mönster (PHP):** `Core::graphic_profile_for_division($slug)` → matchar `Division`, fall tillbaka till `Is Default`.

### 5.4 `core_countries` (Taxonomy)

ISO-data + WP-mapping för land-kontext-detektering.

**Nyckelfält:** `Name`, `Code` (ISO 3166-1 alpha-2), `Domain` (för `home_url()`-match), `URL Prefix` (alt. scope), `Currency`, `Locale`, `Default Language`, `Order`, `Active`.

**Uppslags-mönster (PHP):** `Core::find_country_by_domain($host)` → matchar `Domain`, sen `URL Prefix`. Cache:as separat.

### 5.5 `core_divisions` (Taxonomy)

Wexoes affärsindelningar (Industri, Automation, Kassasystem etc.).

**Nyckelfält:** `Name`, `Slug`, `Description`, `Order`, `Active`, `Country` (länk, valfri).

### 5.6 `core_customer_types` (Taxonomy)

Kundsegment (Industri-kund, Bygg, Offentlig sektor etc.). Pekas på av `core_testimonials` och audience-sidor.

**Nyckelfält:** `Name`, `Slug`, `Description`, `Icon` (attachment), `Order`, `Active`.

### 5.7 `core_coworkers` (Collection)

Medarbetare som visas publikt (team-grid, kontakt-CTA).

**Nyckelfält:** `Full Name`, `Title`, `Email`, `Phone`, `Image`, `LinkedIn URL`, `Bio`, `Order`, `Active`, `Division` (länk), `Country` (länk).

### 5.8 `core_partners` (Collection)

Samarbetspartners (logo-rader, partner-sidor).

**Nyckelfält:** `Name`, `Logo`, `Logo Transparent`, `URL`, `Description`, `Order`, `Active`, `Division` (länk), `Country` (länk).

### 5.9 `core_testimonials` (Collection)

Kundcitat med författar-info och bild.

**Nyckelfält:** `Internal Name`, `Quote`, `Author Name`, `Author Title`, `Author Image`, `Order`, `Active`, `Featured`, `Customer Type` (länk), `Division` (länk), `Country` (länk).

### 5.10 Auto-genererade reverse-länkar

När länkfält skapas på ena sidan av en relation skapar Airtable automatiskt motsvarande reverse-link-fält på målbordet. Dessa är harmless men kan döpas om i Airtable UI för läsbarhet (t.ex. `core_company` → `Companies` på `core_countries`). De ignoreras av builderns mapper när inget Wexoe Core-schema refererar dem.

### 5.11 Legacy default-fält

De fem default-fälten Airtable skapar för nya tabeller (`Notes`, `Assignee`, `Status` singleSelect, `Attachments`, `Attachment Summary`) finns kvar på vissa tabeller efter strukturering. De är harmless — builderns mapper läser dem inte. Kan rensas manuellt i Airtable UI om det irriterar.

---

## 6. Implementationsplan — faser

### Fas 0 — Grund (1–2 dagar)

**Mål:** lägg grunden för delade sektion-typer och refaktorera ut den duplikerade builder-plumbingen.

**Konkreta steg:**
1. Extrahera `BuilderShell` från LP/PA/Audience till `components/BuilderShell.tsx`. Innehåller toolbar, scroll-synk, quick-nav, save-status, error/saved-banners.
2. Migrera `AudienceBuilder.tsx` till att använda `BuilderShell` (proof of concept; minsta page-typen).
3. Definiera delade typer i `lib/sections/types.ts`:
   ```ts
   interface SectionInstance<TData = unknown> {
     id: string;
     recordId?: string;
     type: SectionTypeId;
     order: number;
     data: TData;
   }

   interface SectionTypeDescriptor<TData> {
     id: SectionTypeId;
     label: string;
     defaultData: TData;
     EditorComponent: React.FC<{ data: TData; onChange: (d: TData) => void }>;
     PreviewComponent: React.FC<{ data: TData }>;
     phpRendererSlug: string;
   }
   ```
4. Skapa tomt section-register i `lib/sections/registry.ts` för senare bruk i Fas 5.

**Validering:** LP/PA fungerar oförändrat. Audience fortsätter spara mot Airtable utan regressioner.

---

### Fas 1 — Wexoe Core-scheman + REST (3–4 dagar)

**Mål:** Wexoe Core kan läsa alla `core_*`-tabeller; builder har REST-endpoints för CRUD.

**Konkreta steg:**

**Wexoe Core (PHP, repo `wexoeplugins/wexoe-core`):**
1. 8 nya entity-schemafiler i `wexoe-core/entities/`:
   - `core_company.php` (primary `slug`, `country`-länk, alla fält)
   - `core_graphic_profile.php` (primary `slug`, `division`-länk)
   - `core_countries.php`, `core_divisions.php`, `core_customer_types.php`
   - `core_coworkers.php`, `core_partners.php`, `core_testimonials.php`
2. Hjälpklasser i `wexoe-core/src/`:
   - `Wexoe\Core\Helpers\Context` — `Context::current_country()`, `Context::current_division()` (cacheas per request)
   - `Wexoe\Core\Helpers\Singletons` — `Singletons::company_for_country($code)`, `Singletons::graphic_profile_for_division($slug)`
   - `Wexoe\Core\Helpers\Collections` — `Collections::coworkers_for_scope([...])`, etc.

**Builder (Next.js, repo `wexoebuilder`):**
1. `lib/core/types.ts` — TypeScript-typer för varje SSOT-tabell.
2. `lib/core/mapper.ts` — bi-directional Airtable record ↔ TS-objekt.
3. `lib/core/loader.ts` — server-side fetch-funktioner per tabell.
4. `app/api/core/[entity]/route.ts` — generisk route som tar entity-namn som param, validerar mot whitelist, proxar till Airtable. GET (list/single), POST (create), PATCH (update), DELETE.
5. Whitelist i `lib/core/registry.ts`:
   ```ts
   export const CORE_ENTITIES = {
     'core_company': { tableId: 'tblwq9y74ertsNyYG', mapper: companyMapper, role: 'singleton' },
     // ...
   } as const;
   ```

**Validering:** `curl localhost:3000/api/core/core_company` returnerar alla company-records. PATCH uppdaterar. Wexoe Core PHP läser samma data via `Core::entity('core_company')->all()`.

---

### Fas 2 — `/globals` i builder (3–5 dagar)

**Mål:** redaktörer kan redigera alla 8 SSOT-tabellerna i buildern utan att öppna Airtable.

**Routes och UI-mönster:**

| Route | Tabell | UI |
|---|---|---|
| `/globals` | — | Landningssida: 8 entitets-kort med kort beskrivning + "Redigera"-knapp |
| `/globals/company` | `core_company` | Lista (1 record per land) + form per record. Tabb-bar per Country |
| `/globals/graphic-profile` | `core_graphic_profile` | Lista (1 record per division) + form. Tabb-bar per Division |
| `/globals/countries` | `core_countries` | Inline-redigerbar tabell |
| `/globals/divisions` | `core_divisions` | Inline-redigerbar tabell |
| `/globals/customer-types` | `core_customer_types` | Lista + form |
| `/globals/coworkers` | `core_coworkers` | Sökbar lista + form. Bulk active/inactive |
| `/globals/partners` | `core_partners` | Sökbar lista + form |
| `/globals/testimonials` | `core_testimonials` | Lista + form. `Featured`-toggle prominent |

**Komponenter:**
- `<CoreEntityShell entity="core_company" />` — gemensamt skal med save-banner, list-vy, form-vy.
- `<CoreEntityForm fields={...} value={...} onChange={...} />` — generisk form som tar field-config.
- Field-config per tabell i `lib/core/forms.ts` (vilka fält visas i form, vilka är text/textarea/url/email/phone/image/select/multilink).

**Auth:** återanvänd `lib/auth.ts`-mönstret. `/globals/*` kräver inloggad användare.

**Cache-bust:** vid varje POST/PATCH/DELETE kör `invalidateWexoeCoreCache(['core_company', 'core_graphic_profile', ...])` mot Wexoe Core REST.

**Sidlistan i `/`:** lägg "Globaler"-länk i toppen vid "Ny sida". Listar dessutom statiska Tier 1-sidor med särskild "Statisk"-tag + länk till `/globals/company`.

**Validering:** redaktör kan byta `Phone` i `/globals/company` → ändringen reflekteras i WP efter cache-bust.

---

### Fas 3 — Migrera `wexoe-contact-page` till SSOT (1–2 dagar)

**Mål:** kontaktsidan slutar vara hårdkodad, drar data från SSOT, men behåller sin CSS-layout.

**Konkreta steg:**
1. Identifiera hårdkodade strängar i `wexoe-contact-page.php` och mappa dem till SSOT-fält:
   - Hero-rubrik / underrubrik: stannar hårdkodade (sid-specifika) eller flyttas till `core_company.Tagline` om de råkar vara generiska.
   - Telefon, e-post, adress: `Core::company_for_country()->Phone / Email / Address Line 1 / Address Postal Code / Address City`.
   - Sociala ikoner: `Core::company_for_country()->LinkedIn URL / Facebook URL / Instagram URL / YouTube URL`.
   - Logga: `Core::graphic_profile_for_division()->Logo Primary`.
   - Öppettider och status-indikator: stannar hårdkodade tills vi väljer att lägga `Hours Mon-Fri`-fält i SSOT (öppen fråga, se avsnitt 9).
2. Inför `wexoe_cp_globals()`-helper i pluginen som encapslerar Core-uppslagen.
3. I `/`-sidlistan i buildern: lägg in kontakt-sidan med typ `static` och länken pekar mot `/globals/company` istället för en editor.
4. Test: byt SSOT-rad → kontakt-sidan uppdateras efter cache-bust.

---

### Fas 4 — Globals-driven defaults i LP/PA (1 dag)

**Mål:** liten men hög-värde feature — nya LP/PA-sidor får automatiskt en kontaktperson från `core_coworkers`.

**Konkreta steg:**
1. När redaktören skapar en ny LP/PA: hämta `core_coworkers` filtrerat på sidans `Country` + (om PA) `Division`. Välj den med lägst `Order`. Förfyll Contact-fälten.
2. Om redaktören manuellt ändrar — respektera valet. Default sätts bara om fältet är tomt vid create-tid.

**Validering:** ny LP utan manuell Contact-input visar default-coworker. Existerande LPs påverkas inte.

---

### Fas 5 — Tier 2: Composition-builder (1–1,5 vecka)

**Mål:** unika sidor (start, om-oss, framtida tjänst-sidor) byggs av återanvändbara sektioner.

**Airtable:**
1. Ny tabell `cms_unique_pages`: `Slug` (primary), `H1`, `SEO Title`, `SEO Description`, `OG Image URL`, `Published` (checkbox), `Country` (länk → `core_countries`).
2. Ny tabell `cms_page_sections`: `Name` (formula från type+order), `Unique Page` (länk), `Order` (number), `Type` (singleSelect: hero, text-image, cta-banner, team-grid, partner-marquee, testimonial-card, faq, …), `Data JSON` (long-text — sektion-specifik data i JSON-format).
3. Beskrivningar på båda tabeller + fält.

**Wexoe Core:**
1. `cms_unique_pages.php` + `cms_page_sections.php` schemafiler.
2. `cms_page_sections`-schemat parsar `Data JSON` till en `data`-key vid läsning så plugins får `$section['data']['h1']` direkt.

**Ny plugin `wexoe-page` (repo `wexoeplugins/New plugins/wexoe-page`):**
1. Registrerar shortcode `[wexoe_page slug="…"]`.
2. Hämtar `cms_unique_pages` via Core, loopar sektioner, anropar `apply_filters('wexoe_section_render', $section)` per sektion.
3. Sektion-typ-registrering via `wexoe_section_register($type, $callable)`.

**Ny plugin `wexoe-sections` (repo `wexoeplugins/New plugins/wexoe-sections`):**
1. En PHP-fil per sektion-typ med `wexoe_section_register('hero', 'wexoe_section_render_hero')`.
2. Initiala renderers: `hero`, `text-image`, `text-only`, `cta-banner`, `faq`, `team-grid` (drar `core_coworkers`), `partner-marquee` (drar `core_partners`), `testimonial-card` (drar `core_testimonials`).

**Builder:**
1. `components/UniquePageBuilder.tsx` — använder `BuilderShell` från Fas 0. Vertikal stack med sektioner, pilar upp/ner, "Lägg till sektion"-knapp.
2. `components/sections/` — en mapp per sektion-typ:
   ```
   components/sections/
     hero/
       editor.tsx
       preview.tsx
       descriptor.ts
     text-image/
       ...
   ```
3. Registrera alla sektion-descriptors i `lib/sections/registry.ts`.
4. Sektion-katalog dialog: rutnät av thumbnails när "Lägg till sektion" klickas.
5. `app/api/unique-page/route.ts` — POST/GET/PATCH/DELETE.
6. `app/editor/unique/[recordId]/page.tsx` + `app/editor/unique/page.tsx` (create-mode).
7. "Unik sida" som ny typ i `Ny sida`-dialogen i `app/page.tsx`.

**Reserved slugs:** validering i Tier 2-create — vissa slugs (`kontakt`, `nedladdningar`, …) reserveras för Tier 1-sidor och får inte användas. Lista i `lib/core/reserved-slugs.ts`.

**Validering:** ny "om-oss"-sida med 5 sektioner skapas helt i builder, ingen kod-PR. WP visar sidan korrekt.

---

### Fas 6 — Polish (löpande)

Inte ett block utan en uppsättning kvalitetshöjningar att lägga på efter Fas 5:

- **SEO-meta** på alla page-typer (title/description/og-image) retrofittade på LP/PA/Audience.
- **Saved sections / page-templates**: spara en sektion-instans, klona till annan sida. "Skapa från om-oss-mall".
- **Audit-länkar** i `/globals/*`-vyer → "Visa historik i Airtable" (utnyttja Airtable's revision history).
- **"Vad använder det här SSOT-recordet?"-vy**: t.ex. visa "Denna coworker visas på 3 sidor".
- **Bulk-operationer i collections**: "aktivera alla coworkers i division X".
- **Cache-bust-status**: efter save, visa "Cache rensad i Wexoe Core ✓" som bekräftelse.
- **AI copy-assist** per sektion (knapp som anropar Claude för rubrik-förslag).

---

## 7. Risker och mitigations

| Risk | Sannolikhet | Påverkan | Mitigation |
|---|---|---|---|
| **`/globals`-redigering bryter publicerade sidor** (typo i Phone, raderad coworker som var hård-länkad någonstans) | Medel | Hög | Soft-delete via `Active`-checkbox istället för hård-delete. Audit-vy som visar referenser innan deletion. Initial-validering på fält (telefonformat, email-format). |
| **Cache-stale efter SSOT-ändring** | Hög | Medel | Automatisk `invalidateWexoeCoreCache` vid varje POST/PATCH. "Tvinga cache-rensning"-knapp i `/globals`. Kortare TTL (1h) för SSOT vs 24h för sid-data. |
| **Land-kontext-detektering fungerar inte i alla WP-konfigurationer** | Medel | Hög | Robust fallback-kedja: Domain → URL Prefix → `Is Default = true`-record → hårdkodad SE-default i Wexoe Core. Logga vilken fallback som triggade vid varje request (debug-läge). |
| **Tier 2 section-bibliotek växer okontrollerat** | Hög | Medel | Initial-lista av 8 sektion-typer är hård gräns för MVP. Ny typ kräver explicit motivering + PR. Mätning av användning per typ — sektioner som inte används på 6 mån avvecklas. |
| **`Data JSON`-fält blir orättningsbart över tid** (oklart schema, evolution-svårigheter) | Medel | Hög | Strikt zod-validering per sektion-typ på write. Migration-strategi: när sektion-typens schema ändras, kör en bakgrundsmigration som parsar gamla JSON och skriver nya. Versionera section-data: `{ _schema: 1, ...data }`. |
| **Singleton-fallback-logik produserar fel record** | Låg | Hög | Hård invariant: max ett record per tabell får ha `Is Default = true`. Validering i builder vid save. Log warning i PHP om fler hittas. |
| **Reverse-länkar mellan `core_*`-tabeller skapar dependency loops i mapper** | Låg | Medel | Builder-mapper läser bara fält som finns i `core/registry.ts`. Auto-genererade reverse-länkar listas inte där. |
| **Migration av `core_company` från Item/Value bryter pluginer som läser gamla fält** | Hög | Medel | Inga pluginer läser `core_company` än (Item/Value-strukturen var aldrig kopplad till Wexoe Core). Greenfield-migration. |
| **WordPress-sajten skickar mer data till Airtable än Airtable's free-tier kan handla** | Låg | Låg | Wexoe Core cache:ar reads — Airtable hits bara vid cache-miss. Skriv-vägen (builder → Airtable) är icke-frekvent. |

---

## 8. Övervägda alternativ

### 8.1 Alternativ A — Per-sida hand-rolld editor (status quo)

Skriv en ny `FooBuilder.tsx` + ny `/api/foo`-route + ny mapper + ny PHP-renderer för varje ny page-typ.

**Avfärdat:** ~10 nya filer per sida, 60–80 % copy-paste. Skalar inte.

### 8.2 Alternativ B — Schema-i-Airtable (full deklarativitet)

En `Page Schemas`-tabell i Airtable där varje rad är en page-typ. Builderns startsida läser tabellen och konstruerar editor + form dynamiskt vid runtime. Ingen kod per ny page-typ.

**Avfärdat (för nu):** PHP-sidan kan ändå inte rendera utan kod. För maximal nytta behöver vi också ett block-bibliotek. Och då är det enklare att börja med block-biblioteket (vår Tier 2) och lägga schema-i-Airtable ovanpå senare om det visar sig vara värt det. Inte uteslutet — kan bli en framtida iteration.

### 8.3 Alternativ C — Block-bibliotek (Webflow-stil) som ENDA modell

Skippa Tier 1 helt och migrera alla unika sidor till composition-bygge med drag-drop.

**Avfärdat:** för stort kliv. Drag-drop tillagts mycket komplexitet. Tier 1 finns för att kontakt-sidor och liknande SÄLLAN ska redigeras — de ska bara dra in globala värden från SSOT. Att tvinga alla sidor genom composition-modellen ger för låg signal-to-noise.

### 8.4 Alternativ D — AI-orkestrerad sid-generering från prompt

I "Ny sida"-flödet: redaktör skriver svensk prompt → Claude med Airtable MCP genererar en page-record + sektioner.

**Inte avfärdat — uppskjutet till "Fas 7".** Kräver att Tier 2 (block-bibliotek) finns på plats först som byggsten. Mycket attraktivt som senare lager när grunden är mogen.

### 8.5 Alternativ E — Markdown/MDX med named slots

Unika sidor = en .md-fil med YAML-frontmatter och `{{slots}}`. Builder-form genereras från slots.

**Avfärdat:** dålig WYSIWYG-upplevelse. Svårt för icke-tekniska redaktörer. Sämre än Tier 2-composition i nästan alla dimensioner.

### 8.6 Alternativ F — Statisk export

"Publicera"-knappen genererar färdig HTML och PHP-fil → commit via Github MCP.

**Avfärdat:** maximal TTFB men maximalt jobb för utvecklare att underhålla. Vi förlorar Wexoe Core-cachens redan-fungerande modell.

---

## 9. Öppna frågor / framtida beslut

### 9.1 Öppettider — SSOT eller hårdkod?

`wexoe-contact-page` visar öppettider och en dynamisk "öppet/stängt"-status. Två alternativ:

- **A.** Lägg `Hours Mon-Fri`, `Hours Saturday`, `Hours Sunday`, `Hours Lunch`, `Hours Override` fält i `core_company`. Builder-redigering möjlig. Status-logiken stannar i PHP.
- **B.** Stanna hårdkodat. Öppettider ändras sällan, så hårdkod är acceptabelt.

**Rekommendation:** A. Liten lift, hög flexibilitet. Bestäms i Fas 3.

### 9.2 Address Line 2

`core_company` har bara `Address Line 1`. Behövs separat fält för våning/c/o?

**Föreslås:** vänta tills första riktiga adressen kräver det.

### 9.3 Reverse-länkar — döpa om eller lämna?

Airtable skapade auto-namngivna reverse-länkar (`core_company` på `core_countries`, etc.). Estetiskt kan döpas om i Airtable UI till `Companies`, `Coworkers`, etc.

**Rekommendation:** lågt prio, gör vid behov.

### 9.4 LP/PA Contact Fields — fortsätta hårdkoda eller koppla till `core_coworkers`?

Idag har LP/PA egna Contact-fält (`contactName`, `contactEmail`, etc.). Borde de istället peka på en `core_coworkers`-record?

**Rekommendation:** addera en `Coworker (linked)` valfri länk till LP/PA i en framtida iteration. Behåll fri-text-fälten som fallback. Inte i scope nu.

### 9.5 Multi-language

Vad händer när Wexoe behöver svenska + norska + danska text på samma sida?

**Beslut:** utanför denna plans scope. Lös via WPML/Polylang. Per-country-records i SSOT räcker som plattformsfundament för översättning på data-nivå.

### 9.6 Versioning / draft-state

Behövs ett "draft" / "review"-stadium för Tier 2-sidor?

**Beslut:** inte i MVP. Allt går live direkt. Lägg på om problemet uppstår.

### 9.7 Approval status på testimonials

`core_testimonials` har `Active` + `Featured` men inget formellt "godkänt av kunden för publicering". Lägg till `Approval Status` (Pending/Approved/Withdrawn)?

**Föreslås:** lägg till om Wexoes legal-team kräver det. Annars räcker `Active`.

---

## 10. Bilagor

### A. Terminologi

| Term | Definition |
|---|---|
| **SSOT** | Single Source of Truth. I detta projekt: `core_*`-tabeller i Airtable som plattformsdata-lager. |
| **Tier 1** | Statisk PHP-renderad sida som drar SSOT men inte är layout-redigerbar i builder. |
| **Tier 2** | Composition-byggd sida med sektioner valda i builder. |
| **Section** | Återanvändbar UI-byggsten (hero, text-image, faq, …) med React preview + PHP renderer. |
| **Scope** | Filter-uppsättning `{ country?, division?, customer_type? }` som styr vilka SSOT-records som visas. |
| **Singleton (i SSOT-kontext)** | En tabell med 1 record per scope, fallback till `Is Default = true`. |
| **Collection (i SSOT-kontext)** | En tabell med många records, filtrerade via scope-länkar. |
| **Taxonomy (i SSOT-kontext)** | Referensdata-tabell som andra tabeller länkar till. |
| **Wexoe Core** | WordPress-plugin som exponerar `Core::entity('foo')`-API mot Airtable med cache. |

### B. Filstruktur efter implementering

**`wexoebuilder/`:**
```
app/
  globals/
    page.tsx                            -- entitets-grid
    company/page.tsx
    graphic-profile/page.tsx
    countries/page.tsx
    divisions/page.tsx
    customer-types/page.tsx
    coworkers/page.tsx
    partners/page.tsx
    testimonials/page.tsx
  editor/
    unique/
      page.tsx                          -- create
      [recordId]/page.tsx               -- edit
  api/
    core/[entity]/route.ts              -- SSOT CRUD
    unique-page/route.ts                -- Tier 2 CRUD
components/
  BuilderShell.tsx                      -- delad plumbing (Fas 0)
  UniquePageBuilder.tsx                 -- Tier 2 builder
  sections/
    hero/{editor.tsx, preview.tsx, descriptor.ts}
    text-image/...
    cta-banner/...
    team-grid/...                       -- SSOT-driven
    partner-marquee/...                 -- SSOT-driven
    testimonial-card/...                -- SSOT-driven
    faq/...
  core/
    CoreEntityShell.tsx
    CoreEntityForm.tsx
lib/
  core/
    types.ts
    mapper.ts
    loader.ts
    registry.ts
    forms.ts
    reserved-slugs.ts
  sections/
    types.ts
    registry.ts
```

**`wexoeplugins/wexoe-core/entities/`:**
```
core_company.php
core_graphic_profile.php
core_countries.php
core_divisions.php
core_customer_types.php
core_coworkers.php
core_partners.php
core_testimonials.php
cms_unique_pages.php
cms_page_sections.php
```

**`wexoeplugins/New plugins/`:**
```
wexoe-page/                             -- [wexoe_page slug="..."] shortcode
wexoe-sections/                         -- PHP-renderer per sektion-typ
wexoe-contact-page/                     -- migrerad till SSOT
```

### C. Wexoe Core entity-schema-exempel

```php
// wexoe-core/entities/core_company.php
<?php
if (!defined('ABSPATH')) exit;

return [
    'table_id' => 'tblwq9y74ertsNyYG',
    'primary_key' => 'slug',
    'cache_ttl' => 3600,                    // 1h, kortare än sid-data
    'required' => ['slug'],
    'fields' => [
        'slug' => 'Slug',
        'is_default' => ['source' => 'Is Default', 'type' => 'bool'],
        'country_ids' => ['source' => 'Country', 'type' => 'link', 'entity' => 'core_countries'],
        'company_name' => 'Company Name',
        'tagline' => 'Tagline',
        'org_number' => 'Org Number',
        'vat_number' => 'VAT Number',
        'email' => 'Email',
        'phone' => 'Phone',
        'phone_emergency' => 'Phone Emergency',
        'address_line_1' => 'Address Line 1',
        'address_postal_code' => 'Address Postal Code',
        'address_city' => 'Address City',
        'linkedin_url' => 'LinkedIn URL',
        'facebook_url' => 'Facebook URL',
        'instagram_url' => 'Instagram URL',
        'youtube_url' => 'YouTube URL',
        'internal_notes' => 'Internal Notes',
    ],
];
```

### D. Cache-strategi

| Lager | Cache | TTL | Invalidering |
|---|---|---|---|
| Builder → Airtable read | SWR-style i React | 5 min | Manual revalidate efter mutation |
| Wexoe Core → Airtable read | WP transient | 1h (SSOT), 24h (sid-data) | `Core::entity('foo')->clear_cache()` via REST från builder |
| WordPress fragment cache (om aktiverat) | Object cache | Per renderer | Hård clearance vid plugin-uppdatering |

Vid `/globals`-save i builder:
1. PATCH Airtable.
2. Anropa Wexoe Core's `/wp-json/wexoe-core/v1/invalidate` med entity-namn(en).
3. Wexoe Core rensar transient för den entiteten.
4. Nästa WP-request mot sidan triggar cache-miss → läser fräsch data från Airtable.

---

**Slut på dokument. Ändringar i denna plan ska commit:as som separata commits så historik bevaras.**
