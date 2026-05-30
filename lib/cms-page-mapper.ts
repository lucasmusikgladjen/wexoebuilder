/**
 * Mappning Airtable-record → CmsPageState.
 *
 * Polymorf: en cms_page_sections-record har section_type som diskriminator;
 * vi byggar rätt PageSection-variant och plockar bara typens prefixerade fält.
 *
 * Tabs-sektioner laddar sina cms_section_tabs-records via tabs_tab_ids;
 * loadern (cms-page-loader.ts) hämtar dem och passar in via TabsByParent-mappen.
 */

import { AirtableRecord } from './airtable';
import { asString, asNumber, asBool, asLinkIds } from './airtable-helpers';
import { faqItemsFromStored } from './faq-block';
import {
  BaseSection,
  CmsPageState,
  CompanyDataStripSection,
  ContactFormSection,
  CtaBannerSection,
  CaseGridSection,
  CatalogSection,
  emptyCmsPageState,
  FaqSection,
  GridCols,
  HeroSection,
  Layout,
  MaxWidth,
  NewsGridSection,
  NewsTextSplitSection,
  PageSection,
  PageTheme,
  Padding,
  PartnerListSection,
  PlVariant,
  SectionTheme,
  SectionType,
  TabItem,
  TabsSection,
  TextAlign,
  TextImageSection,
  TextOnlySection,
  TeamGridSection,
  TestimonialSection,
  TgVariant,
  CfLayout,
  generateClientId,
} from './cms-page-types';

// ─── Singleselect-cast-helpers ────────────────────────────────────────────

function asPageTheme(v: unknown): PageTheme {
  return v === 'dark' ? 'dark' : 'light';
}
function asSectionTheme(v: unknown): SectionTheme {
  if (v === 'dark') return 'dark';
  if (v === 'light') return 'light';
  return 'inherit';
}
function asMaxWidth(v: unknown): MaxWidth {
  if (v === 'narrow' || v === 'normal' || v === 'wide' || v === 'full') return v;
  return 'normal';
}
function asLayout(v: unknown): Layout {
  if (v === 'contained' || v === 'full_bleed' || v === 'narrow') return v;
  return 'contained';
}
function asPadding(v: unknown): Padding {
  if (v === 'none' || v === 'sm' || v === 'md' || v === 'lg') return v;
  return 'md';
}
function asTextAlign(v: unknown): TextAlign {
  return v === 'center' ? 'center' : 'left';
}
function asGridCols(v: unknown): GridCols {
  if (v === '2' || v === '3' || v === '4') return v;
  return '3';
}
function asTgVariant(v: unknown): TgVariant {
  if (v === 'rack' || v === 'compact') return v;
  return 'cards';
}
function asPlVariant(v: unknown): PlVariant {
  if (v === 'marquee' || v === 'list') return v;
  return 'grid';
}
function asCfLayout(v: unknown): CfLayout {
  return v === 'centered' ? 'centered' : 'split';
}
function asSectionType(v: unknown): SectionType | null {
  const known: SectionType[] = [
    'hero', 'text_image', 'text_only', 'company_data_strip',
    'news_text_split', 'case_grid', 'news_grid', 'catalog',
    'tabs', 'team_grid', 'partner_list', 'faq',
    'testimonial', 'cta_banner', 'contact_form',
  ];
  if (typeof v === 'string' && (known as string[]).includes(v)) return v as SectionType;
  return null;
}

// ─── Tab-record → TabItem ─────────────────────────────────────────────────

export function tabItemFromRecord(rec: AirtableRecord): TabItem {
  const f = rec.fields;
  return {
    clientId: generateClientId('tab'),
    recordId: rec.id,
    name: asString(f['name']),
    internalNotes: asString(f['internal_notes']),
    isActive: asBool(f['is_active'], true),
    eyebrow: asString(f['eyebrow']),
    h2: asString(f['h2']),
    body: asString(f['body']),
    bullets: asString(f['bullets']),
    imageUrl: asString(f['image_url']),
    imageAlt: asString(f['image_alt']),
    ctaText: asString(f['cta_text']),
    ctaUrl: asString(f['cta_url']),
    cta2Text: asString(f['cta2_text']),
    cta2Url: asString(f['cta2_url']),
  };
}

