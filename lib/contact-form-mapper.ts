/**
 * Bidirektional mappning för contact-form-fält i sidtyps-records.
 *
 * Contact-form-blocket återanvänds av flera sidtyper (audience, product-area,
 * unique-page, ...). Sidtyperna ligger i olika baser och olika naming-eror:
 *
 * - Legacy-basen (audience, m.fl.) — Title Case-fält:
 *   `Contact Form Eyebrow`, `Contact Form Show Company`, etc.
 * - Wexoe NY (cms_*-tabellerna) — snake_case-fält:
 *   `contact_form_eyebrow`, `contact_form_show_company`, etc.
 *
 * Schemat väljs via `schema`-parametern. `title_case` är default för
 * bakåtkompat med audience/product-area-mappers, men nya callsites (cms_*) ska
 * skicka `snake_case`. Internt mappar funktionen mellan ContactFormState-fält
 * och Airtable-fältnamn för rätt schema.
 *
 * Read-sidan använder `emptyContactFormState()` som fallback när record:en
 * saknar toggle-fält — så defaults som "Show Company = true" består även
 * om Airtable-fältet är otillsatt (det vanliga fallet för äldre records).
 *
 * Write-sidan returnerar råa värden. Callers ansvarar själva för
 * empty→null-konvertering om sidtypen vill den semantiken.
 */

import { AirtableFields, asString, asBool } from './airtable-helpers';
import {
  ContactFormState,
  ContactFormLayout,
  ContactFormTheme,
  emptyContactFormState,
} from './contact-form-types';

export type ContactFormSchema = 'title_case' | 'snake_case';

interface SchemaSpec {
  prefix: string;
  /** Map från ContactFormState-fält → Airtable-fältnamn (utan prefix). */
  keys: {
    eyebrow: string;
    title: string;
    subtitle: string;
    layout: string;
    theme: string;
    showCompany: string;
    showPhone: string;
    showDropdown: string;
    dropdownLabel: string;
    options: string;
    ctaText: string;
    messageLabel: string;
    trustSignals: string;
    showContactPerson: string;
  };
}

const SCHEMAS: Record<ContactFormSchema, SchemaSpec> = {
  title_case: {
    prefix: 'Contact Form ',
    keys: {
      eyebrow: 'Eyebrow',
      title: 'Title',
      subtitle: 'Subtitle',
      layout: 'Layout',
      theme: 'Theme',
      showCompany: 'Show Company',
      showPhone: 'Show Phone',
      showDropdown: 'Show Dropdown',
      dropdownLabel: 'Dropdown Label',
      options: 'Options',
      ctaText: 'CTA Text',
      messageLabel: 'Message Label',
      trustSignals: 'Trust Signals',
      showContactPerson: 'Show Contact Person',
    },
  },
  snake_case: {
    prefix: 'contact_form_',
    keys: {
      eyebrow: 'eyebrow',
      title: 'title',
      subtitle: 'subtitle',
      layout: 'layout',
      theme: 'theme',
      showCompany: 'show_company',
      showPhone: 'show_phone',
      showDropdown: 'show_dropdown',
      dropdownLabel: 'dropdown_label',
      options: 'options',
      ctaText: 'cta_text',
      messageLabel: 'message_label',
      trustSignals: 'trust_signals',
      showContactPerson: 'show_contact_person',
    },
  },
};

/** @deprecated Kept for callers that still reference the constant directly. */
export const CONTACT_FORM_FIELD_PREFIX = SCHEMAS.title_case.prefix;

type ContactFormFieldKey = keyof SchemaSpec['keys'];

function isContactFormSchema(value: string): value is ContactFormSchema {
  return value === 'title_case' || value === 'snake_case';
}

function contactFormFieldName(prefix: string, key: ContactFormFieldKey): string {
  const suffixSchema = prefix.endsWith('_') ? SCHEMAS.snake_case : SCHEMAS.title_case;
  return `${prefix}${suffixSchema.keys[key]}`;
}

function resolveContactFormFieldName(
  schemaOrPrefix: ContactFormSchema | string | undefined,
  key: ContactFormFieldKey,
): string {
  if (!schemaOrPrefix) {
    return `${SCHEMAS.title_case.prefix}${SCHEMAS.title_case.keys[key]}`;
  }

  if (isContactFormSchema(schemaOrPrefix)) {
    const schema = SCHEMAS[schemaOrPrefix];
    return `${schema.prefix}${schema.keys[key]}`;
  }

  // Backwards compatible path for callers that pass a raw prefix such as
  // `contact_form_`. Snake-case prefixes compose with snake-case suffixes,
  // while legacy display-name prefixes compose with Title Case suffixes.
  return contactFormFieldName(schemaOrPrefix, key);
}

export function contactFormFromFields(
  fields: AirtableFields,
  schemaOrPrefix: ContactFormSchema | string = 'title_case',
): ContactFormState {
  const empty = emptyContactFormState();
  const f = (k: ContactFormFieldKey) => fields[resolveContactFormFieldName(schemaOrPrefix, k)];
  const layoutRaw = asString(f('layout'));
  const themeRaw = asString(f('theme'));
  return {
    eyebrow: asString(f('eyebrow')),
    title: asString(f('title')),
    subtitle: asString(f('subtitle')),
    layout: (layoutRaw === 'centered' ? 'centered' : 'split') as ContactFormLayout,
    theme: (themeRaw === 'light' ? 'light' : 'dark') as ContactFormTheme,
    showCompany: asBool(f('showCompany'), empty.showCompany),
    showPhone: asBool(f('showPhone'), empty.showPhone),
    showDropdown: asBool(f('showDropdown'), empty.showDropdown),
    dropdownLabel: asString(f('dropdownLabel')),
    options: asString(f('options')),
    ctaText: asString(f('ctaText')),
    messageLabel: asString(f('messageLabel')),
    trustSignals: asString(f('trustSignals')),
    showContactPerson: asBool(f('showContactPerson'), empty.showContactPerson),
  };
}

export interface ContactFormToFieldsOptions {
  schema?: ContactFormSchema;
  /** @deprecated Prefer `schema`; kept for raw-prefix callers during schema migration. */
  prefix?: string;
  /** Konvertera tomma textfält till `null` (Airtable-konvention som
   *  unique-page-mapper använder för att rensa fält). Booleans påverkas inte. */
  nullForEmpty?: boolean;
}

export function contactFormToFields(
  state: ContactFormState,
  options: ContactFormToFieldsOptions = {},
): Record<string, unknown> {
  const schemaOrPrefix = options.prefix ?? options.schema ?? 'title_case';
  const text = (v: string): string | null =>
    options.nullForEmpty && v === '' ? null : v;
  const k = (key: ContactFormFieldKey) => resolveContactFormFieldName(schemaOrPrefix, key);
  return {
    [k('eyebrow')]: text(state.eyebrow),
    [k('title')]: text(state.title),
    [k('subtitle')]: text(state.subtitle),
    [k('layout')]: state.layout,
    [k('theme')]: state.theme,
    [k('showCompany')]: state.showCompany,
    [k('showPhone')]: state.showPhone,
    [k('showDropdown')]: state.showDropdown,
    [k('dropdownLabel')]: text(state.dropdownLabel),
    [k('options')]: text(state.options),
    [k('ctaText')]: text(state.ctaText),
    [k('messageLabel')]: text(state.messageLabel),
    [k('trustSignals')]: text(state.trustSignals),
    [k('showContactPerson')]: state.showContactPerson,
  };
}
