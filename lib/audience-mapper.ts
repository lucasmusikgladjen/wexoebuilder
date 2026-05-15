/**
 * Forward and reverse mapping between Airtable Audience Hero records and
 * AudienceState. Forward-mappern används bara som candidate-field schema till
 * Claude-transformen; route-actions postar inte dessa fält direkt till Airtable.
 */

import { AirtableRecord, LEGACY_BASE_ID } from './airtable';
import { AudienceState } from './audience-types';
import { str, bool } from './airtable-helpers';
import { contactFormFromFields, contactFormToFields } from './contact-form-mapper';

// Audience Heroes (Customer types-tabellen) ligger fortfarande i gamla Wexoe-
// basen. `listRecords/createRecord/updateRecord`-anrop måste explicit pass:a
// `baseId: AUDIENCE_BASE_ID`. När audiences migrerats till
// `cms_customer_type_pages` i nya basen, byt till `BASE_ID` och uppdatera
// tabell-ID:t nedan.

export const AUDIENCE_BASE_ID = LEGACY_BASE_ID;

export const AUDIENCE_TABLE_IDS = {
  audienceHeroes: 'tblvNf1CqAYEFvTpu',
} as const;

export function audienceStateFromRecord(record: AirtableRecord): AudienceState {
  const f = record.fields;
  const valueH2 = str(f, 'Value H2');
  const valueText1 = str(f, 'Value Text 1');
  const valueText2 = str(f, 'Value Text 2');
  const benefit1 = str(f, 'Benefit 1');
  const benefit2 = str(f, 'Benefit 2');
  const benefit3 = str(f, 'Benefit 3');
  const caseTitle = str(f, 'Case Title');

  return {
    mode: 'edit',
    recordId: record.id,
    slug: str(f, 'Slug'),
    active: bool(f, 'Active'),

    eyebrow: str(f, 'Eyebrow'),
    title: str(f, 'Title'),
    description: str(f, 'Description'),
    ctaText: str(f, 'CTA Text'),
    ctaUrl: str(f, 'CTA URL'),
    heroImage: str(f, 'Hero Image'),
    statNumber: str(f, 'Stat Number'),
    statLabel: str(f, 'Stat Label'),

    // showValue/showCase persisteras inte i Airtable — defaulta till true
    // i edit-läge om någon av fälten har innehåll, annars false. Speglar
    // AudienceBuilder:s legacy-logik.
    showValue: !!(valueH2 || valueText1 || valueText2 || benefit1 || benefit2 || benefit3),
    valueH2,
    valueText1,
    valueText2,
    benefit1,
    benefit2,
    benefit3,

    showCase: !!caseTitle,
    caseTitle,
    caseDescription: str(f, 'Case Description'),
    caseResult: str(f, 'Case Result'),
    caseLinkText: str(f, 'Case Link Text'),
    caseLinkUrl: str(f, 'Case Link URL'),

    showContactForm: bool(f, 'Show Contact Form'),
    contactForm: contactFormFromFields(f),
  };
}

/**
 * Build the Airtable fields payload from state. On create, empty strings are
 * dropped so we don't pre-fill blank fields. On update, empties are kept as
 * empty strings so removed values clear out of Airtable.
 */
export function audienceStateToFields(
  state: AudienceState,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const all: Record<string, unknown> = {
    Slug: state.slug,
    Active: state.active,
    Eyebrow: state.eyebrow,
    Title: state.title,
    Description: state.description,
    'CTA Text': state.ctaText,
    'CTA URL': state.ctaUrl,
    'Hero Image': state.heroImage,
    'Stat Label': state.statLabel,
    'Value H2': state.valueH2,
    'Value Text 1': state.valueText1,
    'Value Text 2': state.valueText2,
    'Benefit 1': state.benefit1,
    'Benefit 2': state.benefit2,
    'Benefit 3': state.benefit3,
    'Case Title': state.caseTitle,
    'Case Description': state.caseDescription,
    'Case Result': state.caseResult,
    'Case Link Text': state.caseLinkText,
    'Case Link URL': state.caseLinkUrl,

    'Show Contact Form': state.showContactForm,
    ...contactFormToFields(state.contactForm),
  };

  // Stat Number is an Airtable number field — coerce, treat blank as null.
  const trimmed = state.statNumber.trim();
  if (trimmed) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) all['Stat Number'] = n;
  } else if (mode === 'update') {
    all['Stat Number'] = null;
  }

  if (mode === 'create') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(all)) {
      if (v === '' || v === undefined) continue;
      out[k] = v;
    }
    return out;
  }
  return all;
}