// ─── Section-record → PageSection (polymorf) ─────────────────────────────

function baseFromRecord(rec: AirtableRecord, type: SectionType): BaseSection {
  const f = rec.fields;
  return {
    clientId: generateClientId(`section-${type}`),
    recordId: rec.id,
    type,
    internalLabel: asString(f['internal_label']),
    internalNotes: asString(f['internal_notes']),
    isActive: asBool(f['is_active'], true),
    anchorId: asString(f['anchor_id']),
    layout: asLayout(f['layout']),
    theme: asSectionTheme(f['theme']),
    topPadding: asPadding(f['top_padding']),
    bottomPadding: asPadding(f['bottom_padding']),
  };
}

/**
 * Bygg PageSection från record. tabsByParent används bara för tabs-sektioner;
 * en map från section.id → TabItem[] (hämtas via loader.ts från
 * cms_section_tabs där tabs_tab_ids matchar).
 */
export function sectionFromRecord(
  rec: AirtableRecord,
  tabsByParent: Map<string, TabItem[]>,
): PageSection | null {
  const f = rec.fields;
  const type = asSectionType(f['section_type']);
  if (type === null) return null;

  const base = baseFromRecord(rec, type);

  switch (type) {
    case 'hero': {
      const sec: HeroSection = {
        ...base, type: 'hero',
        eyebrow: asString(f['hero_eyebrow']),
        h1: asString(f['hero_h1']),
        subtitle: asString(f['hero_subtitle']),
        imageUrl: asString(f['hero_image_url']),
        ctaText: asString(f['hero_cta_text']),
        ctaUrl: asString(f['hero_cta_url']),
        cta2Text: asString(f['hero_cta2_text']),
        cta2Url: asString(f['hero_cta2_url']),
      };
      return sec;
    }
    case 'text_image': {
      const sec: TextImageSection = {
        ...base, type: 'text_image',
        eyebrow: asString(f['ti_eyebrow']),
        h2: asString(f['ti_h2']),
        body: asString(f['ti_body']),
        bullets: asString(f['ti_bullets']),
        imageUrl: asString(f['ti_image_url']),
        imageAlt: asString(f['ti_image_alt']),
        reversed: asBool(f['ti_reversed']),
        ctaText: asString(f['ti_cta_text']),
        ctaUrl: asString(f['ti_cta_url']),
        cta2Text: asString(f['ti_cta2_text']),
        cta2Url: asString(f['ti_cta2_url']),
      };
      return sec;
    }
    case 'text_only': {
      const sec: TextOnlySection = {
        ...base, type: 'text_only',
        eyebrow: asString(f['to_eyebrow']),
        h2: asString(f['to_h2']),
        body: asString(f['to_body']),
        align: asTextAlign(f['to_align']),
      };
      return sec;
    }
    case 'company_data_strip': {
      const sec: CompanyDataStripSection = {
        ...base, type: 'company_data_strip',
        h2: asString(f['cds_h2']),
        useCompanySingleton: asBool(f['cds_use_company_singleton']),
        countryCode: asString(f['cds_country_code']),
        items: asString(f['cds_items']),
      };
      return sec;
    }
    case 'news_text_split': {
      const sec: NewsTextSplitSection = {
        ...base, type: 'news_text_split',
        eyebrow: asString(f['nts_eyebrow']),
        h2: asString(f['nts_h2']),
        body: asString(f['nts_body']),
        ctaText: asString(f['nts_cta_text']),
        ctaUrl: asString(f['nts_cta_url']),
        newsManualIds: asLinkIds(f['nts_news_manual_ids']),
        scopeDivision: asString(f['nts_scope_division']),
        scopeCountry: asString(f['nts_scope_country']),
        limit: asNumber(f['nts_limit']),
      };
      return sec;
    }
    case 'case_grid': {
      const sec: CaseGridSection = {
        ...base, type: 'case_grid',
        eyebrow: asString(f['cg_eyebrow']),
        h2: asString(f['cg_h2']),
        body: asString(f['cg_body']),
        caseManualIds: asLinkIds(f['cg_case_manual_ids']),
        scopeCountry: asString(f['cg_scope_country']),
        scopeDivision: asString(f['cg_scope_division']),
        scopeCustomerType: asString(f['cg_scope_customer_type']),
        limit: asNumber(f['cg_limit']),
        columns: asGridCols(f['cg_columns']),
      };
      return sec;
    }
    case 'news_grid': {
      const sec: NewsGridSection = {
        ...base, type: 'news_grid',
        eyebrow: asString(f['ng_eyebrow']),
        h2: asString(f['ng_h2']),
        articleManualIds: asLinkIds(f['ng_article_manual_ids']),
        scopeCountry: asString(f['ng_scope_country']),
        scopeDivision: asString(f['ng_scope_division']),
        scopeTopic: asString(f['ng_scope_topic']),
        limit: asNumber(f['ng_limit']),
        columns: asGridCols(f['ng_columns']),
      };
      return sec;
    }
    case 'catalog': {
      const sec: CatalogSection = {
        ...base, type: 'catalog',
        eyebrow: asString(f['cat_eyebrow']),
        h2: asString(f['cat_h2']),
        introBody: asString(f['cat_intro_body']),
        includeProducts: asBool(f['cat_include_products'], true),
        includeArticles: asBool(f['cat_include_articles']),
        scopeDivision: asString(f['cat_scope_division']),
        scopeCountry: asString(f['cat_scope_country']),
        facetFields: asString(f['cat_facet_fields']),
        placeholder: asString(f['cat_placeholder']),
        emptyText: asString(f['cat_empty_text']),
      };
      return sec;
    }
    case 'tabs': {
      const sec: TabsSection = {
        ...base, type: 'tabs',
        eyebrow: asString(f['tabs_eyebrow']),
        h2: asString(f['tabs_h2']),
        introBody: asString(f['tabs_intro_body']),
        tabs: tabsByParent.get(rec.id) ?? [],
      };
      return sec;
    }
    case 'team_grid': {
      const sec: TeamGridSection = {
        ...base, type: 'team_grid',
        eyebrow: asString(f['tg_eyebrow']),
        h2: asString(f['tg_h2']),
        body: asString(f['tg_body']),
        variant: asTgVariant(f['tg_variant']),
        coworkerManualIds: asLinkIds(f['tg_coworker_manual_ids']),
        scopeCountry: asString(f['tg_scope_country']),
        scopeDivision: asString(f['tg_scope_division']),
        limit: asNumber(f['tg_limit']),
      };
      return sec;
    }
    case 'partner_list': {
      const sec: PartnerListSection = {
        ...base, type: 'partner_list',
        eyebrow: asString(f['pl_eyebrow']),
        h2: asString(f['pl_h2']),
        body: asString(f['pl_body']),
        variant: asPlVariant(f['pl_variant']),
        partnerManualIds: asLinkIds(f['pl_partner_manual_ids']),
        scopeDivision: asString(f['pl_scope_division']),
        scopeCountry: asString(f['pl_scope_country']),
        limit: asNumber(f['pl_limit']),
      };
      return sec;
    }
    case 'faq': {
      const sec: FaqSection = {
        ...base, type: 'faq',
        eyebrow: asString(f['faq_eyebrow']),
        h2: asString(f['faq_h2']),
        body: asString(f['faq_body']),
        // FAS 3: read-prefer JSON-spegeln, annars Q:/A:-fältet (bakåtkompat).
        items: faqItemsFromStored(f['faq_json'], f['faq_items']),
      };
      return sec;
    }
    case 'testimonial': {
      const sec: TestimonialSection = {
        ...base, type: 'testimonial',
        eyebrow: asString(f['t_eyebrow']),
        quote: asString(f['t_quote']),
        authorName: asString(f['t_author_name']),
        authorTitle: asString(f['t_author_title']),
        authorImageUrl: asString(f['t_author_image_url']),
        testimonialManualIds: asLinkIds(f['t_testimonial_manual_ids']),
        scopeCountry: asString(f['t_scope_country']),
        scopeDivision: asString(f['t_scope_division']),
        scopeCustomerType: asString(f['t_scope_customer_type']),
        featuredOnly: asBool(f['t_featured_only']),
      };
      return sec;
    }
    case 'cta_banner': {
      const sec: CtaBannerSection = {
        ...base, type: 'cta_banner',
        eyebrow: asString(f['cta_eyebrow']),
        h2: asString(f['cta_h2']),
        body: asString(f['cta_body']),
        ctaText: asString(f['cta_cta_text']),
        ctaUrl: asString(f['cta_cta_url']),
        cta2Text: asString(f['cta_cta2_text']),
        cta2Url: asString(f['cta_cta2_url']),
        imageUrl: asString(f['cta_image_url']),
      };
      return sec;
    }
    case 'contact_form': {
      const sec: ContactFormSection = {
        ...base, type: 'contact_form',
        eyebrow: asString(f['cf_eyebrow']),
        title: asString(f['cf_title']),
        subtitle: asString(f['cf_subtitle']),
        cfLayout: asCfLayout(f['cf_layout']),
        showCompany: asBool(f['cf_show_company'], true),
        showPhone: asBool(f['cf_show_phone'], true),
        showDropdown: asBool(f['cf_show_dropdown'], true),
        dropdownLabel: asString(f['cf_dropdown_label']),
        options: asString(f['cf_options']),
        ctaText: asString(f['cf_cta_text']),
        messageLabel: asString(f['cf_message_label']),
        trustSignals: asString(f['cf_trust_signals']),
        showContactPerson: asBool(f['cf_show_contact_person'], true),
        contactScopeCountry: asString(f['cf_contact_scope_country']),
        contactScopeDivision: asString(f['cf_contact_scope_division']),
      };
      return sec;
    }
  }
}

