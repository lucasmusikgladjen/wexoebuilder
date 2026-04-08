# Plan: Refaktorera publish-flödet — ta bort MCP, gör Claude till transformer

## Bakgrund och problem

### Nuvarande arkitektur

```
Browser → POST /api/publish → Claude API (mcp-client-beta) → Airtable MCP Server → Airtable
```

Claude agerar som en autonom agent som autonomt anropar Airtable via MCP. Detta är dyrt av
tre skäl som multiplicerar varandra:

**1. MCP tool-definitioner skickas varje turn (~5 000 tokens)**
`mcp_toolset` laddar in _alla_ verktyg från Airtable MCP-servern (~12 stycken) med fullständiga
JSON-scheman och beskrivningar. Dessa skickas om i varje turn i den agentiska loopen.

**2. Agentisk loop — hela historiken upprepas varje steg**
Claude skapar records ett i taget. Varje nytt Airtable-anrop kräver ett nytt turn, och varje turn
inkluderar hela den ackumulerade konversationshistoriken. Med 5 tabs + downloads = 8–10 turns:

```
Turn 1:  tools(5k) + prompt(1k)                                    = 6 000 tokens in
Turn 2:  tools(5k) + prompt(1k) + prev_response + tool_result      = 8 000 tokens in
Turn 3:  ...                                                        = 11 000 tokens in
...
Turn 9:                                                             = ~23 000 tokens in
Total:                                                              = ~96 000–240 000 tokens in
```

**3. Claude utforskar schemat i onödan**
Trots att prompt innehåller exakta tabell-ID:n anropar Claude ofta `list_tables_for_base` eller
`get_table_schema` "för att verifiera". Airtablesvar på schemafrågor är enorma JSON-strukturer
(tusentals tokens) som sedan bärs med i alla efterföljande turns.

Resultatet: 237 000 input-tokens, ~$0.50–1.00 per publish, och rate-limit-krasher på konton
med 10 000 tokens/minut-begränsning.

### Varför Claude fortfarande behövs

Trots kostnaden är Claude inte utbytbar mot ren kod. Orsaken är att builder-statens datamodell
(`PageState`) inte matchar Airtables fältstruktur 1:1. Claude behövs för att:

- Splitta löpande text i benefits/outcomes till en benefit per rad (`\n`-separerat)
- Säkerställa Q:/A:-prefix i FAQ-innehåll
- Konvertera rader till pipe-format (`Label | Värde A | Värde B`)
- Utelämna tomma fält intelligent (inte skicka tomma strängar)
- Hantera edge cases i fri text som vi ännu inte känner till

Men Claude behöver **inte** vara en agent. Den behöver inte anropa Airtable. Den behöver
bara ta emot data och returnera ren JSON.

---

## Ny arkitektur

```
Browser → POST /api/publish
              │
              ├─ 1. Bygg prompt med PageState + Airtable-schema (från .md-fil)
              │
              ├─ 2. POST https://api.anthropic.com/v1/messages
              │       model: claude-sonnet-4-20250514
              │       inga tools, inga MCP-servers
              │       → Claude returnerar JSON med tre objekt
              │
              ├─ 3. Parsa Claudes JSON-output
              │
              ├─ 4. POST Airtable REST: skapa Landing Page → spara recordId
              │
              ├─ 5. POST Airtable REST: skapa alla Tabs (batch, max 10/anrop) → spara tab-recordIds
              │
              └─ 6. POST Airtable REST: skapa Downloads länkade till rätt tab-recordId
```

**Resultat:**
- ~2 000–4 000 tokens input (en enda turn, inga tools)
- ~500–1 000 tokens output
- Kostnad: ~$0.01–0.02 per publish
- Tid: ~3–5 sekunder (vs 15–30 sekunder)
- Inga rate-limit-risker

---

## Filer som berörs

| Fil | Åtgärd |
|-----|--------|
| `lib/airtable-schema.md` | Skapa ny — persistent schema-referens för Claude |
| `app/api/publish/route.ts` | Skriv om helt |

`components/PublishDialog.tsx` behöver **inga ändringar** — API-responsen har samma form.

