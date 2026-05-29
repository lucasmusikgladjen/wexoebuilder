import { PageState, PageAction, Tab, TabDownload, FaqItem, CompareRow, StepItem } from './types';
import { emptyContactFormState } from './contact-form-types';

let tabCounter = 0;
export function generateTabId(): string {
  return `tab-${++tabCounter}-${Date.now()}`;
}

let dlCounter = 0;
export function generateDownloadId(): string {
  return `dl-${++dlCounter}-${Date.now()}`;
}

let faqCounter = 0;
export function generateFaqId(): string {
  return `faq-${++faqCounter}-${Date.now()}`;
}

let compareCounter = 0;
export function generateCompareRowId(): string {
  return `cmp-${++compareCounter}-${Date.now()}`;
}

let stepCounter = 0;
export function generateStepId(): string {
  return `step-${++stepCounter}-${Date.now()}`;
}

export function createEmptyTab(): Tab {
  return {
    id: generateTabId(),
    name: 'Ny tab',
    type: 'textimage',
    tiH2: '',
    tiText: '',
    tiBenefits: '',
    tiImage: '',
    tiInverted: false,
    fmUrl: '',
    faqItems: [],
    calTitle1: '',
    calUrl1: '',
    calTitle2: '',
    calUrl2: '',
    calTitle3: '',
    calUrl3: '',
    downloads: [],
    compareTitle: '',
    compareColA: 'Alternativ A',
    compareColB: 'Alternativ B',
    compareRows: [],
    stepsTitle: '',
    stepsItems: [],
  };
}

export const initialState: PageState = {
  mode: 'create',
  slug: '',
  recordId: null,

  h1: '',
  heroDescription: '',
  heroImage: '',
  heroCta1Text: 'Kontakta oss',
  heroCta1Url: '/kontakt/',
  heroCta2Text: '',
  heroCta2Url: '',

  contentH2: '',
  contentText: '',
  contentBenefits: '',

  sidebarType: '',
  caseId: '',
  eventType: '',
  eventTitle: '',
  eventDescription: '',
  eventDate: '',
  eventLocation: '',
  eventWebhook: '',
  magnetTitle: '',
  magnetFormat: '',
  magnetDescription: '',
  magnetFileUrl: '',
  magnetWebhook: '',
  calcTitle: '',
  calcHtml: '',

  tabs: [],

  contactName: '',
  contactTitle: '',
  contactEmail: '',
  contactPhone: '',
  contactImage: '',
  contactQuote: '',

  showContent: false,
  showSidebar: false,
  showTabs: false,
  showContact: false,

  colorMain: '#11325D',
  colorSecondary: '#F28C28',

  showContactForm: false,
  contactForm: emptyContactFormState(),
};

export function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'SET_TAB_FIELD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, [action.field]: action.value }
            : tab
        ),
      };

    case 'ADD_TAB':
      return { ...state, tabs: [...state.tabs, createEmptyTab()] };

    case 'REMOVE_TAB':
      return {
        ...state,
        tabs: state.tabs.filter((t) => t.id !== action.tabId),
      };

    case 'REORDER_TABS': {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(action.fromIndex, 1);
      tabs.splice(action.toIndex, 0, moved);
      return { ...state, tabs };
    }

    case 'ADD_DOWNLOAD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? {
                ...tab,
                downloads: [
                  ...tab.downloads,
                  {
                    id: generateDownloadId(),
                    name: '',
                    description: '',
                    fileUrl: '',
                    fileType: 'PDF',
                  } as TabDownload,
                ],
              }
            : tab
        ),
      };

    case 'REMOVE_DOWNLOAD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? {
                ...tab,
                downloads: tab.downloads.filter(
                  (d) => d.id !== action.downloadId
                ),
              }
            : tab
        ),
      };

    case 'SET_DOWNLOAD_FIELD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? {
                ...tab,
                downloads: tab.downloads.map((d) =>
                  d.id === action.downloadId
                    ? { ...d, [action.field]: action.value }
                    : d
                ),
              }
            : tab
        ),
      };

    case 'ADD_FAQ_ITEM':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, faqItems: [...tab.faqItems, { id: generateFaqId(), question: '', answer: '' } as FaqItem] }
            : tab
        ),
      };

    case 'REMOVE_FAQ_ITEM':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, faqItems: tab.faqItems.filter((f) => f.id !== action.itemId) }
            : tab
        ),
      };

    case 'SET_FAQ_ITEM_FIELD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, faqItems: tab.faqItems.map((f) => f.id === action.itemId ? { ...f, [action.field]: action.value } : f) }
            : tab
        ),
      };

    case 'ADD_COMPARE_ROW':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, compareRows: [...tab.compareRows, { id: generateCompareRowId(), label: '', valueA: '', valueB: '' } as CompareRow] }
            : tab
        ),
      };

    case 'REMOVE_COMPARE_ROW':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, compareRows: tab.compareRows.filter((r) => r.id !== action.rowId) }
            : tab
        ),
      };

    case 'SET_COMPARE_ROW_FIELD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, compareRows: tab.compareRows.map((r) => r.id === action.rowId ? { ...r, [action.field]: action.value } : r) }
            : tab
        ),
      };

    case 'ADD_STEP_ITEM':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, stepsItems: [...tab.stepsItems, { id: generateStepId(), title: '', description: '' } as StepItem] }
            : tab
        ),
      };

    case 'REMOVE_STEP_ITEM':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, stepsItems: tab.stepsItems.filter((s) => s.id !== action.itemId) }
            : tab
        ),
      };

    case 'SET_STEP_ITEM_FIELD':
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.tabId
            ? { ...tab, stepsItems: tab.stepsItems.map((s) => s.id === action.itemId ? { ...s, [action.field]: action.value } : s) }
            : tab
        ),
      };

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}
