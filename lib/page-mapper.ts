/**
 * Reverse mapping from Airtable records → PageState, used by the editor to
 * hydrate the builder when editing an existing Landing Page.
 *
 * Forward mapping (state → Airtable fields) now lives entirely in Claude
 * via `lib/claude-transform.ts` — there are no deterministic forward
 * mappers in this file anymore.
 */

import {
  PageState,
  Tab,
  TabType,
  SidebarType,
  FaqItem,
  CompareRow,
  StepItem,
} from './types';
import { createEmptyTab, initialState } from './state';
import { AirtableRecord } from './airtable';
import { ContactFormState } from './contact-form-types';
import { str, bool, num, linkedIds } from './airtable-helpers';
import {
  contactFormFromFields,
  contactFormToFields as sharedContactFormToFields,
} from './contact-form-mapper';

// ─── Forward: PageState → Landing Pages fields ─────────────────────────────

// ─── Reverse: Airtable record → PageState ──────────────────────────────────

const TAB_TYPES: TabType[] = ['textimage', 'fullmedia', 'faq', 'calameo', 'downloads', 'compare', 'steps'];
const SIDEBAR_TYPES: SidebarType[] = ['', 'case', 'calculator', 'event', 'leadmagnet'];

function parseFaqItems(text: string): FaqItem[] {
  if (!text.trim()) return [];
  const items: FaqItem[] = [];
  // Split on blank lines, then parse each block
  const blocks = text.split(/\n\s*\n/);
  let counter = 0;
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let question = '';
    let answer = '';
    for (const line of lines) {
      if (/^Q:\s*/i.test(line)) {
        question = line.replace(/^Q:\s*/i, '').trim();
      } else if (/^A:\s*/i.test(line)) {
        answer = line.replace(/^A:\s*/i, '').trim();
      } else if (answer) {
        answer += '\n' + line;
      } else if (question) {
        question += ' ' + line;
      }
    }
    if (question || answer) {
      items.push({ id: `faq-load-${counter++}`, question, answer });
    }
  }
  return items;
}

function parseCompareRows(text: string): CompareRow[] {
  if (!text.trim()) return [];
  const rows: CompareRow[] = [];
  let counter = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|').map((p) => p.trim());
    rows.push({
      id: `cmp-load-${counter++}`,
      label: parts[0] || '',
      valueA: parts[1] || '',
      valueB: parts[2] || '',
    });
  }
  return rows;
}

function parseSteps(text: string): StepItem[] {
  if (!text.trim()) return [];
  const items: StepItem[] = [];
  let counter = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|').map((p) => p.trim());
    items.push({
      id: `step-load-${counter++}`,
      title: parts[0] || '',
      description: parts[1] || '',
    });
  }
  return items;
}

function tabFromRecord(record: AirtableRecord, downloads: AirtableRecord[]): Tab {
  const f = record.fields;
  const rawType = str(f, 'tab_type');
  const type: TabType = (TAB_TYPES as string[]).includes(rawType) ? (rawType as TabType) : 'textimage';

  const tab: Tab = {
    ...createEmptyTab(),
    recordId: record.id,
    name: str(f, 'name'),
    type,
    tiH2: str(f, 'ti_h2'),
    tiText: str(f, 'ti_text'),
    tiBenefits: str(f, 'ti_benefits'),
    tiImage: str(f, 'ti_image_url'),
    tiInverted: bool(f, 'ti_inverted'),
    fmUrl: str(f, 'fm_url'),
    faqItems: parseFaqItems(str(f, 'faq_items')),
    calTitle1: str(f, 'calameo_1_title'),
    calUrl1: str(f, 'calameo_1_src'),
    calTitle2: str(f, 'calameo_2_title'),
    calUrl2: str(f, 'calameo_2_src'),
    calTitle3: str(f, 'calameo_3_title'),
    calUrl3: str(f, 'calameo_3_src'),
    downloads: downloads
      .slice()
      .sort((a, b) => num(a.fields, 'order') - num(b.fields, 'order'))
      .map((d, i) => ({
        id: `dl-load-${record.id}-${i}`,
        recordId: d.id,
        name: str(d.fields, 'name'),
        description: str(d.fields, 'description'),
        fileUrl: str(d.fields, 'file_url'),
        fileType: str(d.fields, 'button_text'),
      })),
    compareTitle: str(f, 'compare_title'),
    compareColA: str(f, 'compare_col_a') || 'Alternativ A',
    compareColB: str(f, 'compare_col_b') || 'Alternativ B',
    compareRows: parseCompareRows(str(f, 'compare_rows')),
    stepsTitle: str(f, 'steps_title'),
    stepsItems: parseSteps(str(f, 'steps')),
  };

  return tab;
}