---

## Steg 1: Skapa `lib/airtable-schema.md`

Denna fil är Claude-promptens "minnesfil" — den beskriver Airtable-strukturen exakt så att
Claude aldrig behöver fråga Airtable om sitt eget schema. Filen versionshanteras i repot och
uppdateras manuellt om Airtable-schemat ändras.

Skapa filen med exakt följande innehåll:

```markdown
# Airtable Schema — Wexoe Landing Pages

Base ID: appXoUcK68dQwASjF

---

## Tabell: Landing Pages
Table ID: tbl8KDqGq0Ray1uqS

| Fältnamn (exakt) | Typ | Noteringar |
|------------------|-----|------------|
| Name | text | Sätts till samma värde som Slug |
| Slug | text | URL-slug, t.ex. "mina-tjanster" |
| H1 | text | Sidans huvudrubrik |
| Hero Description | long text | Brödtext under H1 |
| Hero Image | text | URL till bild |
| Hero CTA Text | text | Text på primärknapp |
| Hero CTA URL | text | URL för primärknapp |
| Hero CTA2 Text | text | Text på sekundärknapp (utelämna om tomt) |
| Hero CTA2 URL | text | URL för sekundärknapp (utelämna om tomt) |
| Content H2 | text | Rubrik för innehållssektion |
| Content Text | long text | Brödtext i innehållssektion |
| Content Benefits | long text | En benefit per rad, \n-separerat |
| Sidebar Type | text | En av: "" \| "case" \| "event" \| "leadmagnet" \| "calculator" |
| Case Title | text | Endast om Sidebar Type = "case" |
| Case Description | long text | Endast om Sidebar Type = "case" |
| Case Image | text | URL, endast om Sidebar Type = "case" |
| Case Outcomes | long text | En outcome per rad, \n-separerat. Endast om Sidebar Type = "case" |
| Case CTA Text | text | Endast om Sidebar Type = "case" |
| Case CTA URL | text | Endast om Sidebar Type = "case" |
| Event Type | text | Endast om Sidebar Type = "event" |
| Event Title | text | Endast om Sidebar Type = "event" |
| Event Description | long text | Endast om Sidebar Type = "event" |
| Event Date | text | Datum som sträng, t.ex. "2026-05-15". Endast om Sidebar Type = "event" |
| Event Location | text | Endast om Sidebar Type = "event" |
| Event Webhook | text | URL, endast om Sidebar Type = "event" |
| Magnet Title | text | Endast om Sidebar Type = "leadmagnet" |
| Magnet Format | text | T.ex. "PDF", "Video". Endast om Sidebar Type = "leadmagnet" |
| Magnet Description | long text | Endast om Sidebar Type = "leadmagnet" |
| Magnet File URL | text | URL, endast om Sidebar Type = "leadmagnet" |
| Magnet Webhook | text | URL, endast om Sidebar Type = "leadmagnet" |
| Calc Title | text | Endast om Sidebar Type = "calculator" |
| Calc HTML | long text | Rå HTML, endast om Sidebar Type = "calculator" |
| Contact Name | text | |
| Contact Title | text | Personens yrkestitel |
| Contact Email | text | |
| Contact Phone | text | |
| Contact Image | text | URL |
| Contact Quote | long text | Citat från kontaktpersonen |
| Color Main | text | Hex-kod, t.ex. "#11325D" |
| Color Secondary | text | Hex-kod, t.ex. "#F28C28" |
| Show Content | boolean | Alltid inkludera (true/false) |
| Show Sidebar | boolean | Alltid inkludera (true/false) |
| Show Tabs | boolean | Alltid inkludera (true/false) |
| Show Contact | boolean | Alltid inkludera (true/false) |

---

## Tabell: LP Tabs
Table ID: tblvecOh3rAGmw3mw

| Fältnamn (exakt) | Typ | Noteringar |
|------------------|-----|------------|
| Name | text | Tabens visningsnamn |
| Landing Page | linked record | Array med ett LP-record-ID: ["recXXXXXX"] |
| Order | number | 1-baserat index (1, 2, 3, …) |
| Type | text | En av: "textimage" \| "fullmedia" \| "faq" \| "calameo" \| "downloads" \| "compare" \| "steps" |
| Visa | boolean | Alltid true |
| TI H2 | text | Rubrik. Endast om Type = "textimage" |
| TI Text | long text | Brödtext. Endast om Type = "textimage" |
| TI Benefits | long text | En benefit per rad, \n-separerat. Endast om Type = "textimage" |
| TI Image | text | URL. Endast om Type = "textimage" |
| TI Inverted | boolean | Byt plats bild/text. Endast om Type = "textimage" |
| FM URL | text | Embed-URL. Endast om Type = "fullmedia" |
| FAQ Content | long text | Varje fråga/svar på formatet "Q: …\nA: …", separerade med blankrad. Endast om Type = "faq" |
| Cal Title 1 | text | Endast om Type = "calameo" |
| Cal URL 1 | text | Embed-URL. Endast om Type = "calameo" |
| Cal Title 2 | text | Utelämna om tomt. Endast om Type = "calameo" |
| Cal URL 2 | text | Utelämna om tomt. Endast om Type = "calameo" |
| Cal Title 3 | text | Utelämna om tomt. Endast om Type = "calameo" |
| Cal URL 3 | text | Utelämna om tomt. Endast om Type = "calameo" |
| Compare Title | text | Valfri rubrik. Endast om Type = "compare" |
| Compare Col A | text | Kolumnrubrik A. Endast om Type = "compare" |
| Compare Col B | text | Kolumnrubrik B. Endast om Type = "compare" |
| Compare Rows | long text | En rad per rad: "Label \| Värde A \| Värde B". Endast om Type = "compare" |
| Steps Title | text | Valfri rubrik. Endast om Type = "steps" |
| Steps Rows | long text | En rad per rad: "Rubrik \| Beskrivning". Endast om Type = "steps" |

---

## Tabell: LP Downloads
Table ID: tblbLM827DzjWGjCR

| Fältnamn (exakt) | Typ | Noteringar |
|------------------|-----|------------|
| Name | text | Filens visningsnamn |
| LP Tab | linked record | Array med ett tab-record-ID: ["recXXXXXX"] |
| Description | long text | Kort beskrivning av filen |
| File URL | text | Direkt URL till filen |
| File Type | text | T.ex. "PDF", "XLSX", "ZIP" |
| Visa | boolean | Alltid true |
```

