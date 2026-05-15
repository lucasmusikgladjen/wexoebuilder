/**
 * Bidirektional mappning för contact-form-fält i sidtyps-records.
 *
 * Contact-form-blocket återanvänds av flera sidtyper (audience, product-area,
 * unique-page, ...) och har historiskt definierats om i varje mapper.
 *
 * Fältnamnen prefixas så samma block kan ligga i flera tabeller. Default
 * är `Contact Form ` (Title Case) som matchar nuvarande Airtable-schema.
 * Vid framtida snake_case-rename räcker det att uppdatera default-prefixet
 * (eller skicka ett eget per anrop).
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

export const CONTACT_FORM_FIELD_PREFIX = 'Contact Form ';

const CONTACT_FORM_FIELD_NAMES = {
  eyebrow: { title: 'Eyebrow', snake: 'eyebrow' },
  title: { title: 'Title', snake: 'title' },
  subtitle: { title: 'Subtitle', snake: 'subtitle' },
  layout: { title: 'Layout', snake: 'layout' },
  theme: { title: 'Theme', snake: 'theme' },
  showCompany: { title: 'Show Company', snake: 'show_company' },
  showPhone: { title: 'Show Phone', snake: 'show_phone' },
  showDropdown: { title: 'Show Dropdown', snake: 'show_dropdown' },
  dropdownLabel: { title: 'Dropdown Label', snake: 'dropdown_label' },
  options: { title: 'Options', snake: 'options' },
  ctaText: { title: 'CTA Text', snake: 'cta_text' },
  messageLabel: { title: 'Message Label', snake: 'message_label' },
  trustSignals: { title: 'Trust Signals', snake: 'trust_signals' },
  showContactPerson: { title: 'Show Contact Person', snake: 'show_contact_person' },
} as const;

type ContactFormFieldKey = keyof typeof CONTACT_FORM_FIELD_NAMES;

function contactFormFieldName(prefix: string, key: ContactFormFieldKey): string {
  const names = CONTACT_FORM_FIELD_NAMES[key];
  // Snake-case prefixes (`contact_form_`) compose with snake suffixes, while
  // legacy Airtable display-name prefixes (`Contact Form `) compose with
  // Title Case suffixes. This keeps old Audience/PA fields and newer
  // landing/unique snake_case fields both working through the shared mapper.
  return `${prefix}${prefix.endsWith('_') ? names.snake : names.title}`;
}

export function contactFormFromFields(
  fields: AirtableFields,
  prefix: string = CONTACT_FORM_FIELD_PREFIX,
): ContactFormState {
  const empty = emptyContactFormState();
  const k = (key: ContactFormFieldKey) => contactFormFieldName(prefix, key);
  const layoutRaw = asString(fields[k('layout')]);
  const themeRaw = asString(fields[k('theme')]);
  return {
    eyebrow: asString(fields[k('eyebrow')]),
    title: asString(fields[k('title')]),
    subtitle: asString(fields[k('subtitle')]),
    layout: (layoutRaw === 'centered' ? 'centered' : 'split') as ContactFormLayout,
    theme: (themeRaw === 'light' ? 'light' : 'dark') as ContactFormTheme,
    showCompany: asBool(fields[k('showCompany')], empty.showCompany),
    showPhone: asBool(fields[k('showPhone')], empty.showPhone),
    showDropdown: asBool(fields[k('showDropdown')], empty.showDropdown),
    dropdownLabel: asString(fields[k('dropdownLabel')]),
    options: asString(fields[k('options')]),
    ctaText: asString(fields[k('ctaText')]),
    messageLabel: asString(fields[k('messageLabel')]),
    trustSignals: asString(fields[k('trustSignals')]),
    showContactPerson: asBool(fields[k('showContactPerson')], empty.showContactPerson),
  };
}

export interface ContactFormToFieldsOptions {
  prefix?: string;
  /** Konvertera tomma textfält till `null` (Airtable-konvention som
   *  unique-page-mapper använder för att rensa fält). Booleans påverkas inte. */
  nullForEmpty?: boolean;
}

export function contactFormToFields(
  state: ContactFormState,
  options: ContactFormToFieldsOptions = {},
): Record<string, unknown> {
  const prefix = options.prefix ?? CONTACT_FORM_FIELD_PREFIX;
  const k = (key: ContactFormFieldKey) => contactFormFieldName(prefix, key);
  const text = (v: string): string | null =>
    options.nullForEmpty && v === '' ? null : v;
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
