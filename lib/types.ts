import { ContactFormState } from './contact-form-types';

export type SidebarType = '' | 'case' | 'calculator' | 'event' | 'leadmagnet';

export type TabType =
  | 'textimage'
  | 'fullmedia'
  | 'faq'
  | 'calameo'
  | 'downloads'
  | 'compare'
  | 'steps';

export interface TabDownload {
  id: string;
  /** Airtable record ID — present when loaded from Airtable, missing for new downloads */
  recordId?: string;
  name: string;
  description: string;
  fileUrl: string;
  fileType: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface CompareRow {
  id: string;
  label: string;
  valueA: string;
  valueB: string;
}

export interface StepItem {
  id: string;
  title: string;
  description: string;
}

export interface Tab {
  id: string;
  /** Airtable record ID — present when loaded from Airtable, missing for new tabs */
  recordId?: string;
  name: string;
  type: TabType;
  // textimage
  tiH2: string;
  tiText: string;
  tiBenefits: string;
  tiImage: string;
  tiInverted: boolean;
  // fullmedia
  fmUrl: string;
  // faq
  faqItems: FaqItem[];
  // calameo
  calTitle1: string;
  calUrl1: string;
  calTitle2: string;
  calUrl2: string;
  calTitle3: string;
  calUrl3: string;
  // downloads
  downloads: TabDownload[];
  // compare
  compareTitle: string;
  compareColA: string;
  compareColB: string;
  compareRows: CompareRow[];
  // steps
  stepsTitle: string;
  stepsItems: StepItem[];
}

export interface PageState {
  mode: 'create' | 'edit';
  slug: string;
  recordId: string | null;

  // Hero
  h1: string;
  heroDescription: string;
  heroImage: string;
  heroCta1Text: string;
  heroCta1Url: string;
  heroCta2Text: string;
  heroCta2Url: string;

  // Content
  contentH2: string;
  contentText: string;
  contentBenefits: string;

  // Sidebar
  sidebarType: SidebarType;
  /** sidebar_type=case → ETT länkat cms_cases-record (record-id). Kortet
   *  (titel/bild/resultat/CTA) hämtas från caset, inte inline längre. */
  caseId: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  eventDate: string;
  eventLocation: string;
  eventWebhook: string;
  magnetTitle: string;
  magnetFormat: string;
  magnetDescription: string;
  magnetFileUrl: string;
  magnetWebhook: string;
  calcTitle: string;
  calcHtml: string;

  // Tabs
  tabs: Tab[];

  // Contact
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactImage: string;
  contactQuote: string;

  // Visibility
  showContent: boolean;
  showSidebar: boolean;
  showTabs: boolean;
  showContact: boolean;

  // Colors
  colorMain: string;
  colorSecondary: string;

  // Contact Form
  showContactForm: boolean;
  contactForm: ContactFormState;
}

export type SectionId = 'hero' | 'content' | 'sidebar' | 'tabs' | 'contact' | 'contactForm';

export type PageAction =
  | { type: 'SET_FIELD'; field: keyof PageState; value: unknown }
  | { type: 'SET_TAB_FIELD'; tabId: string; field: keyof Tab; value: unknown }
  | { type: 'ADD_TAB' }
  | { type: 'REMOVE_TAB'; tabId: string }
  | { type: 'REORDER_TABS'; fromIndex: number; toIndex: number }
  | { type: 'ADD_DOWNLOAD'; tabId: string }
  | { type: 'REMOVE_DOWNLOAD'; tabId: string; downloadId: string }
  | { type: 'SET_DOWNLOAD_FIELD'; tabId: string; downloadId: string; field: keyof TabDownload; value: string }
  | { type: 'ADD_FAQ_ITEM'; tabId: string }
  | { type: 'REMOVE_FAQ_ITEM'; tabId: string; itemId: string }
  | { type: 'SET_FAQ_ITEM_FIELD'; tabId: string; itemId: string; field: 'question' | 'answer'; value: string }
  | { type: 'ADD_COMPARE_ROW'; tabId: string }
  | { type: 'REMOVE_COMPARE_ROW'; tabId: string; rowId: string }
  | { type: 'SET_COMPARE_ROW_FIELD'; tabId: string; rowId: string; field: 'label' | 'valueA' | 'valueB'; value: string }
  | { type: 'ADD_STEP_ITEM'; tabId: string }
  | { type: 'REMOVE_STEP_ITEM'; tabId: string; itemId: string }
  | { type: 'SET_STEP_ITEM_FIELD'; tabId: string; itemId: string; field: 'title' | 'description'; value: string }
  | { type: 'LOAD_STATE'; state: PageState };
