# Polish- & JSON-migrationsplan — plugin för plugin

> **Status:** plan, påbörjad i delar (se § 0). Spegelidentisk i `wexoeplugins/`
> och `wexoebuilder/`. Konkretiserar `ARKITEKTURPLAN.md` FAS 1+2+3+6 som en
> **repeterbar plugin-loop** med inbyggd städning + frontend-polish. Bocka av
> per familj i § 7.

---

## 0. Utgångsläge — vad som REDAN är gjort (per 2026-05-31)

Denna plan skrevs efter att FAS 2 och delar av FAS 3 redan landat i parallella
sessioner. Läs detta FÖRST så du inte bygger om gjort arbete. Källa:
`ARKITEKTURPLAN.md` § 6 + faktisk disk.

| Förmåga | Status | Konsekvens för denna plan |
|---|---|---|
| **Deterministisk skrivväg** (`deterministic-transform.ts` + `schema/to-fields.ts`) | ✅ **Klart.** `claude-transform.ts` + 6 schema-MD raderade. Spar = 0 Claude-anrop. | Del 0:s dehydrate-motor finns. Bygg INTE om. **Men:** FAS 2 flippades utan shadow-/difftest → verifiera retroaktivt. |
| **`content_json` per-tabell-lagring** | ❌ **Ogjort.** `grep content_json` = 0 träffar. | **Planens kärna. Helt kvar.** Detta är vad loopen faktiskt levererar. |
| **Delade block additivt** (`faq` + `contact_form_json`) | 🟡 **Delvis.** Block finns; 14 `contact_form_*`-kolumner kvar i ≥4 tabeller, data **ej migrerad**. | Halvmigrerat tillstånd. Planen ska **slutföra** (backfill + droppa kolumner), inte börja om. Bra första migrerings-case. |
| **Schema-driven läsning** (FAS 1) | 🟡 **1/6.** customer-type schema-drivet; gammal mapper + state-typ kvar. | Replikera till 5 familjer (= steg G i loopen). |
| **Design-tokens** (`DesignTokens.php`) | 🟡 Byggt, konsumeras av **0** plugins. | Relevant för frontend-polish (steg F2), inte för JSON-migreringen. |
| **automation-pillar** | — | **Orörd** denna omgång (beslut §2). |

**Sammanfattning:** skrivvägen och Claude-borttagningen är gjorda. Det som
återstår — och som hela denna plan handlar om — är **`content_json`-kollapsen,
backfill, upprensning av halvmigrerade kolumner, och frontend/editor-polish**,
en familj i taget.

---

## 1. Mål i en mening

Per tabell: behåll en handfull **native kolumner** (det Airtable måste förstå) +
**ett `content_json`-fält** som rymmer allt övrigt innehåll. Fältlistan
definieras **en gång** i `wexoe-core/schema/<entity>.json` och driver PHP-läsning,
builder-state och editor.

**Alla tabeller behålls** — vi slår inte ihop sidtyper eller barntabeller. Vi
kollapsar bara skalärkolumner till `content_json` *inuti* varje befintlig rad.

## 2. Beslut (låsta)

| Fråga | Beslut |
|---|---|
| Content-fältets namn | **`content_json`** (följer `*_json`-suffix i CLAUDE.md §4) |
| Native vs content | **Implicit regel:** `link` + primärnyckel + allowlist (`is_active`, `order`, `section_type`, `is_published`) = native kolumn; allt annat → `content_json`. Avvikelse markeras explicit i schemat. |
| automation-pillar | **Orörd** i denna omgång. |
| Frontend-polish | **Riktig redesign tillåten** — men ALLTID som separat steg EFTER att migreringen verifierats beteendebevarande (§ 5, steg F1→F2). |

## 3. De två tekniska greppen (håller blast radius minimal)

- **Hydrate (läs):** `Normalizer.php` (PHP) och builderns läs-boundary avkodar
  `content_json` och lägger nycklarna på toppnivå. → Renderare och
  `lib/schema/to-state.ts` ser samma platta data som idag → **rörs inte av själva
  migreringen.** Tolerant: saknas `content_json`, falla tillbaka på platta
  kolumner.
- **Dehydrate (skriv):** `schema/to-fields.ts` buntar content-fält →
  `content_json`. Skrivvägen är redan deterministisk (FAS 2) — detta utökar den.

---

## 4. DEL 0 — Fundament (EN gång, före plugin-loopen)

Mestadels redan på plats (§ 0). Kvar att bygga:

- [ ] **Schema-lagringsregel** i `lib/schema/entity-schema.ts` + `Schema.php`
      (implicit regel enligt §2; `store: 'column'|'content'` som override).
- [ ] **Hydrate av `content_json`** i `Normalizer.php` + builderns läs-boundary
      (tolerant mot båda formaten).
- [ ] **Dehydrate till `content_json`** i `schema/to-fields.ts` (bygg på FAS 2).
- [x] ~~Deterministisk skrivväg + Claude bort~~ — klart (FAS 2).
- [x] ~~`contact_form`/`faq` som delade block~~ — additivt klart; **datamigrering +
      kolumndropp kvar** (görs i loopen, se §7 tur 0).

---

## 5. Receptet per plugin (säker ordning)

Additivt → backfill → flippa läs → **verifiera identiskt** → polish → rensa.
Dina fem punkter är inmärkta.

