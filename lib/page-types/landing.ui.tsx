import type { Dispatch, ReactNode } from 'react';
import { PageState, PageAction, SectionId } from '../types';
import { pageReducer } from '../state';
import HeroEditor from '@/components/editors/HeroEditor';
import ContentEditor from '@/components/editors/ContentEditor';
import SidebarEditor from '@/components/editors/SidebarEditor';
import TabsEditor from '@/components/editors/TabsEditor';
import ContactEditor from '@/components/editors/ContactEditor';
import ContactFormSection from '@/components/contact-form/ContactFormSection';
import PreviewPanel from '@/components/PreviewPanel';
import type { PageTypeUIDef, SectionDef, SectionEditorProps } from './types';

function dispatchFor(
  state: PageState,
  onChange: (next: PageState) => void,
): Dispatch<PageAction> {
  return (action) => onChange(pageReducer(state, action));
}

function editor<Props extends SectionEditorProps<PageState>>(
  render: (props: Props, dispatch: Dispatch<PageAction>) => ReactNode,
) {
  return function LandingSection(props: Props) {
    return <>{render(props, dispatchFor(props.state, props.onChange))}</>;
  };
}

const sections: SectionDef<PageState>[] = [
  {
    id: 'hero',
    label: 'Hero',
    Editor: editor(({ state }, dispatch) => <HeroEditor state={state} dispatch={dispatch} />),
    isFilled: (s) => !!s.h1.trim(),
  },
  {
    id: 'content',
    label: 'Innehåll',
    Editor: editor(({ state }, dispatch) => <ContentEditor state={state} dispatch={dispatch} />),
    isFilled: (s) => !!(s.contentH2 || s.contentText || s.contentBenefits),
  },
  {
    id: 'sidebar',
    label: 'Sidebar',
    Editor: editor(({ state }, dispatch) => <SidebarEditor state={state} dispatch={dispatch} />),
    isFilled: (s) => !!s.sidebarType,
  },
  {
    id: 'tabs',
    label: 'Tabs',
    Editor: editor(({ state }, dispatch) => <TabsEditor state={state} dispatch={dispatch} />),
    isFilled: (s) => s.tabs.length > 0,
  },
  {
    id: 'contact',
    label: 'Kontakt',
    Editor: editor(({ state }, dispatch) => <ContactEditor state={state} dispatch={dispatch} />),
    isFilled: (s) => !!(s.contactName || s.contactEmail || s.contactPhone),
  },
  {
    id: 'contactForm',
    label: 'Kontaktformulär',
    Editor: ({ state, onChange }) => (
      <ContactFormSection
        visible={state.showContactForm}
        onToggleVisible={(v) => onChange({ ...state, showContactForm: v })}
        state={state.contactForm}
        onChange={(contactForm) => onChange({ ...state, contactForm })}
      />
    ),
    isFilled: (s) => s.showContactForm,
  },
];

function LandingToolbarExtras({ state, setState }: { state: PageState; setState: (next: PageState) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-gray-400">
        Primär:
        <input
          type="color"
          value={state.colorMain}
          onChange={(e) => setState({ ...state, colorMain: e.target.value })}
          className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-400">
        Accent:
        <input
          type="color"
          value={state.colorSecondary}
          onChange={(e) => setState({ ...state, colorSecondary: e.target.value })}
          className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
        />
      </label>
    </div>
  );
}

export const landingUI: PageTypeUIDef<PageState> & {
  canSave: (state: PageState) => boolean;
  canSaveHint: string;
} = {
  id: 'landing',
  label: 'Landing',
  sections,
  previewLayout: ({ state, activeSection, scrollTrigger, onSectionClick }) => (
    <PreviewPanel
      state={state}
      activeSection={activeSection as SectionId | null}
      onSectionClick={(section) => onSectionClick(section)}
      scrollTrigger={scrollTrigger}
    />
  ),
  slugInput: {
    accessor: (s) => s.slug,
    setter: (s, slug) => ({ ...s, slug }),
    placeholder: 'min-sida',
    badge: (_s, mode) => (mode === 'create' ? 'Ny landing' : 'Landing'),
  },
  toolbarExtras: LandingToolbarExtras,
  canSave: (s) => !!s.slug.trim() && !!s.h1.trim(),
  canSaveHint: 'Slug + rubrik krävs',
};
