/**
 * Deterministiska state → Airtable-fält-transformer (ARKITEKTURPLAN FAS 2).
 *
 * Ersatte Claude-mellanlaget (tidigare `claude-transform.ts`, borttaget i FAS 2) på skrivvägen för de
 * sidtyper vars regler är deterministiska (vilket de alla är — Claude gjorde
 * bara mekanisk omdöpning/formatering). Ingen LLM, ingen latens, inget
 * tredjepartsberoende, och ingen risk att ett spar tappar innehåll.
 *
 * Mode-semantik speglar de tidigare schema-MD-reglerna exakt:
 *   CREATE — utelämna tomma textfält och tomma länk-arrayer; booleans alltid.
 *   UPDATE — skicka '' för text (rensar i Airtable), [] för länkar; booleans
 *            alltid; pseudo-array-positioner utan data skickas som '' så att
 *            borttagna items rensas.
 *
 * Det delade kontaktformuläret skrivs via `contactFormToFields` (samma 14 fält
 * som tidigare); `show_contact_form` skrivs som vanlig boolean.
 */

import { PartnerPageState, QUICK_FACT_ICON_KEYS } from './partner-types';
import {
  CaseState,
  CASE_QUICK_STATS_MAX,
  CASE_RESULTS_MAX,
  CASE_GALLERY_MAX,
} from './case-types';
import { ProductAreaState, LinkedProduct, LinkedSolution } from './product-area-types';
import { PageState, Tab } from './types';
import { CmsPageState, PageSection, TabsSection, TabItem } from './cms-page-types';
import { contactFormToFields } from './contact-form-mapper';
import { faqItemsToJson, faqItemsToLines } from './faq-block';
import { sectionToPayload } from './transform-shared';
import type { WriteMode } from './schema/to-fields';
import type {
  PaTransformResult,
  LpTransformResult,
  LpTransformTab,
  LpTransformDownload,
  CmsPageTransformResult,
  CmsPageTransformSection,
  CmsPageTransformTab,
} from './transform-shared';

type Out = Record<string, unknown>;

// ─── Mode-medvetna put-helpers ─────────────────────────────────────────────

/** Text: CREATE utelämnar tomt; UPDATE skickar '' (rensar). */
function putText(out: Out, key: string, v: unknown, mode: WriteMode): void {
  const s = v == null ? '' : String(v);
  if (mode === 'update') out[key] = s;
  else if (s !== '') out[key] = s;
}

/** Boolean: alltid med (true/false). */
function putBool(out: Out, key: string, v: unknown): void {
  out[key] = v === true;
}

/** Länk-array: CREATE utelämnar tom; UPDATE skickar [] (kan ta bort länkning). */
function putLink(out: Out, key: string, v: unknown, mode: WriteMode): void {
  const a = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  if (mode === 'update' || a.length > 0) out[key] = a;
}

/** String[]-fält → multiline (trimmar + filtrerar tomma rader). CREATE utelämnar tomt. */
function putLines(out: Out, key: string, arr: unknown, mode: WriteMode): void {
  const s = (Array.isArray(arr) ? arr : [])
    .map((x) => String(x).trim())
    .filter((x) => x !== '')
    .join('\n');
  if (mode === 'update') out[key] = s;
  else if (s !== '') out[key] = s;
}

// ─── Partner ───────────────────────────────────────────────────────────────

const PARTNER_ICONS = new Set<string>(QUICK_FACT_ICON_KEYS);

/** Quick-facts-ikon valideras mot tillåtna keys; allt annat → ''. Alltid med. */
function putIcon(out: Out, key: string, icon: unknown): void {
  const v = String(icon ?? '');
  out[key] = PARTNER_ICONS.has(v) ? v : '';
}

/** FAQ-array → JSON-spegel via det delade blocket (filtrerar tom fråga, droppar
 *  clientId). CREATE utelämnar om tom; UPDATE skickar alltid (även "[]"). */