| # | Steg | Din punkt |
|---|---|---|
| **A** | Skriv/komplettera `schema/<entity>.json` (single source, native vs content). Auto-synken speglar till buildern. | schema-i-json |
| **B** | Lägg till `content_json`-kolumn i Airtable. Rör INTE gamla kolumner (additivt). | |
| **C** | Koppla på hydrate/dehydrate för entiteten, **tolerant** (content_json *eller* platta kolumner). Beteendebevarande. | |
| **D** | **Backfill-skript:** läs platta kolumner → skriv `content_json`. Idempotent. **Paritetskoll** över ALLA records (state ur gamla kolumner === state ur content_json). | **(3)** |
| **E** | Flippa skrivning till `content_json` (via `to-fields.ts`). | |
| **F1** | **Migrering klar & verifierad:** paritetsskript grönt + round-trip ett riktigt spar + **HTML-snapshot före/efter IDENTISK**. Beviset att inget gick sönder. | **(3)** |
| **F2** | **Frontend-polish/redesign** i WP-pluginet — som SEPARAT commit ovanpå F1. Snapshoten från F1 är nu "före redesign"-referens, inte regressionsvakt. Konsumera ev. `DesignTokens.php` här. | **(1)** |
| **G** | **Putsa editor** i buildern (nu schema-driven läsning). Ta bort handskriven `<type>-mapper.ts` + custom state-typ. | **(2)** |
| **H** | Slutsynk: paritet grönt · spar = 0 Claude-anrop · editor↔frontend i synk · inget halvmigrerat. | **(3)** |
| **I** | **Rensa kod:** radera `lib/<type>-mapper.ts`, custom state-typ, per-typ-byggare i `deterministic-transform.ts` (när familjen helt på `to-fields.ts`), oanvänd `write-entities/<type>.php`, "håll i synk"-kommentarer. | **(4)** |
| **J** | **Rensa Airtable:** exportera tabell (backup) → ta bort gamla skalärkolumner. ⚠️ MCP saknar `delete_field` → döp om till `__deprecated_*` via MCP, radera manuellt i UI. Rensa stub-/deprecated-artefakter. | **(5)** |
| **K** | Bocka av Definition of Done (§6) + uppdatera ARKITEKTURPLANs progress. | **(3)** |

**Varför F1 före F2:** en redesign förstör snapshot-diffen som regressionsskydd.
Migrera till identisk HTML först, redesigna som separat diff sen → en
migrerings-bugg kan aldrig förväxlas med en avsedd designändring.

---

## 6. Definition of Done (per familj)

- [ ] Fältlistan på exakt ett ställe (`schema/<entity>.json`).
- [ ] Spar gör 0 Anthropic-anrop (gäller redan globalt — bekräfta för familjen).
- [ ] Paritetsskript grönt på alla records.
- [ ] Gamla skalärkolumner borta i Airtable; bara native + `content_json` kvar.
- [ ] Renderare + editor putsade (redesign valfri, landad separat).
- [ ] `<type>-mapper.ts` + custom state-typ borttagna; inga "håll i synk"-kommentarer.

---

## 7. Ordning & progress (enkelt → svårt)

Single-table först → mönstret sitter innan multi-tabell.

| Tur | Familj | Tabeller | Status | Not |
|---|---|---|---|---|
| 0 | **contact_form + faq-block** | (tvärs ≥4 tabeller) | [ ] | Slutför halvmigrerad FAS 3: backfill `contact_form_*` → `content_json.contact_form`, droppa de 14 kolumnerna. **Uppvärmning** — bevisar backfill+dropp-receptet på en avgränsad yta. |
| 1 | customer-type | 1 | [ ] | Redan schema-driven (FAS 1). Enda nya = content_json + ta bort kvarvarande mapper. **Referensimplementation.** |
| 2 | cases | 1 | [ ] | Övar pseudo-array → json-array (quick_stat/result/gallery). |
| 3 | partner | 1 | [ ] | `faqs` redan JSON (precedent) + facts-pseudo-array. |
| 4 | landing (LP) | 3 | [ ] | Polymorfa tabs (7 typer) + sidebar-varianter. Första multi-tabell. |
| 5 | product-area (PA) | 4 | [ ] | Sektioner + delade products/solutions (native länkar kvar). |
| 6 | cms-pages | 3 | [ ] | 15 sektionstyper. Mest polymorf. Capstone. |
| — | automation-pillar | — | (skjuts upp) | Orörd; ev. FAS 5-absorption först. |

---

## 8. Globala risker & skydd

- **Live Airtable, inga transaktioner:** alltid additivt → backfill → flippa →
  **droppa sist**, med export-backup före drop. En familj helt klar innan nästa.
- **Repona deployar olika** (builder = Vercel auto på
  `claude/wexoe-page-builder-setup-DmUOd`; plugins = manuell zip): läsning måste
  tåla **båda** dataformaten tills båda sidor är ute *och* backfill klar. Tolerant
  hydrate (steg C) — fallback-koden tas bort i en sista städpass (§9).
- **Ingen CI/tester i plugins:** verifiering = paritetsskript + HTML-snapshot-diff
  + manuell zip-test.
- **FAS 2 flippades utan verifiering** — kör retroaktivt difftest på minst en
  familj innan vidare bygge, så `content_json`-lagret inte staplas på obevisad grund.
- **Schema-synken:** redan live (GitHub Actions, wexoeplugins→builder). Ändra
  scheman i `wexoe-core/schema/`, aldrig builder-kopian.

---

## 9. Engångsstädning efter sista familjen

- [ ] Ta bort fallback-på-platta-kolumner i hydrate (alla nu på content_json).
- [ ] Radera ev. kvarvarande per-typ-byggare i `deterministic-transform.ts` när
      alla familjer kör `to-fields.ts`.
- [ ] Verifiera 0 oanvända `write-entities/*.php`-sidscheman.
- [ ] ARKITEKTURPLAN: bocka FAS 1/2/3/6 klara.