// ─── Page-record → CmsPageState ────────────────────────────────────────────

interface FromRecordsArgs {
  page: AirtableRecord;
  /** Sektioner i den ordning som page.section_ids anger. */
  orderedSections: AirtableRecord[];
  /** Map från parent-section-record-ID till listan av tab-records (i ordning). */
  tabsByParent: Map<string, AirtableRecord[]>;
}

export function cmsPageStateFromRecords({ page, orderedSections, tabsByParent }: FromRecordsArgs): CmsPageState {
  const f = page.fields;
  const state = emptyCmsPageState();
  state.mode = 'edit';
  state.recordId = page.id;
  state.slug = asString(f['slug']);
  state.internalLabel = asString(f['internal_label']);
  state.internalNotes = asString(f['internal_notes']);
  state.h1 = asString(f['h1']);
  state.seoTitle = asString(f['seo_title']);
  state.seoDescription = asString(f['seo_description']);
  state.ogImageUrl = asString(f['og_image_url']);
  state.isPublished = asBool(f['is_published']);
  state.countryIds = asLinkIds(f['country_ids']);
  state.divisionIds = asLinkIds(f['division_ids']);
  state.pageTheme = asPageTheme(f['page_theme']);
  state.maxWidth = asMaxWidth(f['max_width']);

  // Pre-konvertera tab-records till TabItem[] per parent-section.
  const tabItemsByParent = new Map<string, TabItem[]>();
  for (const [parentId, tabRecords] of tabsByParent.entries()) {
    tabItemsByParent.set(
      parentId,
      tabRecords.map(tabItemFromRecord),
    );
  }

  state.sections = orderedSections
    .map((rec) => sectionFromRecord(rec, tabItemsByParent))
    .filter((s): s is PageSection => s !== null);

  return state;
}

/**
 * Anropas av page-type-ramverket; för cms-page är `loadCmsPageState` den
 * primära load-vägen (multi-tabell). Denna single-record-version fungerar för
 * list-mappers o.dyl. men ger en page utan sektioner.
 */
export function cmsPageStateFromRecord(rec: AirtableRecord): CmsPageState {
  return cmsPageStateFromRecords({
    page: rec,
    orderedSections: [],
    tabsByParent: new Map(),
  });
}

/** Stub för create-flödet — exporteras för symmetri med övriga sidtyper. */
export { emptySection } from './cms-page-types';