function putFaqsJson(
  out: Out,
  key: string,
  faqs: PartnerPageState['faqs'],
  mode: WriteMode,
): void {
  const s = faqItemsToJson(faqs);
  if (mode === 'update') out[key] = s;
  else if (s !== '[]') out[key] = s;
}

export function buildPartnerFields(state: PartnerPageState, mode: WriteMode): Out {
  const out: Out = {};

  // Identity & meta
  putText(out, 'slug', state.slug, mode);
  putBool(out, 'is_active', state.isActive);
  putText(out, 'internal_notes', state.internalNotes, mode);
  putLink(out, 'partner_ids', state.partnerIds, mode);
  putLink(out, 'country_ids', state.countryIds, mode);

  // SEO
  putText(out, 'seo_title', state.seoTitle, mode);
  putText(out, 'seo_description', state.seoDescription, mode);
  putText(out, 'og_image_url', state.ogImageUrl, mode);

  // Hero
  putText(out, 'hero_eyebrow', state.heroEyebrow, mode);
  putText(out, 'h1', state.h1, mode);
  putText(out, 'hero_tagline', state.heroTagline, mode);
  putText(out, 'hero_cta_text', state.heroCtaText, mode);
  putText(out, 'hero_cta_url', state.heroCtaUrl, mode);
  putText(out, 'hero_cta2_text', state.heroCta2Text, mode);
  putText(out, 'hero_cta2_url', state.heroCta2Url, mode);
  putText(out, 'hero_image_url', state.heroImageUrl, mode);

  // Quick Facts (4 fasta slots; ikon alltid med, value/label som text)
  putBool(out, 'show_quick_facts', state.showQuickFacts);
  for (let i = 0; i < 4; i++) {
    const slot = i + 1;
    const fact = state.facts[i] ?? { icon: '', value: '', label: '' };
    putIcon(out, `facts_${slot}_icon`, fact.icon);
    putText(out, `facts_${slot}_value`, fact.value, mode);
    putText(out, `facts_${slot}_label`, fact.label, mode);
  }

  // About
  putBool(out, 'show_about', state.showAbout);
  putText(out, 'about_eyebrow', state.aboutEyebrow, mode);
  putText(out, 'about_h2', state.aboutH2, mode);
  putText(out, 'about_text', state.aboutText, mode);
  putText(out, 'about_image_url', state.aboutImageUrl, mode);
  putText(out, 'about_badge_value', state.aboutBadgeValue, mode);
  putText(out, 'about_badge_label', state.aboutBadgeLabel, mode);

  // Why Wexoe + benefits + cases
  putBool(out, 'show_why_wexoe', state.showWhyWexoe);
  putText(out, 'why_h2', state.whyH2, mode);
  putText(out, 'why_text', state.whyText, mode);
  putLines(out, 'why_benefits', state.whyBenefits, mode);
  putLink(out, 'case_ids', state.caseIds, mode);
  putText(out, 'cases_view_all_text', state.casesViewAllText, mode);
  putText(out, 'cases_view_all_url', state.casesViewAllUrl, mode);

  // Categories
  putBool(out, 'show_categories', state.showCategories);
  putText(out, 'categories_eyebrow', state.categoriesEyebrow, mode);
  putText(out, 'categories_h2', state.categoriesH2, mode);
  putText(out, 'categories_intro', state.categoriesIntro, mode);
  putLink(out, 'category_ids', state.categoryIds, mode);

  // FAQ
  putBool(out, 'show_faq', state.showFaq);
  putText(out, 'faq_h2', state.faqH2, mode);
  putFaqsJson(out, 'faqs', state.faqs, mode);

  // Contact Person
  putBool(out, 'show_contact_person', state.showContactPerson);
  putText(out, 'contact_name', state.contactName, mode);
  putText(out, 'contact_title', state.contactTitle, mode);
  putText(out, 'contact_email', state.contactEmail, mode);
  putText(out, 'contact_phone', state.contactPhone, mode);
  putText(out, 'contact_image_url', state.contactImageUrl, mode);
  putText(out, 'contact_quote', state.contactQuote, mode);

  // Contact Form (delat block)
  putBool(out, 'show_contact_form', state.showContactForm);
  Object.assign(
    out,
    contactFormToFields(state.contactForm, { schema: 'snake_case', nullForEmpty: mode === 'update', emitJson: true }),
  );

  return out;
}