---

## Steg 2: Skriv om `app/api/publish/route.ts`

Ta bort hela den befintliga implementationen och ersätt med följande struktur.
Nedan beskrivs varje del exakt — implementera dem i ordning.

### 2a. Imports och konstanter

```typescript
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PageState } from '@/lib/types';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_API_KEY  = process.env.AIRTABLE_API_KEY;

const BASE_ID        = 'appXoUcK68dQwASjF';
const LP_TABLE_ID    = 'tbl8KDqGq0Ray1uqS';
const TABS_TABLE_ID  = 'tblvecOh3rAGmw3mw';
const DL_TABLE_ID    = 'tblbLM827DzjWGjCR';
```

### 2b. Typen för Claudes output

Claude ska returnera ett JSON-objekt med denna exakta form:

```typescript
interface ClaudeOutput {
  landingPage: Record<string, unknown>;
  tabs: Array<Record<string, unknown>>;
  // Varje download-objekt inkluderar "tabIndex" (0-baserat) för att koppla till rätt tab.
  // "tabIndex" används INTE som Airtable-fält — det är bara intern routing.
  downloads: Array<Record<string, unknown> & { tabIndex: number }>;
}
```

### 2c. Funktion: `buildTransformerPrompt(state: PageState): string`

Denna funktion bygger prompten till Claude. Den ska:

1. Läsa in `lib/airtable-schema.md` via `readFileSync(join(process.cwd(), 'lib', 'airtable-schema.md'), 'utf-8')`
2. Serialisera `state` till JSON
3. Returnera en prompt med denna exakta struktur:

