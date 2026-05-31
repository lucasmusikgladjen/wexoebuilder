# Migreringsplan — Content-as-JSON + schema-i-JSON, plugin för plugin

> **Status:** plan, ej påbörjad. Spegelidentisk i `wexoeplugins/` och `wexoebuilder/`.
> Konkretiserar `ARKITEKTURPLAN.md` FAS 1+2+3+6 som en **repeterbar plugin-loop**
> med inbyggd städning. Bocka av per familj i § 7.

---

## 1. Mål i en mening

Per tabell: behåll en handfull **native kolumner** (det Airtable måste förstå) +
**ett `content_json`-fält** som rymmer allt övrigt innehåll. Fältlistan
definieras **en gång** i `wexoe-core/schema/<entity>.json` och driver PHP-läsning,
builder-state och editor. Spar gör 0 Claude-anrop.

**Alla tabeller behålls** — vi slår inte ihop sidtyper eller barntabeller. Vi
kollapsar bara skalärkolumner till `content_json` *inuti* varje befintlig rad.

## 2. Beslut (låsta)

| Fråga | Beslut |
|---|---|
| Content-fältets namn | **`content_json`** (följer `*_json`-suffix i CLAUDE.md §4) |
| Native vs content | **Implicit regel:** `link` + primärnyckel + allowlist (`is_active`, `order`, `section_type`, `is_published`) = native kolumn; allt annat → `content_json`. Avvikelse markeras explicit i schemat. |
| automation-pillar | **Orörd** i denna omgång (tas separat senare; ev. FAS 5-absorption först). |
| Frontend-puts | **Riktig redesign tillåten** — men ALLTID som separat steg EFTER att migreringen verifierats beteendebevarande (se §5, steg F). |

## 3. De två tekniska greppen (håller blast radius minimal)

- **Hydrate (läs):** `Normalizer.php` (PHP) och builderns läs-boundary avkodar
  `content_json` och lägger nycklarna på toppnivå. → Renderare och
  `lib/schema/to-state.ts` ser samma platta data som idag → **rörs inte av
  själva migreringen.** Tolerant: saknas `content_json`, falla tillbaka på platta
  kolumner.
- **Dehydrate (skriv):** generisk `toFields(state, schema)` buntar content-fält →
  `content_json` med ren kod. Ersätter `transform<Type>` (= FAS 2 på köpet).

---

## 4. DEL 0 — Fundament (EN gång, före plugin-loopen)

Hävstången. När den finns ärver varje familj den.

- [ ] **Schema-lagringsregel** i `lib/schema/entity-schema.ts` + `Schema.php`
      (implicit regel enligt §2; `store: 'column'|'content'` som override).
- [ ] **Hydrate** i `Normalizer.php` + builderns airtable-läs-boundary (tolerant
      mot båda formaten).
- [ ] **Dehydrate** `toFields(state, schema)` i builder-skrivvägen.
- [ ] **Delade block** `contact_form` (15 fält) + `faq` definierade en gång
      (schema + editor-komponent; `ContactForm::render` finns redan). Varje familj
      viker in `contact_form_*` under `content_json.contact_form`.

> Köform: kör Del 0 + familj 1 ihop (shims kan inte testas utan en riktig tabell).

---

## 5. Receptet per plugin (säker ordning)

Additivt → backfill → flippa läs → flippa skriv → **verifiera identiskt** →
redesign → rensa. Dina fem punkter är inmärkta.