// ─── Case ────────────────────────────────────────────────────────────────

/** Expanderar en pseudo-array till numrerade fält upp till `max`. Tomma
 *  positioner skrivs '' vid UPDATE (rensar borttagna items) och utelämnas
 *  vid CREATE. */
function putPseudoArray<T>(
  out: Out,
  prefix: string,
  items: T[],
  max: number,
  cols: Array<keyof T>,
  mode: WriteMode,
): void {
  for (let i = 0; i < max; i++) {
    const slot = i + 1;
    const item = items[i];
    for (const col of cols) {
      putText(out, `${prefix}_${slot}_${String(col)}`, item ? item[col] : '', mode);
    }
  }
}

export function buildCaseFields(state: CaseState, mode: WriteMode): Out {
  const out: Out = {};

  // Core (cms_partner_pages-backlänken skrivs ALDRIG)
  putText(out, 'slug', state.slug, mode);
  putText(out, 'internal_notes', state.internalNotes, mode);
  putBool(out, 'is_active', state.isActive);

  // SEO
  putText(out, 'seo_title', state.seoTitle, mode);
  putText(out, 'seo_description', state.seoDescription, mode);
  putText(out, 'og_image_url', state.ogImageUrl, mode);

  // Header (header_logos är ett lines-fält men hålls som rå sträng i state)
  putText(out, 'industry', state.industry, mode);
  putText(out, 'title', state.title, mode);
  putText(out, 'subtitle', state.subtitle, mode);
  putText(out, 'customer_name', state.customerName, mode);
  putText(out, 'location', state.location, mode);
  putText(out, 'project_year', state.projectYear, mode);
  putText(out, 'project_type', state.projectType, mode);
  putText(out, 'reading_time', state.readingTime, mode);
  putText(out, 'header_logos', state.headerLogos, mode);

  // Lead
  putText(out, 'lead_image_url', state.leadImageUrl, mode);
  putText(out, 'lead_image_caption', state.leadImageCaption, mode);
  putText(out, 'lead_paragraph', state.leadParagraph, mode);

  // Stats strip
  putBool(out, 'show_stats_strip', state.showStatsStrip);
  putPseudoArray(out, 'quick_stat', state.quickStats, CASE_QUICK_STATS_MAX, ['value', 'label'], mode);

  // Challenge (challenge_bullets = rå lines-sträng)
  putText(out, 'challenge_eyebrow', state.challengeEyebrow, mode);
  putText(out, 'challenge_title', state.challengeTitle, mode);
  putText(out, 'challenge_text', state.challengeText, mode);
  putText(out, 'challenge_bullets', state.challengeBullets, mode);
  putText(out, 'challenge_image_url', state.challengeImageUrl, mode);
  putText(out, 'challenge_image_caption', state.challengeImageCaption, mode);

  // Pullquote
  putBool(out, 'show_pullquote', state.showPullquote);
  putText(out, 'pullquote_text', state.pullquoteText, mode);
  putText(out, 'pullquote_attribution', state.pullquoteAttribution, mode);

  // Solution
  putText(out, 'solution_eyebrow', state.solutionEyebrow, mode);
  putText(out, 'solution_title', state.solutionTitle, mode);
  putText(out, 'solution_text', state.solutionText, mode);
  putText(out, 'solution_image_url', state.solutionImageUrl, mode);
  putText(out, 'solution_image_caption', state.solutionImageCaption, mode);

  // Products
  putText(out, 'products_title', state.productsTitle, mode);
  putText(out, 'products_meta', state.productsMeta, mode);
  putLink(out, 'product_ids', state.productIds, mode);
  putLink(out, 'article_ids', state.articleIds, mode);

  // Results
  putText(out, 'results_eyebrow', state.resultsEyebrow, mode);
  putText(out, 'results_title', state.resultsTitle, mode);
  putText(out, 'results_text', state.resultsText, mode);
  putPseudoArray(out, 'result', state.results, CASE_RESULTS_MAX, ['value', 'label'], mode);

  // Testimonial
  putBool(out, 'show_testimonial', state.showTestimonial);
  putText(out, 'testimonial_quote', state.testimonialQuote, mode);
  putText(out, 'testimonial_photo_url', state.testimonialPhotoUrl, mode);
  putText(out, 'testimonial_author_name', state.testimonialAuthorName, mode);
  putText(out, 'testimonial_author_title', state.testimonialAuthorTitle, mode);

  // Gallery
  putBool(out, 'show_gallery', state.showGallery);
  putText(out, 'gallery_title', state.galleryTitle, mode);
  putPseudoArray(out, 'gallery_image', state.galleryImages, CASE_GALLERY_MAX, ['url', 'caption'], mode);

  // About customer
  putBool(out, 'show_about_customer', state.showAboutCustomer);
  putText(out, 'about_customer_logo_url', state.aboutCustomerLogoUrl, mode);
  putText(out, 'about_customer_title', state.aboutCustomerTitle, mode);
  putText(out, 'about_customer_text', state.aboutCustomerText, mode);
  putText(out, 'about_customer_link_label', state.aboutCustomerLinkLabel, mode);
  putText(out, 'about_customer_url', state.aboutCustomerUrl, mode);

  // Glance sidebar
  putText(out, 'glance_challenge', state.glanceChallenge, mode);
  putText(out, 'glance_solution', state.glanceSolution, mode);
  putText(out, 'glance_result', state.glanceResult, mode);

  // Contact Form (delat block)
  putBool(out, 'show_contact_form', state.showContactForm);
  Object.assign(
    out,
    contactFormToFields(state.contactForm, { schema: 'snake_case', nullForEmpty: mode === 'update', emitJson: true }),
  );

  return out;
}