```
Du är en dataomvandlare. Din enda uppgift är att ta emot en PageState (JSON) och
returnera ett rent JSON-objekt redo att skickas till Airtable REST API.

## Airtable-schema
<innehåll från lib/airtable-schema.md>

## PageState att omvandla
<JSON.stringify(state, null, 2)>

## Regler
- Returnera ENBART ett JSON-objekt, utan markdown-kodblock, utan förklaring.
- Utelämna fält vars värde är en tom sträng, null eller undefined.
- Boolean-fälten Show Content, Show Sidebar, Show Tabs, Show Contact ska ALLTID inkluderas.
- Tab-fältet "Visa" ska alltid vara true.
- Download-fältet "Visa" ska alltid vara true.
- Tab-fältet "Order" ska vara 1-baserat index (första tab = 1).
- "Landing Page" och "LP Tab" i outputs ska vara tomma arrays [] — route-handleren
  fyller i de faktiska record-ID:na efter att records skapats.
- Content Benefits: om texten är en löpande mening eller kommaseparerad lista,
  splitta till en benefit per rad (\n-separerat).
- Case Outcomes: samma regel som Content Benefits.
- FAQ Content: varje fråga/svar ska ha Q:/A:-prefix. Format: "Q: fråga\nA: svar",
  separerade med blankrad mellan varje par.
- Compare Rows: varje rad på formatet "Label | Värde A | Värde B".
- Steps Rows: varje rad på formatet "Rubrik | Beskrivning".
- TI Benefits: samma regel som Content Benefits.
- downloads-arrayen: varje element ska ha ett extra fält "tabIndex" (0-baserat heltal)
  som anger vilket tab-index i tabs-arrayen den tillhör. "tabIndex" är INTE ett Airtable-fält.

## Returnera
Exakt detta JSON-objekt (fyll i med rätt data):
{
  "landingPage": { ...fält för Landing Pages-tabellen... },
  "tabs": [ ...ett objekt per tab med fält för LP Tabs-tabellen... ],
  "downloads": [ ...ett objekt per download med fält + tabIndex... ]
}
```

### 2d. Funktion: `callClaudeTransformer(prompt: string): Promise<ClaudeOutput>`

Anropar Claude API utan tools, en enda turn:

```typescript
async function callClaudeTransformer(prompt: string): Promise<ClaudeOutput> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();

  // Logga token-användning
  const usage = data.usage ?? {};
  console.log('[publish] Claude transformer tokens:', {
    input: usage.input_tokens,
    output: usage.output_tokens,
    estimatedCostUsd: (
      (usage.input_tokens / 1_000_000) * 3 +
      (usage.output_tokens / 1_000_000) * 15
    ).toFixed(4),
  });

  // Extrahera text från svaret
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Claude returnerade inget textsvar');

  // Parsa JSON — hantera att Claude kan ha lagt till markdown-kodblock trots instruktion
  let jsonText: string = textBlock.text.trim();
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonText = codeBlockMatch[1].trim();

  try {
    return JSON.parse(jsonText) as ClaudeOutput;
  } catch {
    throw new Error(`Kunde inte parsa Claudes JSON-output: ${jsonText.slice(0, 200)}`);
  }
}
```

### 2e. Funktion: `airtableCreate(tableId: string, records: Record<string, unknown>[]): Promise<string[]>`

Skapar records i Airtable och returnerar deras ID:n. Hanterar batching (Airtables gräns är 10
records per anrop).