| # | Steg | Din punkt |
|---|---|---|
| **A** | Skriv/komplettera `schema/<entity>.json` (single source, native vs content). Auto-synken speglar till buildern. | schema-i-json |
| **B** | Lägg till `content_json`-kolumn i Airtable. Rör INTE gamla kolumner (additivt). | |
| **C** | Koppla på hydrate/dehydrate för entiteten, **tolerant** (content_json *eller* platta kolumner). Beteendebevarande. | |
| **D** | **Backfill-skript:** läs platta kolumner → skriv `content_json`. Idempotent. **Paritetskoll** över ALLA records (state ur gamla kolumner === state ur content_json). | **(3)** |
| **E** | Flippa skrivning till `content_json` (deterministisk `toFields`; Claude ut för familjen). Kör ARKITEKTURPLANs shadow-mode först om önskat. | |
| **F1** | **Migrering klar & verifierad:** paritetsskript grönt + round-trip ett riktigt spar + **HTML-snapshot före/efter IDENTISK**. Detta är beviset att inget gick sönder. | **(3)** |
| **F2** | **Frontend-redesign** i WP-pluginet — som SEPARAT commit ovanpå F1. Snapshoten från F1 är nu "före redesign"-referens, inte regressionsvakt. | **(1)** |
| **G** | **Putsa editor** i buildern (nu schema-driven). Ta bort handskriven mapper + custom state-typ. | **(2)** |
| **H** | Slutsynk: paritet grönt · spar = 0 Claude-anrop · editor↔frontend i synk · inget halvmigrerat. | **(3)** |
| **I** | **Rensa kod:** radera `lib/<type>-mapper.ts`, `lib/airtable-schema-<type>.md`, `transform<Type>` + payload-builder i `claude-transform.ts`, custom state-typ, oanvänd `write-entities/<type>.php`, "håll i synk"-kommentarer. | **(4)** |
| **J** | **Rensa Airtable:** exportera tabell (backup) → ta bort gamla skalärkolumner. ⚠️ MCP saknar `delete_field` → döp om till `__deprecated_*` via MCP, radera manuellt i UI. Rensa stub-/deprecated-artefakter. | **(5)** |
| **K** | Bocka av Definition of Done (§6) + uppdatera ARKITEKTURPLANs progress. | **(3)** |

**Varför F1 före F2:** en redesign förstör snapshot-diffen som regressionsskydd.
Genom att migrera till identisk HTML först, och redesigna som separat diff sen,
kan en migrerings-bugg aldrig förväxlas med en avsedd designändring.

---

## 6. Definition of Done (per familj)

- [ ] Fältlistan på exakt ett ställe (`schema/<entity>.json`).
- [ ] 0 `transform<Type>` + 0 `airtable-schema-<type>.md` kvar för familjen.
- [ ] Spar gör 0 Anthropic-anrop.
- [ ] Paritetsskript grönt på alla records.
- [ ] Gamla skalärkolumner borta i Airtable; bara native + `content_json` kvar.
- [ ] Renderare + editor putsade (redesign valfri, men landad separat).
- [ ] Inga "håll i synk"-kommentarer kvar för familjen.

---

## 7. Ordning & progress (enkelt → svårt)

Single-table först → mönstret sitter innan multi-tabell.

| Tur | Familj | Tabeller | Status | Not |
|---|---|---|---|---|
| 1 | customer-type | 1 | [ ] | Redan schema-driven. **Referensimplementation.** Enda nya = content_json. |
| 2 | cases | 1 | [ ] | Övar pseudo-array → json-array (quick_stat/result/gallery). |
| 3 | partner | 1 | [ ] | `faqs` redan JSON (precedent) + facts-pseudo-array. |
| 4 | landing (LP) | 3 | [ ] | Polymorfa tabs (7 typer) + sidebar-varianter. Första multi-tabell. |
| 5 | product-area (PA) | 4 | [ ] | Sektioner + delade products/solutions (native länkar kvar). |
| 6 | cms-pages | 3 | [ ] | 15 sektionstyper. Mest polymorf. Capstone. |
| — | automation-pillar | — | (skjuts upp) | Orörd; ev. FAS 5-absorption först. |

> `claude-transform.ts` raderas FÖRST när tur 6 är flippad — den krymper en
> familj i taget.

---

## 8. Globala risker & skydd

- **Live Airtable, inga transaktioner:** alltid additivt → backfill → flippa →
  **droppa sist**, med export-backup före drop. En familj helt klar innan nästa.
- **Repona deployar olika** (builder = Vercel auto på `claude/wexoe-page-builder-setup-DmUOd`;
  plugins = manuell zip): läsning måste tåla **båda** dataformaten tills båda
  sidor är ute *och* backfill klar. Tolerant hydrate (steg C) — fallback-koden
  tas bort i en sista städpass när ALLA familjer är migrerade.
- **Ingen CI/tester i plugins:** verifiering = paritetsskript + HTML-snapshot-diff
  + manuell zip-test. Shadow-mode på skriv-sidan (ARKITEKTURPLAN FAS 2).
- **Schema-synken:** redan live (GitHub Actions, wexoeplugins→builder). Ändra
  scheman i `wexoe-core/schema/`, aldrig builder-kopian.

---

## 9. Engångsstädning efter sista familjen

- [ ] Ta bort fallback-på-platta-kolumner i hydrate (alla nu på content_json).
- [ ] Radera `claude-transform.ts` helt + alla 6 `airtable-schema-*.md`.
- [ ] Verifiera 0 oanvända `write-entities/*.php`-sidscheman.
- [ ] ARKITEKTURPLAN: bocka FAS 1/2/3/6 klara.