// ─── Product Area (multi-record: products + solutions) ─────────────────────
//
// Returnerar samma shape som `transformProductArea` (PaTransformResult) så att
// orchestreringen i `product-area-actions.ts` (child-record-diff, link-arrayer,
// Normal-sektioner) är oförändrad. `productArea.fields` utelämnar ALLA
// link-/section-fält + `name` — dem sätter actions-koden.

function buildPaParentFields(state: ProductAreaState, mode: WriteMode): Out {
  const o: Out = {};
  putText(o, 'slug', state.slug, mode);
  putText(o, 'h1', state.h1, mode);
  putText(o, 'top_bg', state.topBg, mode);

  putText(o, 'hero_h2', state.heroH2, mode);
  putText(o, 'hero_text', state.heroText, mode);
  putText(o, 'hero_cta_text', state.heroCtaText, mode);
  putText(o, 'hero_cta_url', state.heroCtaUrl, mode);
  putText(o, 'hero_benefits', state.heroBenefits, mode);
  putText(o, 'hero_image_url', state.heroImage, mode);
  putText(o, 'hero_bg', state.heroBg, mode);
  putText(o, 'hero_accent', state.heroAccent, mode);

  putText(o, 'npi_title', state.npiTitle, mode);
  putText(o, 'npi_description', state.npiDescription, mode);
  putText(o, 'npi_image_url', state.npiImage, mode);
  putText(o, 'npi_link', state.npiLink, mode);

  putText(o, 'toggle_bg', state.toggleBg, mode);
  putText(o, 'toggle_header_bg', state.toggleHeaderBg, mode);
  putText(o, 'toggle_accent', state.toggleAccent, mode);

  putText(o, 'solutions_title', state.solutionsTitle, mode);
  putText(o, 'solutions_bg', state.solutionsBg, mode);
  putText(o, 'solutions_card_bg', state.solutionsCardBg, mode);

  putText(o, 'contact_name', state.contactName, mode);
  putText(o, 'contact_title', state.contactTitle, mode);
  putText(o, 'contact_email', state.contactEmail, mode);
  putText(o, 'contact_phone', state.contactPhone, mode);
  putText(o, 'contact_image_url', state.contactImage, mode);
  putText(o, 'contact_text', state.contactText, mode);
  putText(o, 'contact_bg', state.contactBg, mode);

  putText(o, 'docs_title', state.docsTitle, mode);
  putText(o, 'docs_iframe', state.docsIframe, mode);
  putText(o, 'docs_bg', state.docsBg, mode);

  putBool(o, 'use_side_menu', state.sideMenu);
  putBool(o, 'show_request', state.request);
  putBool(o, 'default_open', state.defaultOpen);

  putBool(o, 'show_contact_form', state.showContactForm);
  Object.assign(
    o,
    contactFormToFields(state.contactForm, { schema: 'snake_case', nullForEmpty: mode === 'update', emitJson: true }),
  );
  return o;
}