```typescript
async function airtableCreate(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<string[]> {
  const ids: string[] = [];

  // Dela upp i batchar om max 10
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const body = { records: batch.map(fields => ({ fields })) };

    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Airtable error ${res.status} för tabell ${tableId}`);
    }

    const data = await res.json();
    for (const record of data.records) {
      ids.push(record.id);
    }
  }

  return ids;
}
```

### 2f. POST-handler

```typescript
export async function POST(request: Request) {
  // Validera miljövariabler
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY ej konfigurerad' }, { status: 500 });
  }
  if (!AIRTABLE_API_KEY) {
    return NextResponse.json({ error: 'AIRTABLE_API_KEY ej konfigurerad' }, { status: 500 });
  }

  try {
    const state: PageState = await request.json();

    // Validering
    if (!state.slug?.trim()) {
      return NextResponse.json({ error: 'Slug är obligatoriskt' }, { status: 400 });
    }
    if (!state.h1?.trim()) {
      return NextResponse.json({ error: 'H1 (rubrik) är obligatoriskt' }, { status: 400 });
    }

    // ── Steg 1: Claude transformerar PageState → ren Airtable-data ──
    const prompt = buildTransformerPrompt(state);
    const output = await callClaudeTransformer(prompt);

    // ── Steg 2: Skapa Landing Page record ──
    const [lpRecordId] = await airtableCreate(LP_TABLE_ID, [output.landingPage]);

    // ── Steg 3: Skapa Tab records med länk till LP-record ──
    let tabRecordIds: string[] = [];
    if (output.tabs.length > 0) {
      const tabsWithLink = output.tabs.map(tab => ({
        ...tab,
        'Landing Page': [lpRecordId],
      }));
      tabRecordIds = await airtableCreate(TABS_TABLE_ID, tabsWithLink);
    }

    // ── Steg 4: Skapa Download records med länk till rätt Tab-record ──
    let downloadCount = 0;
    if (output.downloads.length > 0) {
      const dlsWithLink = output.downloads.map(dl => {
        const { tabIndex, ...fields } = dl;
        const tabRecordId = tabRecordIds[tabIndex];
        if (!tabRecordId) {
          throw new Error(`Download refererar till tabIndex ${tabIndex} men bara ${tabRecordIds.length} tabs skapades`);
        }
        return { ...fields, 'LP Tab': [tabRecordId] };
      });
      const dlIds = await airtableCreate(DL_TABLE_ID, dlsWithLink);
      downloadCount = dlIds.length;
    }

    return NextResponse.json({
      success: true,
      recordId: lpRecordId,
      slug: state.slug,
      tabCount: tabRecordIds.length,
      downloadCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel';
    console.error('[publish] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

## Steg 3: Rensa bort token-tracking-koden från `PublishDialog.tsx`

Token-tracking implementerades i en tidigare commit men passar inte längre nu när vi inte
returnerar `tokenUsage` från API:et. Ta bort:

- `TokenUsage`-interfacet
- `tokenUsage?: TokenUsage` från `PublishResult`
- `tokenUsage: data.tokenUsage` i `setResult()`-anropet
- Hela token-panelen i success-vyn (det stora `{result.tokenUsage && (...)}` blocket)

---

## Checklista för implementeraren

- [ ] Skapa `lib/airtable-schema.md` med exakt innehåll enligt Steg 1
- [ ] Skriv om `app/api/publish/route.ts` enligt Steg 2 (ta bort all gammal kod)
- [ ] Städa `components/PublishDialog.tsx` enligt Steg 3
- [ ] Verifiera att TypeScript kompilerar utan fel (`npx tsc --noEmit`)
- [ ] Manuellt testa ett publish-anrop och verifiera att records skapas korrekt i Airtable
- [ ] Kontrollera i Anthropic-dashboarden att token-antalet är väsentligt lägre (~2 000–5 000 in)

---

## Viktiga edge cases att verifiera

1. **Sida utan tabs** — `output.tabs` är tom array, `airtableCreate` anropas inte för tabs
2. **Tab utan downloads** — `output.downloads` är tom array
3. **Mer än 10 tabs** — batching i `airtableCreate` hanterar detta automatiskt
4. **Claude lägger till markdown-kodblock** — parsar bort ` ```json ` i `callClaudeTransformer`
5. **Fel tabIndex i downloads** — kastar tydligt felmeddelande
6. **Airtable returnerar 422** — `airtableCreate` kastar Error med Airtables felmeddelande

---

## Vad som INTE ändras

- `components/PublishDialog.tsx` — förutom borttagning av token-tracking (Steg 3)
- `app/api/read/route.ts` — berörs inte
- `lib/types.ts` — berörs inte
- `lib/state.ts` — berörs inte
- Alla editor- och preview-komponenter — berörs inte