/**
 * Build a complete PageState from an LP record + its linked tabs + each tab's
 * linked downloads. Caller is responsible for fetching all three.
 */
export function pageStateFromRecords(args: {
  landingPage: AirtableRecord;
  tabs: AirtableRecord[];
  downloadsByTabId: Record<string, AirtableRecord[]>;
}): PageState {
  const { landingPage, tabs, downloadsByTabId } = args;
  const f = landingPage.fields;

  const sortedTabs = tabs
    .slice()
    .sort((a, b) => num(a.fields, 'order') - num(b.fields, 'order'));

  const rawSidebar = str(f, 'sidebar_type');
  const sidebarType: SidebarType = (SIDEBAR_TYPES as string[]).includes(rawSidebar)
    ? (rawSidebar as SidebarType)
    : '';

  return {
    ...initialState,
    mode: 'edit',
    recordId: landingPage.id,
    slug: str(f, 'slug'),

    h1: str(f, 'h1'),
    heroDescription: str(f, 'hero_description'),
    heroImage: str(f, 'hero_image_url'),
    heroCta1Text: str(f, 'hero_cta_text') || 'Kontakta oss',
    heroCta1Url: str(f, 'hero_cta_url') || '/kontakt/',
    heroCta2Text: str(f, 'hero_cta2_text'),
    heroCta2Url: str(f, 'hero_cta2_url'),

    contentH2: str(f, 'content_h2'),
    contentText: str(f, 'content_text'),
    contentBenefits: str(f, 'content_benefits'),

    sidebarType,
    caseId: linkedIds(f, 'case_id')[0] ?? '',
    eventType: str(f, 'event_type'),
    eventTitle: str(f, 'event_title'),
    eventDescription: str(f, 'event_description'),
    eventDate: str(f, 'event_date'),
    eventLocation: str(f, 'event_location'),
    eventWebhook: str(f, 'event_webhook'),
    magnetTitle: str(f, 'magnet_title'),
    magnetFormat: str(f, 'magnet_format'),
    magnetDescription: str(f, 'magnet_description'),
    magnetFileUrl: str(f, 'magnet_file_url'),
    magnetWebhook: str(f, 'magnet_webhook'),
    calcTitle: str(f, 'calc_title'),
    calcHtml: str(f, 'calc_html'),

    tabs: sortedTabs.map((t) => tabFromRecord(t, downloadsByTabId[t.id] ?? [])),

    contactName: str(f, 'contact_name'),
    contactTitle: str(f, 'contact_title'),
    contactEmail: str(f, 'contact_email'),
    contactPhone: str(f, 'contact_phone'),
    contactImage: str(f, 'contact_image_url'),
    contactQuote: str(f, 'contact_quote'),

    showContent: bool(f, 'show_content', true),
    showSidebar: bool(f, 'show_sidebar', true),
    showTabs: bool(f, 'show_tabs', true),
    showContact: bool(f, 'show_contact', true),

    colorMain: str(f, 'color_main') || '#11325D',
    colorSecondary: str(f, 'color_secondary') || '#F28C28',

    showContactForm: bool(f, 'show_contact_form', false),
    contactForm: contactFormFromRecord(landingPage),
  };
}

/**
 * Hämta ContactFormState från ett Airtable-record vars fält följer
 * `contact_form_*`-konventionen.
 * Landing Page behåller Claude som backend-translator; den här helpern
 * normaliserar bara reverse-load från Airtable till builder-state.
 */
export function contactFormFromRecord(record: AirtableRecord): ContactFormState {
  return contactFormFromFields(record.fields, 'snake_case');
}

/**
 * Konvertera ContactFormState till Airtable-fält-map för legacy-callers.
 * Tomma textfält skrivs inte i create-payloaden, precis som tidigare.
 */
export function contactFormToFields(
  showContactForm: boolean,
  state: ContactFormState,
): Record<string, unknown> {
  const fields = {
    show_contact_form: showContactForm,
    ...sharedContactFormToFields(state, { schema: 'snake_case', nullForEmpty: true }),
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