function buildPaProductFields(p: LinkedProduct, index: number, mode: WriteMode): Out {
  const o: Out = {};
  putText(o, 'name', p.name, mode);
  putText(o, 'ecosystem_description', p.ecosystemDescription, mode);
  putText(o, 'description', p.description, mode);
  putText(o, 'bullets', p.bullets, mode);
  putText(o, 'image_url', p.image, mode);
  putText(o, 'button_1_text', p.button1Text, mode);
  putText(o, 'button_1_url', p.button1Url, mode);
  putText(o, 'button_2_text', p.button2Text, mode);
  putText(o, 'button_2_url', p.button2Url, mode);
  putText(o, 'header_side_menu', p.headerSideMenu, mode);
  putBool(o, 'horizontal', p.horizontal);
  putBool(o, 'is_active', p.visa);
  o.order = index + 1;
  return o;
}

function buildPaSolutionFields(s: LinkedSolution, index: number, mode: WriteMode): Out {
  const o: Out = {};
  putText(o, 'name', s.name, mode);
  putText(o, 'category', s.category, mode);
  putText(o, 'image_url', s.image, mode);
  putText(o, 'url', s.url, mode);
  putText(o, 'description', s.description, mode);
  putText(o, 'cta_text', s.ctaText, mode);
  putBool(o, 'is_active', s.visa);
  o.order = index + 1;
  return o;
}

export function buildProductAreaTransform(
  state: ProductAreaState,
  mode: WriteMode,
): PaTransformResult {
  return {
    productArea: buildPaParentFields(state, mode),
    products: state.products.map((p, i) => ({
      _clientIndex: i,
      _recordId: p.recordId || null,
      fields: buildPaProductFields(p, i, mode),
    })),
    solutions: state.solutions.map((s, i) => ({
      _clientIndex: i,
      _recordId: s.recordId || null,
      fields: buildPaSolutionFields(s, i, mode),
    })),
  };
}

// ─── Landing Page (multi-record: polymorfa tabs + downloads) ───────────────
//
// Returnerar samma { landingPage, tabs[], downloads[] }-shape som
// transformLandingPage (LpTransformResult). publish-routen äger child-diffing,
// landing_page_ids/tab_ids-länkning och clearsForTabType/clearsForSidebarType.

/** Computed multiline-fält: CREATE utelämnar tomt, UPDATE skickar '' (rensar). */
function putComputed(out: Out, key: string, s: string, mode: WriteMode): void {
  if (mode === 'update') out[key] = s;
  else if (s !== '') out[key] = s;
}

