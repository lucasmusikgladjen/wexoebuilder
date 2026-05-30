/**
 * Reverse mapping from Airtable records → ProductAreaState, used by the
 * loader to hydrate the builder when editing an existing Product Area.
 *
 * Forward mapping (state → Airtable fields) lives in the deterministic write
 * path (`buildProductAreaTransform` in `lib/deterministic-transform.ts`); this
 * file holds only the reverse `fromRecord` direction.
 *
 * Post-migration: PA-familjen ligger i Wexoe NY (cms_product_pages +
 * cms_product_page_sections + cms_products + cms_solutions_mini). Alla
 * fältnamn är snake_case. PA_BASE_ID är nu alias till BASE_ID; konstanten
 * lever kvar så att kallar-koden inte behöver röras när vi flippade.
 */

import {
  ProductAreaState,
  NormalSection,
  LinkedProduct,
  LinkedSolution,
  LinkedArticleReadonly,
  generateClientId,
} from './product-area-types';
import { AirtableRecord, BASE_ID } from './airtable';
import { str, bool, num } from './airtable-helpers';
import { contactFormFromFields } from './contact-form-mapper';

// ─── Table IDs (Product Area family) ───────────────────────────────────────
//
// Alla PA-tabeller ligger nu i Wexoe NY (samma som global BASE_ID). De fyra
// `Normal 1-4`-pseudo-array-fälten har lyfts ut till sub-records i
// cms_product_page_sections; PA-recordet pekar på dem via `section_ids`.

export const PA_BASE_ID = BASE_ID;

export const PA_TABLE_IDS = {
  productAreas: 'tbl5PQR7FNHCogeya',       // cms_product_pages
  productPageSections: 'tbl1r3T3ukIPJ0S3N', // cms_product_page_sections (NEW)
  products: 'tblN23V7uAMpeZoO1',            // cms_products
  articles: 'tblhnz3MQG1JwfKrN',            // cms_articles
  solutions: 'tblxK7ikOgLFuze6m',           // cms_solutions_mini
  divisions: 'tblyxs2zsoRBozxQS',           // core_divisions
} as const;

// ─── Reverse: Airtable → state ─────────────────────────────────────────────

function sectionFromRecord(r: AirtableRecord): NormalSection {
  const f = r.fields;
  const bullets = f['bullets'];
  return {
    h2: str(f, 'h2'),
    text: str(f, 'text'),
    bullets: Array.isArray(bullets) ? bullets.join('\n') : str(f, 'bullets'),
    image: str(f, 'image_url'),
    reversed: bool(f, 'reversed'),
    bg: str(f, 'bg'),
    upp: bool(f, 'shown_top'),
  };
}

function articleFromRecord(r: AirtableRecord): LinkedArticleReadonly {
  return {
    recordId: r.id,
    name: str(r.fields, 'name'),
    artikelnummer: str(r.fields, 'article_number'),
    description: str(r.fields, 'description'),
    bild: str(r.fields, 'image_url'),
    datablad: str(r.fields, 'datasheet_url'),
    lankTillWebshop: str(r.fields, 'webshop_url'),
    varianter: str(r.fields, 'variants'),
  };
}

function productFromRecord(
  r: AirtableRecord,
  articlesById: Record<string, AirtableRecord>,
): LinkedProduct {
  const articleIds = (r.fields['article_ids'] as string[] | undefined) ?? [];
  const articles = articleIds
    .map((id) => articlesById[id])
    .filter((rec): rec is AirtableRecord => !!rec)
    .map(articleFromRecord);

  return {
    clientId: generateClientId('loaded-product'),
    recordId: r.id,
    name: str(r.fields, 'name'),
    headerSideMenu: str(r.fields, 'header_side_menu'),
    description: str(r.fields, 'description'),
    ecosystemDescription: str(r.fields, 'ecosystem_description'),
    bullets: str(r.fields, 'bullets'),
    image: str(r.fields, 'image_url'),
    button1Text: str(r.fields, 'button_1_text'),
    button1Url: str(r.fields, 'button_1_url'),
    button2Text: str(r.fields, 'button_2_text'),
    button2Url: str(r.fields, 'button_2_url'),
    horizontal: bool(r.fields, 'horizontal'),
    order: num(r.fields, 'order'),
    visa: bool(r.fields, 'is_active'),
    articles,
  };
}

function solutionFromRecord(r: AirtableRecord): LinkedSolution {
  return {
    clientId: generateClientId('loaded-solution'),
    recordId: r.id,
    name: str(r.fields, 'name'),
    image: str(r.fields, 'image_url'),
    url: str(r.fields, 'url'),
    description: str(r.fields, 'description'),
    category: str(r.fields, 'category'),
    ctaText: str(r.fields, 'cta_text'),
    order: num(r.fields, 'order'),
    visa: bool(r.fields, 'is_active'),
  };
}

