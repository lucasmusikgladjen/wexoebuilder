/**
 * Shared Claude-middleman transformation helper.
 *
 * Every page-save path (LP create/update, PA create/update) funnels user
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
import { CustomerTypePageState } from './customer-type-types';
import { CmsPageState, PageSection, TabsSection } from './cms-page-types';
import {
  CaseState,
  CASE_QUICK_STATS_MAX,
  CASE_RESULTS_MAX,
  CASE_GALLERY_MAX,
} from './case-types';
import { PartnerPageState } from './partner-types';

// ─── Schemas loaded once at module boot ────────────────────────────────────
const SCHEMA_LP = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-lp.md'),
  'utf-8',
);
const SCHEMA_PA = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-pa.md'),
  'utf-8',
);
const SCHEMA_CUSTOMER_TYPE = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-customer-type.md'),
  'utf-8',
);
const SCHEMA_CMS_PAGE = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-cms-page.md'),
  'utf-8',
);
const SCHEMA_CASE = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-case.md'),
  'utf-8',
);
const SCHEMA_PARTNER = readFileSync(
  join(process.cwd(), 'lib', 'airtable-schema-partner.md'),
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

export interface CustomerTypeTransformResult {
  customerTypePage: Record<string, unknown>;
}

export interface CaseTransformResult {
  case: Record<string, unknown>;
}

export interface PartnerTransformResult {
  partnerPage: Record<string, unknown>;
}

export interface CmsPageTransformSection {
  _clientIndex: number;
  _recordId: string | null;
  fields: Record<string, unknown>;
}

export interface CmsPageTransformTab {
  _clientIndex: number;
  _sectionClientIndex: number;
  _recordId: string | null;
  fields: Record<string, unknown>;
}

export interface CmsPageTransformResult {
  page: Record<string, unknown>;
  sections: CmsPageTransformSection[];
  sectionTabs: CmsPageTransformTab[];
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

  // sidebar_type=case har inga inline-fält längre — caset länkas via case_id
  // (multipleRecordLinks → cms_cases) som backend sätter direkt i /api/publish,
  // utanför Claude-transformen (samma mönster som tab_ids).
  if (state.sidebarType === 'event') {
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

    // Normal 1-4 sektioner persisteras deterministiskt i
    // product-area-actions.ts (egna cms_product_page_sections-records). Skickas
    // inte till Claude.

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
- Använd exakta Airtable-fältnamn från schemat (snake_case för cms_product_pages-familjen).
- Inkludera ALDRIG "product_ids", "solution_ids", "division_ids", "section_ids", "country_ids" i productArea.fields — backend hanterar alla länkar.
- Inkludera ALDRIG "product_page_ids" i products.fields — backend länkar.
- Inkludera ALDRIG "article_ids", "supplier_ids", "case_ids" i products.fields — backend hanterar.
- Inkludera ALDRIG "product_page_ids" i solutions.fields — backend länkar.
- Sätt ALLTID order = _clientIndex + 1 på varje product och solution.
- Inkludera ALLTID boolean-fält (is_active, horizontal, use_side_menu, show_request, default_open, reversed, shown_top, show_contact_form, contact_form_show_company, contact_form_show_phone, contact_form_show_dropdown, contact_form_show_contact_person).
- Inkludera ALLTID alla 15 contact_form_*-fält i productArea.fields (även tomma) så de inte tappas vid PATCH.
- Applicera alla formateringsregler (bullets-splitting, benefits-splitting, osv.).`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna fält med tomt värde (tomma strängar, null), MEN inkludera ALLTID Contact Form-checkboxes och layout/theme även vid CREATE.`;
  }

  return `${common}

MODE: UPDATE
- Backend PATCHar records där _recordId finns, CREATEar där _recordId är null, DELETEar records som saknas från din output.
- Backend hanterar stale-field-clearing. Du behöver INTE sätta fält till tomma strängar för att rensa.
- Bevara ordningen via _clientIndex.
- Du MÅSTE emittera en post i products-arrayen för VARJE product i input — aldrig utelämna. Backend behöver det för diffen.
- Du MÅSTE emittera en post i solutions-arrayen för VARJE solution i input.
- Inkludera ALLTID alla 15 contact_form_*-fält i productArea.fields även om värdena är tomma eller false.`;
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

// ─── Customer Type page payload builder ────────────────────────────────────

function buildCustomerTypePayload(
  state: CustomerTypePageState,
  mode: TransformMode,
): string {
  const data: Record<string, unknown> = {
    _mode: mode,
    _recordId: state.recordId || null,

    slug: state.slug,
    is_active: state.isActive,
    name: state.name,

    eyebrow: state.eyebrow,
    title: state.title,
    description: state.description,
    cta_text: state.ctaText,
    cta_url: state.ctaUrl,
    hero_image_url: state.heroImageUrl,
    stat_number: state.statNumber,
    stat_label: state.statLabel,

    value_h2: state.valueH2,
    value_text_1: state.valueText1,
    value_text_2: state.valueText2,
    benefit_1: state.benefit1,
    benefit_2: state.benefit2,
    benefit_3: state.benefit3,

    // Contact form (15 fält)
    show_contact_form: state.showContactForm,
    contact_form_eyebrow: state.contactForm.eyebrow,
    contact_form_title: state.contactForm.title,
    contact_form_subtitle: state.contactForm.subtitle,
    contact_form_layout: state.contactForm.layout,
    contact_form_theme: state.contactForm.theme,
    contact_form_show_company: state.contactForm.showCompany,
    contact_form_show_phone: state.contactForm.showPhone,
    contact_form_show_dropdown: state.contactForm.showDropdown,
    contact_form_dropdown_label: state.contactForm.dropdownLabel,
    contact_form_options: state.contactForm.options,
    contact_form_cta_text: state.contactForm.ctaText,
    contact_form_message_label: state.contactForm.messageLabel,
    contact_form_trust_signals: state.contactForm.trustSignals,
    contact_form_show_contact_person: state.contactForm.showContactPerson,
  };

  return JSON.stringify(data, null, 2);
}

function buildCustomerTypeSystemPrompt(mode: TransformMode): string {
  const common = `Du är en datatransformerare. Du tar emot kundtyp-sida-data i JSON-format och konverterar den till Airtable-redo JSON enligt schemat nedan.

${SCHEMA_CUSTOMER_TYPE}

Svara med ENBART valid JSON (ingen markdown, ingen förklaring).

Output-format:
{
  "customerTypePage": { <Airtable-fältnamn>: <värde>, ... }
}

KRITISKT:
- Använd exakta Airtable-fältnamn från schemat (snake_case).
- Inkludera ALDRIG "country_ids", "customer_type_ids", "case_ids" i outputen — backend rör dem inte i denna sidtyp.
- Inkludera ALDRIG "internal_notes" i outputen.
- Inkludera ALLTID boolean-fält (is_active, show_contact_form, alla contact_form_show_*-checkboxes).
- Inkludera ALLTID alla 15 contact_form_*-fält vid UPDATE (även tomma/false).
- stat_number: skicka som number om värdet är ifyllt. Vid CREATE: utelämna när tomt. Vid UPDATE: skicka null när tomt.`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna fält med tomt värde (tomma strängar, null), MEN inkludera ALLTID boolean-fält, layout/theme och alla contact_form_show_*-checkboxes.`;
  }

  return `${common}

MODE: UPDATE
- Inkludera ALLA fält från input (även tomma) så Airtable rensar dem som tömts.
- Inkludera ALLTID alla 15 contact_form_*-fält i customerTypePage även om värdena är tomma eller false.`;
}

export async function transformCustomerType(
  apiKey: string,
  state: CustomerTypePageState,
  mode: TransformMode,
): Promise<CustomerTypeTransformResult> {
  const userPayload = buildCustomerTypePayload(state, mode);
  const systemPrompt = buildCustomerTypeSystemPrompt(mode);
  const userPrompt = `Transformera denna data till Airtable-format:\n\n${userPayload}`;

  const responseText = await callClaude(apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<CustomerTypeTransformResult>(responseText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returnerade oväntat format.');
  }
  if (!parsed.customerTypePage || typeof parsed.customerTypePage !== 'object') {
    throw new Error('Claude utelämnade customerTypePage-objektet.');
  }

  return parsed;
}


// ─── Case payload builder ──────────────────────────────────────────────────

function buildCasePayload(state: CaseState, mode: TransformMode): string {
  // Pseudo-arrays skickas som riktiga arrays här. Claude expanderar till
  // numrerade fält enligt schema-MD-instruktionerna. Vid UPDATE måste vi
  // skicka MAX-antal items så Claude tömmer borttagna positioner — annars
  // skulle ett item som tagits bort i editorn stå kvar i Airtable. Padding
  // sker här (inte i system-prompten) så Claude bara behöver mappa items
  // till numrerade fält.
  const padArray = <T extends Record<string, string>>(
    arr: T[],
    max: number,
    empty: T,
  ): T[] => {
    if (mode === 'create') return arr;
    const out: T[] = [...arr];
    while (out.length < max) out.push({ ...empty });
    return out.slice(0, max);
  };

  const quickStats = padArray(
    state.quickStats,
    CASE_QUICK_STATS_MAX,
    { value: '', label: '' },
  );
  const results = padArray(
    state.results,
    CASE_RESULTS_MAX,
    { value: '', label: '' },
  );
  const galleryImages = padArray(
    state.galleryImages,
    CASE_GALLERY_MAX,
    { url: '', caption: '' },
  );

  const data: Record<string, unknown> = {
    _mode: mode,
    _recordId: state.recordId || null,

    slug: state.slug,
    internal_notes: state.internalNotes,
    is_active: state.isActive,

    // SEO
    seo_title: state.seoTitle,
    seo_description: state.seoDescription,
    og_image_url: state.ogImageUrl,

    // Header
    industry: state.industry,
    title: state.title,
    subtitle: state.subtitle,
    customer_name: state.customerName,
    location: state.location,
    project_year: state.projectYear,
    project_type: state.projectType,
    reading_time: state.readingTime,
    header_logos: state.headerLogos,

    // Lead
    lead_image_url: state.leadImageUrl,
    lead_image_caption: state.leadImageCaption,
    lead_paragraph: state.leadParagraph,

    // Stats strip
    show_stats_strip: state.showStatsStrip,
    quick_stats: quickStats,

    // Challenge
    challenge_eyebrow: state.challengeEyebrow,
    challenge_title: state.challengeTitle,
    challenge_text: state.challengeText,
    challenge_bullets: state.challengeBullets,
    challenge_image_url: state.challengeImageUrl,
    challenge_image_caption: state.challengeImageCaption,

    // Pullquote
    show_pullquote: state.showPullquote,
    pullquote_text: state.pullquoteText,
    pullquote_attribution: state.pullquoteAttribution,

    // Solution
    solution_eyebrow: state.solutionEyebrow,
    solution_title: state.solutionTitle,
    solution_text: state.solutionText,
    solution_image_url: state.solutionImageUrl,
    solution_image_caption: state.solutionImageCaption,

    // Products
    products_title: state.productsTitle,
    products_meta: state.productsMeta,
    product_ids: state.productIds,
    article_ids: state.articleIds,

    // Results
    results_eyebrow: state.resultsEyebrow,
    results_title: state.resultsTitle,
    results_text: state.resultsText,
    results,

    // Testimonial
    show_testimonial: state.showTestimonial,
    testimonial_quote: state.testimonialQuote,
    testimonial_photo_url: state.testimonialPhotoUrl,
    testimonial_author_name: state.testimonialAuthorName,
    testimonial_author_title: state.testimonialAuthorTitle,

    // Gallery
    show_gallery: state.showGallery,
    gallery_title: state.galleryTitle,
    gallery_images: galleryImages,

    // About customer
    show_about_customer: state.showAboutCustomer,
    about_customer_logo_url: state.aboutCustomerLogoUrl,
    about_customer_title: state.aboutCustomerTitle,
    about_customer_text: state.aboutCustomerText,
    about_customer_link_label: state.aboutCustomerLinkLabel,
    about_customer_url: state.aboutCustomerUrl,

    // Glance sidebar
    glance_challenge: state.glanceChallenge,
    glance_solution: state.glanceSolution,
    glance_result: state.glanceResult,

    // Contact form (15 fält)
    show_contact_form: state.showContactForm,
    contact_form_eyebrow: state.contactForm.eyebrow,
    contact_form_title: state.contactForm.title,
    contact_form_subtitle: state.contactForm.subtitle,
    contact_form_layout: state.contactForm.layout,
    contact_form_theme: state.contactForm.theme,
    contact_form_show_company: state.contactForm.showCompany,
    contact_form_show_phone: state.contactForm.showPhone,
    contact_form_show_dropdown: state.contactForm.showDropdown,
    contact_form_dropdown_label: state.contactForm.dropdownLabel,
    contact_form_options: state.contactForm.options,
    contact_form_cta_text: state.contactForm.ctaText,
    contact_form_message_label: state.contactForm.messageLabel,
    contact_form_trust_signals: state.contactForm.trustSignals,
    contact_form_show_contact_person: state.contactForm.showContactPerson,
  };

  return JSON.stringify(data, null, 2);
}

function buildCaseSystemPrompt(mode: TransformMode): string {
  const common = `Du är en datatransformerare. Du tar emot case-sida-data i JSON-format och konverterar den till Airtable-redo JSON enligt schemat nedan.

${SCHEMA_CASE}

Svara med ENBART valid JSON (ingen markdown, ingen förklaring).

Output-format:
{
  "case": { <Airtable-fältnamn>: <värde>, ... }
}

KRITISKT:
- Använd exakta Airtable-fältnamn från schemat (snake_case).
- ALDRIG inkludera "cms_partner_pages" (backlink) i outputen.
- Inkludera ALLTID boolean-fält: is_active, show_stats_strip, show_pullquote, show_testimonial, show_gallery, show_about_customer, show_contact_form, contact_form_show_company, contact_form_show_phone, contact_form_show_dropdown, contact_form_show_contact_person.
- Inkludera ALLTID alla 15 contact_form_*-fält i case-objektet (även tomma/false) så de inte tappas vid PATCH.
- Pseudo-arrayerna i input (quick_stats, results, gallery_images) ska EXPANDERAS till numrerade Airtable-fält:
  • quick_stats[0..3] → quick_stat_1_value, quick_stat_1_label, quick_stat_2_value, ... quick_stat_4_value, quick_stat_4_label
  • results[0..3] → result_1_value, result_1_label, ... result_4_value, result_4_label
  • gallery_images[0..5] → gallery_image_1_url, gallery_image_1_caption, ... gallery_image_6_url, gallery_image_6_caption
- product_ids och article_ids: skicka som array av string rec-IDs (eller []).
- Lines-fält (header_logos, challenge_bullets, contact_form_options, contact_form_trust_signals): skicka RÅ multiline-sträng — inte array.`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna fält med tomt värde (tomma strängar, null), MEN inkludera ALLTID boolean-fält, layout/theme och alla contact_form_show_*-checkboxar.
- Utelämna pseudo-array-fält (quick_stat_N_*, result_N_*, gallery_image_N_*) där värdena är tomma.
- Utelämna product_ids/article_ids om arrayen är tom.`;
  }

  return `${common}

MODE: UPDATE
- Inkludera ALLA fält från input (även tomma) som "" så Airtable rensar dem.
- Inkludera ALLTID alla 15 contact_form_*-fält i case (även tomma/false).
- Inkludera ALLTID ALLA pseudo-array-fält upp till MAX-antal:
  • quick_stat_1_value..quick_stat_4_label (8 fält totalt)
  • result_1_value..result_4_label (8 fält totalt)
  • gallery_image_1_url..gallery_image_6_caption (12 fält totalt)
  Skicka "" för positioner som inte har data i input. Detta krävs så Airtable rensar items användaren raderat.
- Skicka product_ids och article_ids även när tomma (tom array []).`;
}

export async function transformCase(
  apiKey: string,
  state: CaseState,
  mode: TransformMode,
): Promise<CaseTransformResult> {
  const userPayload = buildCasePayload(state, mode);
  const systemPrompt = buildCaseSystemPrompt(mode);
  const userPrompt = `Transformera denna data till Airtable-format:\n\n${userPayload}`;

  const responseText = await callClaude(apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<CaseTransformResult>(responseText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returnerade oväntat format.');
  }
  if (!parsed.case || typeof parsed.case !== 'object') {
    throw new Error('Claude utelämnade case-objektet.');
  }

  // Backfilla product_ids / article_ids från state — skydd mot Claude som
  // glömmer eller returnerar non-array. PATCH-en skulle annars tolka som
  // "lämna fältet orört" vid CREATE eller "lägg inte till länkar" vid UPDATE.
  if (!Array.isArray(parsed.case.product_ids)) {
    parsed.case.product_ids = state.productIds;
  }
  if (!Array.isArray(parsed.case.article_ids)) {
    parsed.case.article_ids = state.articleIds;
  }

  return parsed;
}


// ─── Partner Page (leverantörssida) payload builder ───────────────────────

function buildPartnerPayload(
  state: PartnerPageState,
  mode: TransformMode,
): string {
  // Flatten ut quick-facts till 4 slot-fält. Tomma slots skickas som
  // tomsträng vid UPDATE så Airtable rensar dem.
  const factsPayload: Record<string, string> = {};
  for (let i = 0; i < 4; i++) {
    const slot = i + 1;
    const fact = state.facts[i] ?? { icon: '', value: '', label: '' };
    factsPayload[`facts_${slot}_icon`] = fact.icon;
    factsPayload[`facts_${slot}_value`] = fact.value;
    factsPayload[`facts_${slot}_label`] = fact.label;
  }

  const data: Record<string, unknown> = {
    _mode: mode,
    _recordId: state.recordId || null,

    // Identity
    slug: state.slug,
    is_active: state.isActive,
    internal_notes: state.internalNotes,
    partner_ids: state.partnerIds,
    country_ids: state.countryIds,

    // SEO
    seo_title: state.seoTitle,
    seo_description: state.seoDescription,
    og_image_url: state.ogImageUrl,

    // Hero
    hero_eyebrow: state.heroEyebrow,
    h1: state.h1,
    hero_tagline: state.heroTagline,
    hero_cta_text: state.heroCtaText,
    hero_cta_url: state.heroCtaUrl,
    hero_cta2_text: state.heroCta2Text,
    hero_cta2_url: state.heroCta2Url,
    hero_image_url: state.heroImageUrl,

    // Quick Facts
    show_quick_facts: state.showQuickFacts,
    ...factsPayload,

    // About
    show_about: state.showAbout,
    about_eyebrow: state.aboutEyebrow,
    about_h2: state.aboutH2,
    about_text: state.aboutText,
    about_image_url: state.aboutImageUrl,
    about_badge_value: state.aboutBadgeValue,
    about_badge_label: state.aboutBadgeLabel,

    // Why Wexoe + benefits + cases
    show_why_wexoe: state.showWhyWexoe,
    why_h2: state.whyH2,
    why_text: state.whyText,
    why_benefits: state.whyBenefits, // string[] — Claude joinar till lines
    case_ids: state.caseIds,
    cases_view_all_text: state.casesViewAllText,
    cases_view_all_url: state.casesViewAllUrl,

    // Categories
    show_categories: state.showCategories,
    categories_eyebrow: state.categoriesEyebrow,
    categories_h2: state.categoriesH2,
    categories_intro: state.categoriesIntro,
    category_ids: state.categoryIds,

    // FAQ — Claude serialiserar till JSON-sträng, drop:ar clientId
    show_faq: state.showFaq,
    faq_h2: state.faqH2,
    faqs: state.faqs.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),

    // Contact Person
    show_contact_person: state.showContactPerson,
    contact_name: state.contactName,
    contact_title: state.contactTitle,
    contact_email: state.contactEmail,
    contact_phone: state.contactPhone,
    contact_image_url: state.contactImageUrl,
    contact_quote: state.contactQuote,

    // Contact Form (15 fält) — identisk uppsättning som andra sidtyper
    show_contact_form: state.showContactForm,
    contact_form_eyebrow: state.contactForm.eyebrow,
    contact_form_title: state.contactForm.title,
    contact_form_subtitle: state.contactForm.subtitle,
    contact_form_layout: state.contactForm.layout,
    contact_form_theme: state.contactForm.theme,
    contact_form_show_company: state.contactForm.showCompany,
    contact_form_show_phone: state.contactForm.showPhone,
    contact_form_show_dropdown: state.contactForm.showDropdown,
    contact_form_dropdown_label: state.contactForm.dropdownLabel,
    contact_form_options: state.contactForm.options,
    contact_form_cta_text: state.contactForm.ctaText,
    contact_form_message_label: state.contactForm.messageLabel,
    contact_form_trust_signals: state.contactForm.trustSignals,
    contact_form_show_contact_person: state.contactForm.showContactPerson,
  };

  return JSON.stringify(data, null, 2);
}

function buildPartnerSystemPrompt(mode: TransformMode): string {
  const common = `Du är en datatransformerare. Du tar emot partner-sida-data (leverantörssida) i JSON-format och konverterar den till Airtable-redo JSON enligt schemat nedan.

${SCHEMA_PARTNER}

Svara med ENBART valid JSON (ingen markdown, ingen förklaring).

Output-format:
{
  "partnerPage": { <Airtable-fältnamn>: <värde>, ... }
}

KRITISKT:
- Använd exakta Airtable-fältnamn från schemat (snake_case).
- Inkludera ALLTID boolean-fält (is_active, alla show_*-toggles inkl. de 4 contact_form_show_*).
- Inkludera ALLTID alla 15 contact_form_*-fält vid UPDATE (även tomma/false).
- "why_benefits" kommer som en array av strängar. Joina med "\\n", trimma varje rad, filtrera bort tomma rader. Emit som en multilineText-sträng.
- "faqs" kommer som en array av {question, answer}-objekt. Filtrera bort poster där question är tom. Emit som JSON.stringify(...) av den filtrerade arrayen. Tom array → "[]". Inkludera ALDRIG clientId eller andra meta-fält.
- Quick-facts-ikon (facts_N_icon) måste vara en av: "calendar","users","globe","shield","building","factory","award","package","briefcase","target", eller "". Allt annat → "".
- Linkade record-fält (partner_ids, country_ids, case_ids, category_ids) är arrayer av Airtable record-IDs. Skicka dem som arrayer, inte strängar.`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna textfält med tomt värde (tomma strängar).
- Utelämna länkade arrayer som är tomma (partner_ids, country_ids, case_ids, category_ids).
- Inkludera ALLTID boolean-fält, layout/theme, alla quick-facts-ikon-fält och alla contact_form_*-checkboxes.
- "faqs" och "why_benefits": utelämna om respektive input-array är tom.`;
  }

  return `${common}

MODE: UPDATE
- Inkludera ALLA fält från input (även tomma textfält som "") så Airtable rensar dem som tömts.
- Länkade arrayer (partner_ids, country_ids, case_ids, category_ids): skicka ALLTID arrayen (även tom) så marknadsföraren kan ta bort länkningar.
- "faqs": skicka alltid (även "[]"-sträng om tom). "why_benefits": skicka alltid (även "" om tom).
- Inkludera ALLTID alla 15 contact_form_*-fält i partnerPage även om värdena är tomma eller false.`;
}

export async function transformPartner(
  apiKey: string,
  state: PartnerPageState,
  mode: TransformMode,
): Promise<PartnerTransformResult> {
  const userPayload = buildPartnerPayload(state, mode);
  const systemPrompt = buildPartnerSystemPrompt(mode);
  const userPrompt = `Transformera denna data till Airtable-format:\n\n${userPayload}`;

  const responseText = await callClaude(apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<PartnerTransformResult>(responseText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returnerade oväntat format.');
  }
  if (!parsed.partnerPage || typeof parsed.partnerPage !== 'object') {
    throw new Error('Claude utelämnade partnerPage-objektet.');
  }

  return parsed;
}


// ─── CMS Page payload builder ─────────────────────────────────────────────

function sectionToPayload(sec: PageSection, index: number): Record<string, unknown> {
  // Universella fält + typ-diskriminator för Claude.
  const base: Record<string, unknown> = {
    _clientIndex: index,
    _recordId: sec.recordId || null,
    type: sec.type,
    internal_label: sec.internalLabel,
    is_active: sec.isActive,
    anchor_id: sec.anchorId,
    layout: sec.layout,
    theme: sec.theme,
    top_padding: sec.topPadding,
    bottom_padding: sec.bottomPadding,
  };

  switch (sec.type) {
    case 'hero':
      return { ...base,
        hero_eyebrow: sec.eyebrow, hero_h1: sec.h1, hero_subtitle: sec.subtitle,
        hero_image_url: sec.imageUrl,
        hero_cta_text: sec.ctaText, hero_cta_url: sec.ctaUrl,
        hero_cta2_text: sec.cta2Text, hero_cta2_url: sec.cta2Url };
    case 'text_image':
      return { ...base,
        ti_eyebrow: sec.eyebrow, ti_h2: sec.h2, ti_body: sec.body, ti_bullets: sec.bullets,
        ti_image_url: sec.imageUrl, ti_image_alt: sec.imageAlt, ti_reversed: sec.reversed,
        ti_cta_text: sec.ctaText, ti_cta_url: sec.ctaUrl,
        ti_cta2_text: sec.cta2Text, ti_cta2_url: sec.cta2Url };
    case 'text_only':
      return { ...base,
        to_eyebrow: sec.eyebrow, to_h2: sec.h2, to_body: sec.body, to_align: sec.align };
    case 'company_data_strip':
      return { ...base,
        cds_h2: sec.h2, cds_use_company_singleton: sec.useCompanySingleton,
        cds_country_code: sec.countryCode, cds_items: sec.items };
    case 'news_text_split':
      return { ...base,
        nts_eyebrow: sec.eyebrow, nts_h2: sec.h2, nts_body: sec.body,
        nts_cta_text: sec.ctaText, nts_cta_url: sec.ctaUrl,
        nts_news_manual_ids: sec.newsManualIds,
        nts_scope_division: sec.scopeDivision, nts_scope_country: sec.scopeCountry,
        nts_limit: sec.limit };
    case 'case_grid':
      return { ...base,
        cg_eyebrow: sec.eyebrow, cg_h2: sec.h2, cg_body: sec.body,
        cg_case_manual_ids: sec.caseManualIds,
        cg_scope_country: sec.scopeCountry, cg_scope_division: sec.scopeDivision,
        cg_scope_customer_type: sec.scopeCustomerType,
        cg_limit: sec.limit, cg_columns: sec.columns };
    case 'news_grid':
      return { ...base,
        ng_eyebrow: sec.eyebrow, ng_h2: sec.h2,
        ng_article_manual_ids: sec.articleManualIds,
        ng_scope_country: sec.scopeCountry, ng_scope_division: sec.scopeDivision,
        ng_scope_topic: sec.scopeTopic,
        ng_limit: sec.limit, ng_columns: sec.columns };
    case 'catalog':
      return { ...base,
        cat_eyebrow: sec.eyebrow, cat_h2: sec.h2, cat_intro_body: sec.introBody,
        cat_include_products: sec.includeProducts, cat_include_articles: sec.includeArticles,
        cat_scope_division: sec.scopeDivision, cat_scope_country: sec.scopeCountry,
        cat_facet_fields: sec.facetFields,
        cat_placeholder: sec.placeholder, cat_empty_text: sec.emptyText };
    case 'tabs':
      // Tabs sub-records skickas separat (sectionTabs) — endast container-fälten här.
      return { ...base,
        tabs_eyebrow: sec.eyebrow, tabs_h2: sec.h2, tabs_intro_body: sec.introBody };
    case 'team_grid':
      return { ...base,
        tg_eyebrow: sec.eyebrow, tg_h2: sec.h2, tg_body: sec.body, tg_variant: sec.variant,
        tg_coworker_manual_ids: sec.coworkerManualIds,
        tg_scope_country: sec.scopeCountry, tg_scope_division: sec.scopeDivision,
        tg_limit: sec.limit };
    case 'partner_list':
      return { ...base,
        pl_eyebrow: sec.eyebrow, pl_h2: sec.h2, pl_body: sec.body, pl_variant: sec.variant,
        pl_partner_manual_ids: sec.partnerManualIds,
        pl_scope_division: sec.scopeDivision, pl_scope_country: sec.scopeCountry,
        pl_limit: sec.limit };
    case 'faq':
      return { ...base,
        faq_eyebrow: sec.eyebrow, faq_h2: sec.h2, faq_body: sec.body, faq_items: sec.items };
    case 'testimonial':
      return { ...base,
        t_eyebrow: sec.eyebrow, t_quote: sec.quote,
        t_author_name: sec.authorName, t_author_title: sec.authorTitle,
        t_author_image_url: sec.authorImageUrl,
        t_testimonial_manual_ids: sec.testimonialManualIds,
        t_scope_country: sec.scopeCountry, t_scope_division: sec.scopeDivision,
        t_scope_customer_type: sec.scopeCustomerType,
        t_featured_only: sec.featuredOnly };
    case 'cta_banner':
      return { ...base,
        cta_eyebrow: sec.eyebrow, cta_h2: sec.h2, cta_body: sec.body,
        cta_cta_text: sec.ctaText, cta_cta_url: sec.ctaUrl,
        cta_cta2_text: sec.cta2Text, cta_cta2_url: sec.cta2Url,
        cta_image_url: sec.imageUrl };
    case 'contact_form':
      return { ...base,
        cf_eyebrow: sec.eyebrow, cf_title: sec.title, cf_subtitle: sec.subtitle,
        cf_layout: sec.cfLayout,
        cf_show_company: sec.showCompany, cf_show_phone: sec.showPhone,
        cf_show_dropdown: sec.showDropdown, cf_dropdown_label: sec.dropdownLabel,
        cf_options: sec.options, cf_cta_text: sec.ctaText, cf_message_label: sec.messageLabel,
        cf_trust_signals: sec.trustSignals, cf_show_contact_person: sec.showContactPerson,
        cf_contact_scope_country: sec.contactScopeCountry,
        cf_contact_scope_division: sec.contactScopeDivision };
  }
}

function buildCmsPagePayload(state: CmsPageState, mode: TransformMode): string {
  // Bygg sektion-payloaden + en platt tabs-array med _sectionClientIndex.
  const sectionsPayload = state.sections.map((sec, i) => sectionToPayload(sec, i));

  const tabsPayload: Array<Record<string, unknown>> = [];
  state.sections.forEach((sec, sectionIndex) => {
    if (sec.type !== 'tabs') return;
    const tabsSection = sec as TabsSection;
    tabsSection.tabs.forEach((t, tabIndex) => {
      tabsPayload.push({
        _clientIndex: tabIndex,
        _sectionClientIndex: sectionIndex,
        _recordId: t.recordId || null,
        name: t.name,
        is_active: t.isActive,
        eyebrow: t.eyebrow,
        h2: t.h2,
        body: t.body,
        bullets: t.bullets,
        image_url: t.imageUrl,
        image_alt: t.imageAlt,
        cta_text: t.ctaText,
        cta_url: t.ctaUrl,
        cta2_text: t.cta2Text,
        cta2_url: t.cta2Url,
      });
    });
  });

  const data: Record<string, unknown> = {
    _mode: mode,
    _recordId: state.recordId || null,
    slug: state.slug,
    internal_label: state.internalLabel,
    h1: state.h1,
    seo_title: state.seoTitle,
    seo_description: state.seoDescription,
    og_image_url: state.ogImageUrl,
    is_published: state.isPublished,
    country_ids: state.countryIds,
    division_ids: state.divisionIds,
    page_theme: state.pageTheme,
    max_width: state.maxWidth,
    sections: sectionsPayload,
    sectionTabs: tabsPayload,
  };
  return JSON.stringify(data, null, 2);
}

function buildCmsPageSystemPrompt(mode: TransformMode): string {
  const common = `Du är en datatransformerare. Du tar emot informationssida-data i JSON-format och konverterar den till Airtable-redo JSON enligt schemat nedan.

${SCHEMA_CMS_PAGE}

Svara med ENBART valid JSON (ingen markdown, ingen förklaring).

Output-format:
{
  "page": { <cms_pages-fältnamn>: <värde>, ... },
  "sections": [
    {
      "_clientIndex": <number — ECHA från input>,
      "_recordId": <string|null — ECHA från input>,
      "fields": { "section_type": "<typ>", "order": <_clientIndex + 1>, "is_active": <bool>, ... typspecifika fält ... }
    }
  ],
  "sectionTabs": [
    {
      "_clientIndex": <number — ECHA från input>,
      "_sectionClientIndex": <number — ECHA från input — anger vilken parent-tabs-section>,
      "_recordId": <string|null — ECHA från input>,
      "fields": { "name": "...", "order": <_clientIndex + 1>, "is_active": <bool>, ... }
    }
  ]
}

KRITISKT:
- _clientIndex, _sectionClientIndex och _recordId måste echas OFÖRÄNDRADE från input till output. Backend använder dem för att korrelera mot existerande records.
- Använd exakta Airtable-fältnamn från schemat (snake_case).
- Inkludera ALDRIG "section_ids" i page.fields — backend länkar.
- Inkludera ALDRIG "page_ids" eller "tabs_tab_ids" i sections.fields — backend länkar.
- Inkludera ALDRIG "section_ids" i sectionTabs.fields — backend länkar.
- Inkludera ALDRIG "internal_notes" i någon output.
- Varje section.fields måste ha "section_type", "order" (= _clientIndex + 1), "is_active", "layout", "theme", "top_padding", "bottom_padding".
- För varje section.fields: inkludera ENDAST fält som hör till section_type (samt de universella). Inkludera INTE fält från andra typer.
- Varje sectionTabs.fields måste ha "name", "order" (= _clientIndex + 1), "is_active".
- Inkludera ALLTID boolean-fält som schemat markerar "ALLTID inkluderas" (även när false).
- Inkludera ALLTID singleSelect-fält som schemat markerar "ALLTID inkluderas".
- Inkludera ALLTID country_ids och division_ids på page (även tom array vid UPDATE).
- Number-fält (*_limit): skicka number om > 0. Vid CREATE: utelämna när 0. Vid UPDATE: skicka null när 0.
- Linked-record-fält (*_manual_ids): skicka som array av string rec-IDs. Backend hanterar passthrough.`;

  if (mode === 'create') {
    return `${common}

MODE: CREATE
- Utelämna textfält med tomt värde (tomma strängar, null), MEN inkludera ALLTID boolean-fält, singleSelect-fält och linked-record-arrayer.
- Utelämna number-fält (*_limit) när 0/tom.`;
  }

  return `${common}

MODE: UPDATE
- Backend PATCHar records där _recordId finns, CREATEar där _recordId är null, DELETEar records som saknas från din output.
- Du MÅSTE emittera en post i sections-arrayen för VARJE sektion i input — aldrig utelämna. Backend behöver det för diffen.
- Du MÅSTE emittera en post i sectionTabs-arrayen för VARJE tab i input.
- Inkludera ALLA textfält från input (även tomma) som "" så Airtable rensar dem.
- Inkludera ALLTID country_ids och division_ids — om arrayen tömts, skicka [].
- Number-fält (*_limit): skicka null när 0/tom så Airtable rensar.
- Bevara ordningen exakt via _clientIndex.`;
}

export async function transformCmsPage(
  apiKey: string,
  state: CmsPageState,
  mode: TransformMode,
): Promise<CmsPageTransformResult> {
  const userPayload = buildCmsPagePayload(state, mode);
  const systemPrompt = buildCmsPageSystemPrompt(mode);
  const userPrompt = `Transformera denna data till Airtable-format:\n\n${userPayload}`;

  const responseText = await callClaude(apiKey, systemPrompt, userPrompt);
  const parsed = parseJsonOrThrow<CmsPageTransformResult>(responseText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returnerade oväntat format.');
  }
  if (!parsed.page || typeof parsed.page !== 'object') {
    throw new Error('Claude utelämnade page-objektet.');
  }

  // Vid UPDATE skulle en utelämnad/non-array sections silent översättas till
  // "ta bort alla sektioner" när backend diffar — vägra det. CREATE tolererar
  // tom array (inga existerande sektioner att tappa).
  if (!Array.isArray(parsed.sections)) {
    if (mode === 'update') {
      throw new Error('Claude utelämnade sections-arrayen i update-läget.');
    }
    parsed.sections = [];
  }
  if (!Array.isArray(parsed.sectionTabs)) {
    if (mode === 'update') {
      throw new Error('Claude utelämnade sectionTabs-arrayen i update-läget.');
    }
    parsed.sectionTabs = [];
  }

  // country_ids/division_ids: backfilla från state (skydd mot Claude som
  // glömmer eller returnerar non-array).
  parsed.page.country_ids = state.countryIds;
  parsed.page.division_ids = state.divisionIds;

  // internal_notes: redaktörsfält som Claude EJ ska processa (schema-MD säger
  // utelämna det). Vi skickar inte fältet i payloaden men måste backfilla det
  // i outputen så att redaktörens ändringar PATCHas till Airtable. Vid CREATE
  // räcker det också att skicka — tom sträng = ingen anteckning.
  parsed.page.internal_notes = state.internalNotes;

  return parsed;
}

// ─── Backend type-switch clearing helpers ──────────────────────────────────
//
// These are the authoritative lists of type-specific Airtable fields. Used
// by the update paths to explicitly PATCH removed fields to empty strings
// (or `false` for the one checkbox) so switching a tab from `textimage` to
// `faq` — or an LP sidebar from `case` to `event` — wipes the old data.

// Case-sidebaren har inga inline-fält längre — caset länkas via case_id
// (hanteras av /api/publish, inte stale-clearing här). Tom lista = inga
// text-fält att rensa när man byter bort från `case`.
export const LP_SIDEBAR_CASE_FIELDS: string[] = [];
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