function compareRowsToString(rows: Tab['compareRows']): string {
  return rows
    .filter((r) => (r.label ?? '') !== '' || (r.valueA ?? '') !== '' || (r.valueB ?? '') !== '')
    .map((r) => `${r.label ?? ''} | ${r.valueA ?? ''} | ${r.valueB ?? ''}`)
    .join('\n');
}

function stepsToString(items: Tab['stepsItems']): string {
  return items
    .filter((s) => (s.title ?? '') !== '' || (s.description ?? '') !== '')
    .map((s) => `${s.title ?? ''} | ${s.description ?? ''}`)
    .join('\n');
}

function buildLpParentFields(state: PageState, mode: WriteMode): Out {
  const o: Out = {};
  putText(o, 'slug', state.slug, mode);
  putText(o, 'h1', state.h1, mode);
  putText(o, 'hero_description', state.heroDescription, mode);
  putText(o, 'hero_image_url', state.heroImage, mode);
  putText(o, 'hero_cta_text', state.heroCta1Text, mode);
  putText(o, 'hero_cta_url', state.heroCta1Url, mode);
  putText(o, 'hero_cta2_text', state.heroCta2Text, mode);
  putText(o, 'hero_cta2_url', state.heroCta2Url, mode);
  putText(o, 'content_h2', state.contentH2, mode);
  putText(o, 'content_text', state.contentText, mode);
  putText(o, 'content_benefits', state.contentBenefits, mode);

  // sidebar_type är singleSelect → tom sträng skulle skapa ogiltig option.
  // Sätt värdet om valt; rensa med null vid UPDATE; utelämna vid CREATE.
  if (state.sidebarType) o['sidebar_type'] = state.sidebarType;
  else if (mode === 'update') o['sidebar_type'] = null;

  putText(o, 'contact_name', state.contactName, mode);
  putText(o, 'contact_title', state.contactTitle, mode);
  putText(o, 'contact_email', state.contactEmail, mode);
  putText(o, 'contact_phone', state.contactPhone, mode);
  putText(o, 'contact_image_url', state.contactImage, mode);
  putText(o, 'contact_quote', state.contactQuote, mode);
  putText(o, 'color_main', state.colorMain, mode);
  putText(o, 'color_secondary', state.colorSecondary, mode);

  putBool(o, 'show_content', state.showContent);
  putBool(o, 'show_sidebar', state.showSidebar);
  putBool(o, 'show_tabs', state.showTabs);
  putBool(o, 'show_contact', state.showContact);

  // Sidebar — endast aktiv typ (routen rensar övriga via clearsForSidebarType).
  switch (state.sidebarType) {
    case 'case':
      putText(o, 'case_title', state.caseTitle, mode);
      putText(o, 'case_description', state.caseDescription, mode);
      putText(o, 'case_image_url', state.caseImage, mode);
      putText(o, 'case_outcomes', state.caseOutcomes, mode);
      putText(o, 'case_cta_text', state.caseCta, mode);
      putText(o, 'case_cta_url', state.caseCtaUrl, mode);
      break;
    case 'event':
      putText(o, 'event_type', state.eventType, mode);
      putText(o, 'event_title', state.eventTitle, mode);
      putText(o, 'event_description', state.eventDescription, mode);
      putText(o, 'event_date', state.eventDate, mode);
      putText(o, 'event_location', state.eventLocation, mode);
      putText(o, 'event_webhook', state.eventWebhook, mode);
      break;
    case 'leadmagnet':
      putText(o, 'magnet_title', state.magnetTitle, mode);
      putText(o, 'magnet_format', state.magnetFormat, mode);
      putText(o, 'magnet_description', state.magnetDescription, mode);
      putText(o, 'magnet_file_url', state.magnetFileUrl, mode);
      putText(o, 'magnet_webhook', state.magnetWebhook, mode);
      break;
    case 'calculator':
      putText(o, 'calc_title', state.calcTitle, mode);
      putText(o, 'calc_html', state.calcHtml, mode);
      break;
  }

  putBool(o, 'show_contact_form', state.showContactForm);
  Object.assign(
    o,
    contactFormToFields(state.contactForm, { schema: 'snake_case', nullForEmpty: mode === 'update', emitJson: true }),
  );
  return o;
}