export function productAreaStateFromRecords(args: {
  productArea: AirtableRecord;
  products: AirtableRecord[];
  articles: AirtableRecord[];
  solutions: AirtableRecord[];
  sections: AirtableRecord[];
}): ProductAreaState {
  const { productArea, products, articles, solutions, sections } = args;
  const f = productArea.fields;

  const articlesById: Record<string, AirtableRecord> = {};
  for (const a of articles) articlesById[a.id] = a;

  // Preserve the order of the linked product_ids field so editing matches
  // what renders on the page.
  const productLinkOrder = (f['product_ids'] as string[] | undefined) ?? [];
  const productsById: Record<string, AirtableRecord> = {};
  for (const p of products) productsById[p.id] = p;

  const orderedProducts = productLinkOrder
    .map((id) => productsById[id])
    .filter((r): r is AirtableRecord => !!r)
    .map((r) => productFromRecord(r, articlesById));

  const solutionLinkOrder = (f['solution_ids'] as string[] | undefined) ?? [];
  const solutionsById: Record<string, AirtableRecord> = {};
  for (const s of solutions) solutionsById[s.id] = s;

  const orderedSolutions = solutionLinkOrder
    .map((id) => solutionsById[id])
    .filter((r): r is AirtableRecord => !!r)
    .map(solutionFromRecord);

  // Sektioner sorteras på 'order'-fältet; renderaren fyller in upp till 4 i
  // PA-state:s Normal 1-4-slot. Saknade slots blir tom NormalSection.
  const sortedSections = sections
    .slice()
    .sort((a, b) => num(a.fields, 'order') - num(b.fields, 'order'));
  const emptySection: NormalSection = {
    h2: '', text: '', bullets: '', image: '', reversed: false, bg: '', upp: false,
  };
  const normalSlots: NormalSection[] = [0, 1, 2, 3].map((i) =>
    sortedSections[i] ? sectionFromRecord(sortedSections[i]) : { ...emptySection },
  );

  return {
    mode: 'edit',
    recordId: productArea.id,
    slug: str(f, 'slug'),

    h1: str(f, 'h1'),
    topBg: str(f, 'top_bg'),

    heroH2: str(f, 'hero_h2'),
    heroText: str(f, 'hero_text'),
    heroCtaText: str(f, 'hero_cta_text'),
    heroCtaUrl: str(f, 'hero_cta_url'),
    heroBenefits: str(f, 'hero_benefits'),
    heroImage: str(f, 'hero_image_url'),
    heroBg: str(f, 'hero_bg'),
    heroAccent: str(f, 'hero_accent'),

    npiTitle: str(f, 'npi_title'),
    npiDescription: str(f, 'npi_description'),
    npiImage: str(f, 'npi_image_url'),
    npiLink: str(f, 'npi_link'),

    toggleBg: str(f, 'toggle_bg'),
    toggleHeaderBg: str(f, 'toggle_header_bg'),
    toggleAccent: str(f, 'toggle_accent'),

    solutionsTitle: str(f, 'solutions_title'),
    solutionsBg: str(f, 'solutions_bg'),
    solutionsCardBg: str(f, 'solutions_card_bg'),

    normal1: normalSlots[0],
    normal2: normalSlots[1],
    normal3: normalSlots[2],
    normal4: normalSlots[3],

    contactName: str(f, 'contact_name'),
    contactTitle: str(f, 'contact_title'),
    contactEmail: str(f, 'contact_email'),
    contactPhone: str(f, 'contact_phone'),
    contactImage: str(f, 'contact_image_url'),
    contactText: str(f, 'contact_text'),
    contactBg: str(f, 'contact_bg'),

    docsTitle: str(f, 'docs_title'),
    docsIframe: str(f, 'docs_iframe'),
    docsBg: str(f, 'docs_bg'),

    sideMenu: bool(f, 'use_side_menu'),
    request: bool(f, 'show_request'),
    defaultOpen: bool(f, 'default_open'),

    products: orderedProducts,
    solutions: orderedSolutions,

    division: ((f['division_ids'] as string[] | undefined) ?? []).slice(),

    // show*-flaggor persisteras inte i Airtable — defaulta till "på" om
    // sektionen har innehåll, annars "av". Speglar legacy ProductAreaBuilder:s
    // visibility-state.
    showContent: normalSlots.some((sec) => sec.h2.trim() || sec.text.trim()),
    showProducts: orderedProducts.length > 0,
    showSolutions: orderedSolutions.length > 0,
    showContact: !!str(f, 'contact_name').trim(),

    showContactForm: bool(f, 'show_contact_form'),
    contactForm: contactFormFromFields(productArea.fields, 'snake_case'),
  };
}
