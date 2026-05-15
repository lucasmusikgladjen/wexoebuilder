/**
 * Shared Claude-middleman transformation helper.
 *
 * Every page-save path (LP, PA, Audience, Unique Page create/update) funnels user
 * state through this module. It builds a user-data JSON payload that
 * includes `_clientIndex` / `_recordId` back-end metadata, calls Claude
 * with the appropriate schema and mode-aware system prompt, retries once
 * on transient errors (overloaded, bad JSON), and returns a typed
 * transformation result that the routes can correlate against existing
 * Airtable records for PATCH / CREATE / DELETE.
 *
 * The backend, *not* Claude, handles stale-field clearing on tab-type
 * and sidebar-type switches — `clearsForTabType` / `clearsForSidebarType`
 * return empty-string maps that PATCH wipes.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { PageState } from './types';
import { ProductAreaState } from './product-area-types';
import { AudienceState } from './audience-types';
import { audienceStateToFields } from './audience-mapper';
import { UniquePageState } from './unique-page-types';
import { uniquePageStateToFields } from './unique-page-mapper';

// ─── Schemas loaded once at module boot ────────────────────────────────────
const SCHEMA_LP = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-lp.md'),
  'utf-8',
);
const SCHEMA_PA = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-pa.md'),
  'utf-8',
);

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;
const RETRY_DELAY_MS = 3000;

export type TransformMode = 'create' | 'update';

// ─── Result types ──────────────────────────────────────────────────────────

export interface LpTransformTab {
  _clientIndex: number;
  _recordId: string | null;
  fields: Record<string, unknown>;
}

export interface LpTransformDownload {
  _clientIndex: number;
  _tabClientIndex: number;
  _recordId: string | null;
  fields: Record<string, unknown>;
}

export interface LpTransformResult {
  landingPage: Record<string, unknown>;
  tabs: LpTransformTab[];
  downloads: LpTransformDownload[];
}

export interface PaTransformLinked {
  _clientIndex: number;
  _recordId: string | null;
  fields: Record<string, unknown>;
}

export interface PaTransformResult {
  productArea: Record<string, unknown>;
  products: PaTransformLinked[];
  solutions: PaTransformLinked[];
}

// ─── Low-level Claude call with retry ──────────────────────────────────────

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  };

  // Try twice: first attempt, one retry after a 3-second backoff for
  // transient failures (Overloaded 529, 503 Service Unavailable, empty
  // body, or invalid JSON shape). Non-transient errors still get retried
  // once — simpler than classifying every Anthropic error code.
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message =
          errData.error?.message || `Claude API error: ${res.status}`;
        throw new Error(message);
      }

      const data = await res.json();
      let text = '';
      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') text += block.text;
        }
      }

      // Strip markdown code fences if Claude added them
      text = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      if (!text) {
        throw new Error('Claude returnerade ett tomt svar');
      }

      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 1) {
        console.warn(
          `[claude-transform] Attempt ${attempt} failed: ${lastError.message} — retrying in ${RETRY_DELAY_MS}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error('Claude API error');
}

function parseJsonOrThrow<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error('[claude-transform] Invalid JSON from Claude:', text);
    throw new Error('Claude returnerade ogiltig JSON. Försök igen.');
  }
}

// ─── LP payload builder ────────────────────────────────────────────────────

function buildLpPayload(state: PageState, mode: TransformMode): string {
  const tabsData = state.tabs.map((tab, i) => {
    const base: Record<string, unknown> = {
      _clientIndex: i,
      _recordId: tab.recordId ?? null,
      name: tab.name,
      type: tab.type,
    };

    switch (tab.type) {
      case 'textimage':
        Object.assign(base, {
          tiH2: tab.tiH2,
          tiText: tab.tiText,
          tiBenefits: tab.tiBenefits,
          tiImage: tab.tiImage,
          tiInverted: tab.tiInverted,
        });
        break;
      case 'fullmedia':
        base.fmUrl = tab.fmUrl;
        break;
      case 'faq':
        base.faqItems = tab.faqItems.map((f) => ({
          q: f.question,
          a: f.answer,
        }));
        break;
      case 'calameo':
        Object.assign(base, {
          calTitle1: tab.calTitle1,
          calUrl1: tab.calUrl1,
          calTitle2: tab.calTitle2,
          calUrl2: tab.calUrl2,
          calTitle3: tab.calTitle3,
          calUrl3: tab.calUrl3,
        });
        break;
      case 'downloads':
        base.downloads = tab.downloads.map((d, dlIdx) => ({
          _clientIndex: dlIdx,
          _recordId: d.recordId ?? null,
          name: d.name,
          description: d.description,
          fileUrl: d.fileUrl,
          fileType: d.fileType,
        }));
        break;
      case 'compare':
        Object.assign(base, {
          compareTitle: tab.compareTitle,
          compareColA: tab.compareColA,
          compareColB: tab.compareColB,
          compareRows: tab.compareRows.map((r) => ({
            label: r.label,
            a: r.valueA,
            b: r.valueB,
          })),
        });
        break;
      case 'steps':
        Object.assign(base, {
          stepsTitle: tab.stepsTitle,
          stepsItems: tab.stepsItems.map((s) => ({
            title: s.title,
            description: s.description,
          })),
        });
        break;
    }

    return base;
  });

  const data: Record<string, unknown> = {
    _mode: mode,
    _recordId: state.recordId ?? null,
    slug: state.slug,
    h1: state.h1,
    heroDescription: state.heroDescription,
    heroImage: state.heroImage,
    heroCta1Text: state.heroCta1Text,
    heroCta1Url: state.heroCta1Url,
    heroCta2Text: state.heroCta2Text,
    heroCta2Url: state.heroCta2Url,
    contentH2: state.contentH2,
    contentText: state.contentText,
    contentBenefits: state.contentBenefits,
    sidebarType: state.sidebarType,
    contactName: state.contactName,
    contactTitle: state.contactTitle,
    contactEmail: state.contactEmail,
    contactPhone: state.contactPhone,
    contactImage: state.contactImage,
    contactQuote: state.contactQuote,
    colorMain: state.colorMain,
    colorSecondary: state.colorSecondary,
    showContent: state.showContent,
    showSidebar: state.showSidebar,
    showTabs: state.showTabs,
    showContact: state.showContact,
  };

  if (state.sidebarType === 'case') {
    Object.assign(data, {
      caseTitle: state.caseTitle,
      caseDescription: state.caseDescription,
      caseImage: state.caseImage,
      caseOutcomes: state.caseOutcomes,
      caseCta: state.caseCta,
      caseCtaUrl: state.caseCtaUrl,
    });
  } else if (state.sidebarType === 'event') {
    Object.assign(data, {
      eventType: state.eventType,
      eventTitle: state.eventTitle,
      eventDescription: state.eventDescription,
      eventDate: state.eventDate,
      eventLocation: state.eventLocation,
      eventWebhook: state.eventWebhook,
    });
  } else if (state.sidebarType === 'leadmagnet') {
    Object.assign(data, {
      magnetTitle: state.magnetTitle,
      magnetFormat: state.magnetFormat,
      magnetDescription: state.magnetDescription,
      magnetFileUrl: state.magnetFileUrl,
      magnetWebhook: state.magnetWebhook,
    });
  } else if (state.sidebarType === 'calculator') {
    Object.assign(data, {
      calcTitle: state.calcTitle,
      calcHtml: state.calcHtml,
    });
  }

  data.tabs = tabsData;

  // Contact Form — alla 15 fält flät-inkluderade så Claude ser dem direkt.
  data.showContactForm = state.showContactForm;
  data.contactFormEyebrow = state.contactForm.eyebrow;
  data.contactFormTitle = state.contactForm.title;
  data.contactFormSubtitle = state.contactForm.subtitle;
  data.contactFormLayout = state.contactForm.layout;
  data.contactFormTheme = state.contactForm.theme;
  data.contactFormShowCompany = state.contactForm.showCompany;
  data.contactFormShowPhone = state.contactForm.showPhone;
  data.contactFormShowDropdown = state.contactForm.showDropdown;
  data.contactFormDropdownLabel = state.contactForm.dropdownLabel;
  data.contactFormOptions = state.contactForm.options;
  data.contactFormCtaText = state.contactForm.ctaText;
  data.contactFormMessageLabel = state.contactForm.messageLabel;
  data.contactFormTrustSignals = state.contactForm.trustSignals;
  data.contactFormShowContactPerson = state.contactForm.showContactPerson;

  return JSON.stringify(data, null, 2);
}

function buildLpSystemPrompt(mode: TransformMode): string {
  const common = `Du är en datatransformerare. Du tar emot landing page-data i JSON-format och konverterar den till Airtable-redo JSON enligt schemat nedan.

${SCHEMA_LP}

Svara med ENBART valid JSON (ingen markdown, ingen förklaring).

Output-format:
{
  "landingPage": { <Airtable-fältnamn>: <värde>, ... },
  "tabs": [
    {
      "_clientIndex": <number — ECHA från input>,
      "_recordId": <string|null — ECHA från input>,
      "fields": { <Airtable-fältnamn>: <värde>, ... }
    }
  ],
  "downloads": [
    {
      "_clientIndex": <number — ECHA från input>,
      "_tabClientIndex": <number — _clientIndex för parent-taben>,
      "_recordId": <string|null — ECHA från input>,
      "fields": { <Airtable-fältnamn>: <värde>, ... }
    }
  ]
}

KRITISKT:
- _clientIndex, _tabClientIndex och _recordId måste echas OFÖRÄNDRADE från input till output. Backend använder dem för att korrelera mot existerande records.
- Använd exakta Airtable-fältnamn från schemat (snake_case för cms_landing_pages-familjen).
- Utelämna "landing_page_ids"-fältet från tabs.fields — backend länkar.
- Utelämna "tab_ids"-fältet från downloads.fields — backend länkar.
- Tabs.fields måste innehålla name, tab_type, order (= _clientIndex + 1), is_active: true och typ-specifika fält.
- Downloads.fields måste innehålla name, order (= _clientIndex + 1 inom dess tab), is_active: true.
- Applicera alla formateringsregler i schemat (benefits-splitting, FAQ Q:/A:-prefix, pipe-format, osv.).`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna fält med tomt värde (tomma strängar, null).
- Inkludera ALLTID boolean-fält (show_content, show_sidebar, show_tabs, show_contact, show_contact_form, is_active, ti_inverted, contact_form_show_company, contact_form_show_phone, contact_form_show_dropdown, contact_form_show_contact_person).
- Utelämna downloads, FAQ-items, compare-rows och steps-items som är helt tomma.`;
  }

  return `${common}

MODE: UPDATE
- Backend PATCHar records där _recordId finns, CREATEar där _recordId är null, och DELETEar records som saknas från din output.
- Backend hanterar stale-field-clearing vid tab-typ-switches och sidebar-typ-switches. Du behöver INTE sätta fält till tomma strängar för att rensa.
- Bevara ordningen exakt via _clientIndex.
- Du MÅSTE emittera en post i tabs-arrayen för VARJE tab i input — aldrig utelämna. Det är nödvändigt för att backend ska kunna korrelera.
- Du MÅSTE emittera en post i downloads-arrayen för VARJE download i input — även helt tomma.
- Inkludera ALLA FAQ-items, compare-rows och steps-items från input.
- Inkludera ALLTID boolean-fält (show_content/sidebar/tabs/contact, show_contact_form, alla contact_form_show_*-checkboxes, is_active, ti_inverted).
- Inkludera ALLTID alla 15 contact_form_*-fält i landingPage.fields (även om värdet är tomt/falskt) så att de inte tappas vid PATCH.`;
}

export async function transformLandingPage(
  apiKey: string,
  state: PageState,
  mode: TransformMode,
): Promise<LpTransformResult> {
  const userPayload = buildLpPayload(state, mode);
  const systemPrompt = buildLpSystemPrompt(mode);
  const userPrompt = `Transformera denna data till Airtable-format:\n\n${userPayload}`;

  const responseText = await callClaude(apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<LpTransformResult>(responseText);

  // Minimal top-level shape guard
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returnerade oväntat format.');
  }
  if (!parsed.landingPage || typeof parsed.landingPage !== 'object') {
    throw new Error('Claude utelämnade landingPage-objektet.');
  }

  // `tabs` and `downloads` must be arrays. In UPDATE mode a missing or
  // non-array value would silently translate to "delete everything" when
  // the route diffs against existing records — refuse to proceed in that
  // case. In CREATE mode defaulting to [] is safe: no existing children
  // exist, so the result is just a bare LP with no linked rows.
  if (!Array.isArray(parsed.tabs)) {
    if (mode === 'update') {
      throw new Error('Claude utelämnade tabs-arrayen i update-läget.');
    }
    parsed.tabs = [];
  }
  if (!Array.isArray(parsed.downloads)) {
    if (mode === 'update') {
      throw new Error('Claude utelämnade downloads-arrayen i update-läget.');
    }
    parsed.downloads = [];
  }

  return parsed;
}

// ─── PA payload builder ────────────────────────────────────────────────────

function buildPaPayload(state: ProductAreaState, mode: TransformMode): string {
  const data: Record<string, unknown> = {
    _mode: mode,
    _recordId: state.recordId || null,
    slug: state.slug,
    h1: state.h1,
    topBg: state.topBg,

    heroH2: state.heroH2,
    heroText: state.heroText,
    heroCtaText: state.heroCtaText,
    heroCtaUrl: state.heroCtaUrl,
    heroBenefits: state.heroBenefits,
    heroImage: state.heroImage,
    heroBg: state.heroBg,
    heroAccent: state.heroAccent,

    npiTitle: state.npiTitle,
    npiDescription: state.npiDescription,
    npiImage: state.npiImage,
    npiLink: state.npiLink,

    toggleBg: state.toggleBg,
    toggleHeaderBg: state.toggleHeaderBg,
    toggleAccent: state.toggleAccent,

    solutionsTitle: state.solutionsTitle,
    solutionsBg: state.solutionsBg,
    solutionsCardBg: state.solutionsCardBg,

    normal1: state.normal1,
    normal2: state.normal2,
    normal3: state.normal3,
    normal4: state.normal4,

    contactName: state.contactName,
    contactTitle: state.contactTitle,
    contactEmail: state.contactEmail,
    contactPhone: state.contactPhone,
    contactImage: state.contactImage,
    contactText: state.contactText,
    contactBg: state.contactBg,

    docsTitle: state.docsTitle,
    docsIframe: state.docsIframe,
    docsBg: state.docsBg,

    sideMenu: state.sideMenu,
    request: state.request,
    defaultOpen: state.defaultOpen,

    products: state.products.map((p, i) => ({
      _clientIndex: i,
      _recordId: p.recordId || null,
      name: p.name,
      headerSideMenu: p.headerSideMenu,
      ecosystemDescription: p.ecosystemDescription,
      description: p.description,
      bullets: p.bullets,
      image: p.image,
      button1Text: p.button1Text,
      button1Url: p.button1Url,
      button2Text: p.button2Text,
      button2Url: p.button2Url,
      horizontal: p.horizontal,
      visa: p.visa,
    })),

    solutions: state.solutions.map((s, i) => ({
      _clientIndex: i,
      _recordId: s.recordId || null,
      name: s.name,
      image: s.image,
      url: s.url,
      description: s.description,
      category: s.category,
      ctaText: s.ctaText,
      visa: s.visa,
    })),

    // Contact Form (alla 15 fält)
    showContactForm: state.showContactForm,
    contactFormEyebrow: state.contactForm.eyebrow,
    contactFormTitle: state.contactForm.title,
    contactFormSubtitle: state.contactForm.subtitle,
    contactFormLayout: state.contactForm.layout,
    contactFormTheme: state.contactForm.theme,
    contactFormShowCompany: state.contactForm.showCompany,
    contactFormShowPhone: state.contactForm.showPhone,
    contactFormShowDropdown: state.contactForm.showDropdown,
    contactFormDropdownLabel: state.contactForm.dropdownLabel,
    contactFormOptions: state.contactForm.options,
    contactFormCtaText: state.contactForm.ctaText,
    contactFormMessageLabel: state.contactForm.messageLabel,
    contactFormTrustSignals: state.contactForm.trustSignals,
    contactFormShowContactPerson: state.contactForm.showContactPerson,
  };

  return JSON.stringify(data, null, 2);
}

function buildPaSystemPrompt(mode: TransformMode): string {
  const common = `Du är en datatransformerare. Du tar emot produktsida-data i JSON-format och konverterar den till Airtable-redo JSON enligt schemat nedan.

${SCHEMA_PA}

Svara med ENBART valid JSON (ingen markdown, ingen förklaring).

Output-format:
{
  "productArea": { <Airtable-fältnamn>: <värde>, ... },
  "products": [
    {
      "_clientIndex": <number — ECHA från input>,
      "_recordId": <string|null — ECHA från input>,
      "fields": { <Airtable-fältnamn>: <värde>, ... }
    }
  ],
  "solutions": [
    {
      "_clientIndex": <number — ECHA från input>,
      "_recordId": <string|null — ECHA från input>,
      "fields": { <Airtable-fältnamn>: <värde>, ... }
    }
  ]
}

KRITISKT:
- _clientIndex och _recordId måste echas OFÖRÄNDRADE från input till output.
- Använd exakta Airtable-fältnamn från schemat.
- Inkludera ALDRIG "Products", "Solutions" eller "Division" i productArea.fields — backend hanterar dessa länkar.
- Inkludera ALDRIG "Product Area" i products.fields — backend länkar.
- Inkludera ALDRIG "Product Areas" i solutions.fields — backend länkar.
- Sätt ALLTID Order = _clientIndex + 1 på varje product och solution.
- Inkludera ALLTID boolean-fält (Visa, Horizontal, Side menu, Request, Default open, Normal N Reversed, Normal N upp, Show Contact Form, Contact Form Show Company, Contact Form Show Phone, Contact Form Show Dropdown, Contact Form Show Contact Person).
- Inkludera ALLTID alla 15 Contact Form *-fält i productArea.fields (även tomma) så de inte tappas vid PATCH.
- Applicera alla formateringsregler (bullets-splitting, benefits-splitting, osv.).`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna fält med tomt värde (tomma strängar, null), MEN inkludera ALLTID Contact Form-checkboxes och Layout/Theme även vid CREATE.`;
  }

  return `${common}

MODE: UPDATE
- Backend PATCHar records där _recordId finns, CREATEar där _recordId är null, DELETEar records som saknas från din output.
- Backend hanterar stale-field-clearing. Du behöver INTE sätta fält till tomma strängar för att rensa.
- Bevara ordningen via _clientIndex.
- Du MÅSTE emittera en post i products-arrayen för VARJE product i input — aldrig utelämna. Backend behöver det för diffen.
- Du MÅSTE emittera en post i solutions-arrayen för VARJE solution i input.
- Inkludera ALLTID alla 15 Contact Form *-fält i productArea.fields även om värdena är tomma eller false.`;
}

export async function transformProductArea(
  apiKey: string,
  state: ProductAreaState,
  mode: TransformMode,
): Promise<PaTransformResult> {
  const userPayload = buildPaPayload(state, mode);
  const systemPrompt = buildPaSystemPrompt(mode);
  const userPrompt = `Transformera denna data till Airtable-format:\n\n${userPayload}`;

  const responseText = await callClaude(apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<PaTransformResult>(responseText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returnerade oväntat format.');
  }
  if (!parsed.productArea || typeof parsed.productArea !== 'object') {
    throw new Error('Claude utelämnade productArea-objektet.');
  }

  // In UPDATE mode the PA route rebuilds the `Products` / `Solutions`
  // link arrays from the transformed output and PATCHes them onto the PA
  // record, so a silently-coerced `[]` would unlink every product and
  // solution from the page in a single save. Refuse that destructive
  // default. CREATE mode is tolerant — no existing children, nothing to
  // lose.
  if (!Array.isArray(parsed.products)) {
    if (mode === 'update') {
      throw new Error('Claude utelämnade products-arrayen i update-läget.');
    }
    parsed.products = [];
  }
  if (!Array.isArray(parsed.solutions)) {
    if (mode === 'update') {
      throw new Error('Claude utelämnade solutions-arrayen i update-läget.');
    }
    parsed.solutions = [];
  }

  return parsed;
}


// ─── Simple single-record page transforms (Audience, Unique Page) ───────────

export interface SingleRecordTransformResult {
  fields: Record<string, unknown>;
}

function normalizeClaudeFields(
  parsed: SingleRecordTransformResult,
  allowedKeys: Set<string>,
  pageLabel: string,
): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object' || !parsed.fields || typeof parsed.fields !== 'object') {
    throw new Error(`Claude utelämnade fields-objektet för ${pageLabel}.`);
  }

  const out: Record<string, unknown> = {};
  const unknownKeys: string[] = [];
  for (const [key, value] of Object.entries(parsed.fields)) {
    if (!allowedKeys.has(key)) {
      unknownKeys.push(key);
      continue;
    }
    if (value !== undefined) out[key] = value;
  }
  if (unknownKeys.length > 0) {
    throw new Error(
      `Claude returnerade okända Airtable-fält för ${pageLabel}: ${unknownKeys.join(', ')}.`,
    );
  }
  return out;
}

function buildSingleRecordSystemPrompt(args: {
  pageLabel: string;
  mode: TransformMode;
  allowedFields: readonly string[];
  formattingRules: string;
}): string {
  const updateRule = args.mode === 'update'
    ? '- I UPDATE måste du returnera ALLA fält från candidateFields så att rensade värden verkligen PATCHas till Airtable.'
    : '- I CREATE får du utelämna tomma textfält/null-värden, men behåll booleans och fält med meningsfulla defaults.';

  return `Du är ett strikt backend-mellanled mellan en mänsklig editor och Airtable.
Din uppgift är att översätta användarvänlig builder-state till Airtable-ready fields för ${args.pageLabel}.

VIKTIG PRINCIP:
- Användardata får inte postas direkt till Airtable. Du är sista transformeringssteget.
- Returnera ENBART valid JSON. Ingen markdown, ingen förklaring.
- Output-formatet MÅSTE vara exakt: { "fields": { ... } }.
- Du får ENDAST använda dessa Airtable-fältnamn:
${args.allowedFields.map((field) => `  - ${field}`).join('\n')}
${updateRule}
- Bevara booleans som booleans, arrays som arrays och numbers som numbers.
- Hitta inte på innehåll. Du får bara normalisera/strukturera/formattera användarens data.

FORMATTERINGSREGLER:
${args.formattingRules}`;
}

async function transformSingleRecordPage(args: {
  apiKey: string;
  pageLabel: string;
  state: unknown;
  candidateFields: Record<string, unknown>;
  mode: TransformMode;
  formattingRules: string;
}): Promise<Record<string, unknown>> {
  const allowedFields = Object.keys(args.candidateFields);
  const systemPrompt = buildSingleRecordSystemPrompt({
    pageLabel: args.pageLabel,
    mode: args.mode,
    allowedFields,
    formattingRules: args.formattingRules,
  });
  const userPrompt = `Transformera denna builder-state till Airtable fields.\n\n${JSON.stringify({
    mode: args.mode,
    state: args.state,
    candidateFields: args.candidateFields,
  }, null, 2)}`;

  const responseText = await callClaude(args.apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<SingleRecordTransformResult>(responseText);
  return normalizeClaudeFields(parsed, new Set(allowedFields), args.pageLabel);
}

export async function transformAudiencePage(
  apiKey: string,
  state: AudienceState,
  mode: TransformMode,
): Promise<Record<string, unknown>> {
  const candidateFields = audienceStateToFields(state, mode);
  return transformSingleRecordPage({
    apiKey,
    pageLabel: 'Audience/Kundtyp-sida',
    state,
    candidateFields,
    mode,
    formattingRules: `
- Audience-tabellen använder legacy PascalCase Airtable-fältnamn.
- Contact Form-fälten heter "Contact Form ..." och ska alltid hållas konsekventa med input.
- Stat Number ska vara number om användaren angett ett tal; annars null i update.
- Rich text-fält (Description, Value Text 1/2, Benefit 1/2/3, Case Description/Result) får normaliseras varsamt men inte skrivas om innehållsmässigt.`,
  });
}

export async function transformUniquePage(
  apiKey: string,
  state: UniquePageState,
  mode: TransformMode,
): Promise<Record<string, unknown>> {
  const candidateFields = uniquePageStateToFields(state, mode);
  return transformSingleRecordPage({
    apiKey,
    pageLabel: 'Unique Page/Egen sida',
    state,
    candidateFields,
    mode,
    formattingRules: `
- cms_unique_pages använder snake_case Airtable-fältnamn.
- FAQ är särskilt viktig: faq_items ska vara ett rich-long-text-fält där varje fråga/svar ligger på egen rad i formatet **Fråga** | Svar. Om state.faq.items redan följer formatet, bevara det. Om användaren skrivit enklare rad-/Q/A-format, normalisera till exakt detta format.
- Text/rich-text-fält ska vara renderingsvänliga för Wexoe Core men inte få påhittat innehåll.
- Linked record-arrayer (country_ids, division_ids) måste bevaras som array av Airtable record IDs.
- Contact Form-fälten med prefix contact_form_ ska alltid hållas konsekventa med input.`,
  });
}

// ─── Backend type-switch clearing helpers ──────────────────────────────────
//
// These are the authoritative lists of type-specific Airtable fields. Used
// by the update paths to explicitly PATCH removed fields to empty strings
// (or `false` for the one checkbox) so switching a tab from `textimage` to
// `faq` — or an LP sidebar from `case` to `event` — wipes the old data.

export const LP_SIDEBAR_CASE_FIELDS = [
  'case_title',
  'case_description',
  'case_image_url',
  'case_outcomes',
  'case_cta_text',
  'case_cta_url',
];
export const LP_SIDEBAR_EVENT_FIELDS = [
  'event_type',
  'event_title',
  'event_description',
  'event_date',
  'event_location',
  'event_webhook',
];
export const LP_SIDEBAR_LEADMAGNET_FIELDS = [
  'magnet_title',
  'magnet_format',
  'magnet_description',
  'magnet_file_url',
  'magnet_webhook',
];
export const LP_SIDEBAR_CALC_FIELDS = ['calc_title', 'calc_html'];

const ALL_LP_SIDEBAR_FIELDS = [
  ...LP_SIDEBAR_CASE_FIELDS,
  ...LP_SIDEBAR_EVENT_FIELDS,
  ...LP_SIDEBAR_LEADMAGNET_FIELDS,
  ...LP_SIDEBAR_CALC_FIELDS,
];

export const LP_TAB_TEXTIMAGE_FIELDS = [
  'ti_h2',
  'ti_text',
  'ti_benefits',
  'ti_image_url',
  'ti_inverted',
];
export const LP_TAB_FULLMEDIA_FIELDS = ['fm_url'];
export const LP_TAB_FAQ_FIELDS = ['faq_items'];
export const LP_TAB_CALAMEO_FIELDS = [
  'calameo_1_title',
  'calameo_1_src',
  'calameo_2_title',
  'calameo_2_src',
  'calameo_3_title',
  'calameo_3_src',
];
export const LP_TAB_COMPARE_FIELDS = [
  'compare_title',
  'compare_col_a',
  'compare_col_b',
  'compare_rows',
];
export const LP_TAB_STEPS_FIELDS = ['steps_title', 'steps'];

const ALL_LP_TAB_FIELDS = [
  ...LP_TAB_TEXTIMAGE_FIELDS,
  ...LP_TAB_FULLMEDIA_FIELDS,
  ...LP_TAB_FAQ_FIELDS,
  ...LP_TAB_CALAMEO_FIELDS,
  ...LP_TAB_COMPARE_FIELDS,
  ...LP_TAB_STEPS_FIELDS,
];

/** Fields belonging to the given LP tab type. Empty set for unknown types. */
function fieldsForTabType(type: string): Set<string> {
  switch (type) {
    case 'textimage':
      return new Set(LP_TAB_TEXTIMAGE_FIELDS);
    case 'fullmedia':
      return new Set(LP_TAB_FULLMEDIA_FIELDS);
    case 'faq':
      return new Set(LP_TAB_FAQ_FIELDS);
    case 'calameo':
      return new Set(LP_TAB_CALAMEO_FIELDS);
    case 'compare':
      return new Set(LP_TAB_COMPARE_FIELDS);
    case 'steps':
      return new Set(LP_TAB_STEPS_FIELDS);
    default:
      return new Set();
  }
}