function buildLpTabFields(tab: Tab, index: number, mode: WriteMode): Out {
  // name/tab_type/order/is_active måste alltid finnas (backend korrelerar på dem).
  const o: Out = { name: tab.name ?? '', tab_type: tab.type, order: index + 1, is_active: true };
  switch (tab.type) {
    case 'textimage':
      putText(o, 'ti_h2', tab.tiH2, mode);
      putText(o, 'ti_text', tab.tiText, mode);
      putText(o, 'ti_benefits', tab.tiBenefits, mode);
      putText(o, 'ti_image_url', tab.tiImage, mode);
      putBool(o, 'ti_inverted', tab.tiInverted);
      break;
    case 'fullmedia':
      putText(o, 'fm_url', tab.fmUrl, mode);
      break;
    case 'faq':
      putComputed(o, 'faq_items', faqItemsToLines(tab.faqItems), mode);
      break;
    case 'calameo':
      putText(o, 'calameo_1_title', tab.calTitle1, mode);
      putText(o, 'calameo_1_src', tab.calUrl1, mode);
      putText(o, 'calameo_2_title', tab.calTitle2, mode);
      putText(o, 'calameo_2_src', tab.calUrl2, mode);
      putText(o, 'calameo_3_title', tab.calTitle3, mode);
      putText(o, 'calameo_3_src', tab.calUrl3, mode);
      break;
    case 'compare':
      putText(o, 'compare_title', tab.compareTitle, mode);
      putText(o, 'compare_col_a', tab.compareColA, mode);
      putText(o, 'compare_col_b', tab.compareColB, mode);
      putComputed(o, 'compare_rows', compareRowsToString(tab.compareRows), mode);
      break;
    case 'steps':
      putText(o, 'steps_title', tab.stepsTitle, mode);
      putComputed(o, 'steps', stepsToString(tab.stepsItems), mode);
      break;
    case 'downloads':
      // Inga tab-fält — downloads är separata records (se nedan).
      break;
  }
  return o;
}

export function buildLandingTransform(state: PageState, mode: WriteMode): LpTransformResult {
  const tabs: LpTransformTab[] = state.tabs.map((tab, i) => ({
    _clientIndex: i,
    _recordId: tab.recordId ?? null,
    fields: buildLpTabFields(tab, i, mode),
  }));

  const downloads: LpTransformDownload[] = [];
  state.tabs.forEach((tab, tabIndex) => {
    if (tab.type !== 'downloads') return;
    tab.downloads.forEach((dl, dlIndex) => {
      const fields: Out = { order: dlIndex + 1, is_active: true };
      putText(fields, 'name', dl.name, mode);
      putText(fields, 'description', dl.description, mode);
      putText(fields, 'file_url', dl.fileUrl, mode);
      putText(fields, 'button_text', dl.fileType, mode);
      downloads.push({
        _clientIndex: dlIndex,
        _tabClientIndex: tabIndex,
        _recordId: dl.recordId ?? null,
        fields,
      });
    });
  });

  return { landingPage: buildLpParentFields(state, mode), tabs, downloads };
}

// ─── CMS Page (multi-record: 15 polymorfa sektioner + section-tabs) ────────
//
// Återanvänder sectionToPayload (samma snake_case-fältmappning som tidigare)
// och applicerar deterministisk mode-semantik per värdetyp. Routen
// (cms-page-actions.ts) äger section/section-tab-diffing + section_ids/
// tabs_tab_ids-länkning. Ingen section_type-switch-clearing behövs — PHP-
// renderaren branchar på section_type och ignorerar stale fält.

/** Sektion-/tab-fält efter värdetyp: bool→alltid, array→link (create utelämnar
 *  tom), number (*_limit)→ >0 ? number : (update ? null), sträng→text. */
