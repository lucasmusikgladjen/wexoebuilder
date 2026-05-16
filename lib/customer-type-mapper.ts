/**
 * Forward and reverse mapping between Airtable `cms_customer_type_pages`
 * records och `CustomerTypePageState`.
 *
 * Schema är flat (en linked-record-länk till cms_case_pages). Skrivvägen
 * går via Claude-transform, medan denna fil sköter reverse-load till state.
 * snake_case-konvention både i Airtable och här.
 */

import { AirtableRecord } from './airtable';
import { AIRTABLE_FAMILIES, CUSTOMER_TYPE_TABLE_IDS as AIRTABLE_CUSTOMER_TYPE_TABLE_IDS } from './airtable-registry';
import { CustomerTypePageState } from './customer-type-types';
import { str, bool } from './airtable-helpers';
import { contactFormFromFields } from './contact-form-mapper';

export const CUSTOMER_TYPE_BASE_ID = AIRTABLE_FAMILIES.customerType.baseId;
export const CUSTOMER_TYPE_TABLE_IDS = AIRTABLE_CUSTOMER_TYPE_TABLE_IDS;

function strArray(fields: Record<string, unknown>, key: string): string[] {
  const v = fields[key];
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : [];
}

export function customerTypePageStateFromRecord(
  record: AirtableRecord,
): CustomerTypePageState {
  const f = record.fields;
  const valueH2 = str(f, 'value_h2');
  const valueText1 = str(f, 'value_text_1');
  const valueText2 = str(f, 'value_text_2');
  const benefit1 = str(f, 'benefit_1');
  const benefit2 = str(f, 'benefit_2');
  const benefit3 = str(f, 'benefit_3');

  const statNumberRaw = f['stat_number'];
  const statNumber =
    typeof statNumberRaw === 'number'
      ? String(statNumberRaw)
      : typeof statNumberRaw === 'string'
        ? statNumberRaw
        : '';

  return {
    mode: 'edit',
    recordId: record.id,
    slug: str(f, 'slug'),
    isActive: bool(f, 'is_active'),
    name: str(f, 'name'),

    eyebrow: str(f, 'eyebrow'),
    title: str(f, 'title'),
    description: str(f, 'description'),
    ctaText: str(f, 'cta_text'),
    ctaUrl: str(f, 'cta_url'),
    heroImageUrl: str(f, 'hero_image_url'),
    statNumber,
    statLabel: str(f, 'stat_label'),

    showValue: !!(valueH2 || valueText1 || valueText2 || benefit1 || benefit2 || benefit3),
    valueH2,
    valueText1,
    valueText2,
    benefit1,
    benefit2,
    benefit3,

    caseIds: strArray(f, 'case_ids'),

    showContactForm: bool(f, 'show_contact_form'),
    contactForm: contactFormFromFields(f, 'snake_case'),
  };
}