/** For a tab being updated to `newType`, returns `""` (or `false` for the
 *  TI Inverted checkbox) for every type-specific field that does NOT belong
 *  to the new type. Merge this into the Claude-returned fields before PATCH
 *  so a type switch wipes stale data from the previous type. */
export function clearsForTabType(newType: string): Record<string, unknown> {
  const keep = fieldsForTabType(newType);
  const out: Record<string, unknown> = {};
  for (const field of ALL_LP_TAB_FIELDS) {
    if (!keep.has(field)) {
      out[field] = field === 'ti_inverted' ? false : '';
    }
  }
  return out;
}

/** Same idea for an LP's `Sidebar Type` — clears fields belonging to the
 *  previous sidebar variant. Empty `newType` (the "— Ingen —" option) clears
 *  every sidebar field. */
export function clearsForSidebarType(newType: string): Record<string, unknown> {
  const keep = new Set<string>();
  if (newType === 'case') LP_SIDEBAR_CASE_FIELDS.forEach((f) => keep.add(f));
  else if (newType === 'event') LP_SIDEBAR_EVENT_FIELDS.forEach((f) => keep.add(f));
  else if (newType === 'leadmagnet') LP_SIDEBAR_LEADMAGNET_FIELDS.forEach((f) => keep.add(f));
  else if (newType === 'calculator') LP_SIDEBAR_CALC_FIELDS.forEach((f) => keep.add(f));

  const out: Record<string, unknown> = {};
  for (const field of ALL_LP_SIDEBAR_FIELDS) {
    if (!keep.has(field)) out[field] = '';
  }
  return out;
}