function emitField(out: Out, key: string, value: unknown, mode: WriteMode): void {
  if (typeof value === 'boolean') {
    out[key] = value;
  } else if (Array.isArray(value)) {
    const a = value.filter((x): x is string => typeof x === 'string');
    if (mode === 'update' || a.length > 0) out[key] = a;
  } else if (typeof value === 'number') {
    if (value > 0) out[key] = value;
    else if (mode === 'update') out[key] = null;
  } else {
    const s = value == null ? '' : String(value);
    if (mode === 'update') out[key] = s;
    else if (s !== '') out[key] = s;
  }
}

function buildCmsSectionFields(sec: PageSection, index: number, mode: WriteMode): Record<string, unknown> {
  const payload = sectionToPayload(sec, index) ?? {};
  const fields: Record<string, unknown> = { section_type: sec.type, order: index + 1 };
  for (const [key, value] of Object.entries(payload)) {
    // _clientIndex/_recordId hör till wrappern; `type` → section_type (satt ovan).
    if (key === '_clientIndex' || key === '_recordId' || key === 'type') continue;
    emitField(fields, key, value, mode);
  }
  return fields;
}

function buildCmsTabFields(tab: TabItem, index: number, mode: WriteMode): Record<string, unknown> {
  // name/order/is_active måste alltid finnas (backend korrelerar på dem).
  const o: Record<string, unknown> = { name: tab.name ?? '', order: index + 1, is_active: tab.isActive === true };
  putText(o, 'eyebrow', tab.eyebrow, mode);
  putText(o, 'h2', tab.h2, mode);
  putText(o, 'body', tab.body, mode);
  putText(o, 'bullets', tab.bullets, mode);
  putText(o, 'image_url', tab.imageUrl, mode);
  putText(o, 'image_alt', tab.imageAlt, mode);
  putText(o, 'cta_text', tab.ctaText, mode);
  putText(o, 'cta_url', tab.ctaUrl, mode);
  putText(o, 'cta2_text', tab.cta2Text, mode);
  putText(o, 'cta2_url', tab.cta2Url, mode);
  return o;
}

export function buildCmsPageTransform(state: CmsPageState, mode: WriteMode): CmsPageTransformResult {
  // Page-fält. section_ids sätts av routen; country/division/internal_notes
  // skickas alltid (även [] / '') — speglar tidigare backfill i transformCmsPage.
  const page: Record<string, unknown> = {};
  putText(page, 'slug', state.slug, mode);
  putText(page, 'internal_label', state.internalLabel, mode);
  putText(page, 'h1', state.h1, mode);
  putText(page, 'seo_title', state.seoTitle, mode);
  putText(page, 'seo_description', state.seoDescription, mode);
  putText(page, 'og_image_url', state.ogImageUrl, mode);
  putBool(page, 'is_published', state.isPublished);
  putText(page, 'page_theme', state.pageTheme, mode);
  putText(page, 'max_width', state.maxWidth, mode);
  page.country_ids = state.countryIds;
  page.division_ids = state.divisionIds;
  page.internal_notes = state.internalNotes;

  const sections: CmsPageTransformSection[] = state.sections.map((sec, i) => ({
    _clientIndex: i,
    _recordId: sec.recordId || null,
    fields: buildCmsSectionFields(sec, i, mode),
  }));

  const sectionTabs: CmsPageTransformTab[] = [];
  state.sections.forEach((sec, sectionIndex) => {
    if (sec.type !== 'tabs') return;
    (sec as TabsSection).tabs.forEach((tab, tabIndex) => {
      sectionTabs.push({
        _clientIndex: tabIndex,
        _sectionClientIndex: sectionIndex,
        _recordId: tab.recordId || null,
        fields: buildCmsTabFields(tab, tabIndex, mode),
      });
    });
  });

  return { page, sections, sectionTabs };
}
