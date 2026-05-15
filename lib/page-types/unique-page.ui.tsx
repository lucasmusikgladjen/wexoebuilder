/**
 * Unique-page — UI-side sidtypsdefinition.
 *
 * 11 sektioner i ordning: Sidinfo, Hero, Text+bild A/B, Text, FAQ, Team,
 * Partners, Citat, CTA-banner, Kontaktformulär. De flesta är "singleton"-
 * sektioner med en visibility-toggle (show*) som styr om sektionen
 * renderas i preview.
 */

import { UniquePageState } from '../unique-page-types';
import MetadataPanel from '@/components/unique-page/editors/MetadataPanel';
import HeroEditor from '@/components/unique-page/editors/HeroEditor';
import TextImageEditor from '@/components/unique-page/editors/TextImageEditor';
import TextOnlyEditor from '@/components/unique-page/editors/TextOnlyEditor';
import FaqEditor from '@/components/unique-page/editors/FaqEditor';
import TeamGridEditor from '@/components/unique-page/editors/TeamGridEditor';
import PartnersMarqueeEditor from '@/components/unique-page/editors/PartnersMarqueeEditor';
import TestimonialCardEditor from '@/components/unique-page/editors/TestimonialCardEditor';
import CtaBannerEditor from '@/components/unique-page/editors/CtaBannerEditor';
import ContactFormEditor from '@/components/contact-form/ContactFormEditor';
import UniquePagePreview from '@/components/unique-page/preview/UniquePagePreview';
import type { PageTypeUIDef, SectionDef } from './types';

/**
 * Mappar `state.<sub>` ↔ TState så delade sub-state-editorer (HeroEditor,
 * TextImageEditor, ...) kan kopplas in utan boilerplate.
 */
function lift<TState, TSub>(
  Sub: React.ComponentType<{ state: TSub; onChange: (s: TSub) => void }>,
  pick: (s: TState) => TSub,
  set: (s: TState, sub: TSub) => TState,
) {
  return function Lifted({ state, onChange }: { state: TState; onChange: (next: TState) => void }) {
    return <Sub state={pick(state)} onChange={(sub) => onChange(set(state, sub))} />;
  };
}

function showToggle<K extends keyof UniquePageState>(key: K) {
  return (state: UniquePageState, setState: (next: UniquePageState) => void) => ({
    value: Boolean(state[key]),
    onChange: (v: boolean) =>
      setState({ ...state, [key]: v as UniquePageState[K] }),
  });
}

const sections: SectionDef<UniquePageState>[] = [
  {
    id: 'metadata',
    label: 'Sidinfo & SEO',
    Editor: MetadataPanel,
  },
  {
    id: 'hero',
    label: 'Hero',
    Editor: lift(HeroEditor, (s) => s.hero, (s, hero) => ({ ...s, hero })),
    visibilityToggle: showToggle('showHero'),
  },
  {
    id: 'textImageA',
    label: 'Text + bild A',
    Editor: lift(TextImageEditor, (s) => s.textImageA, (s, textImageA) => ({ ...s, textImageA })),
    visibilityToggle: showToggle('showTextImageA'),
  },
  {
    id: 'textImageB',
    label: 'Text + bild B',
    Editor: lift(TextImageEditor, (s) => s.textImageB, (s, textImageB) => ({ ...s, textImageB })),
    visibilityToggle: showToggle('showTextImageB'),
  },
  {
    id: 'textOnly',
    label: 'Text',
    Editor: lift(TextOnlyEditor, (s) => s.textOnly, (s, textOnly) => ({ ...s, textOnly })),
    visibilityToggle: showToggle('showTextOnly'),
  },
  {
    id: 'faq',
    label: 'FAQ',
    Editor: lift(FaqEditor, (s) => s.faq, (s, faq) => ({ ...s, faq })),
    visibilityToggle: showToggle('showFaq'),
  },
  {
    id: 'teamGrid',
    label: 'Team grid',
    Editor: lift(TeamGridEditor, (s) => s.teamGrid, (s, teamGrid) => ({ ...s, teamGrid })),
    visibilityToggle: showToggle('showTeamGrid'),
  },
  {
    id: 'partnersMarquee',
    label: 'Partners (marquee)',
    Editor: lift(PartnersMarqueeEditor, (s) => s.partnersMarquee, (s, partnersMarquee) => ({ ...s, partnersMarquee })),
    visibilityToggle: showToggle('showPartnersMarquee'),
  },
  {
    id: 'testimonialCard',
    label: 'Citat',
    Editor: lift(TestimonialCardEditor, (s) => s.testimonialCard, (s, testimonialCard) => ({ ...s, testimonialCard })),
    visibilityToggle: showToggle('showTestimonialCard'),
  },
  {
    id: 'ctaBanner',
    label: 'CTA-banner',
    Editor: lift(CtaBannerEditor, (s) => s.ctaBanner, (s, ctaBanner) => ({ ...s, ctaBanner })),
    visibilityToggle: showToggle('showCtaBanner'),
  },
  {
    id: 'contactForm',
    label: 'Kontaktformulär',
    Editor: lift(ContactFormEditor, (s) => s.contactForm, (s, contactForm) => ({ ...s, contactForm })),
    visibilityToggle: showToggle('showContactForm'),
  },
];

export const uniquePageUI: PageTypeUIDef<UniquePageState> & {
  canSave: (state: UniquePageState) => boolean;
  canSaveHint: string;
} = {
  id: 'unique-page',
  label: 'Egen sida',
  sections,
  previewLayout: ({ state, activeSection, scrollTrigger, onSectionClick }) => (
    <UniquePagePreview
      state={state}
      activeSection={activeSection}
      scrollTrigger={scrollTrigger}
      onSectionClick={onSectionClick}
    />
  ),
  slugInput: {
    accessor: (s) => s.slug,
    setter: (s, slug) => ({ ...s, slug }),
    placeholder: 'om-oss',
    badge: (_s, mode) => (mode === 'create' ? 'Ny sida' : 'Egen sida'),
  },
  toolbarExtras: ({ state, setState }) => (
    <label className="flex items-center gap-1.5 ml-2 text-xs text-gray-600 cursor-pointer">
      <input
        type="checkbox"
        checked={state.published}
        onChange={(e) => setState({ ...state, published: e.target.checked })}
        className="h-3.5 w-3.5"
      />
      Publicerad
    </label>
  ),
  canSave: (s) => !!s.slug.trim() && !!s.h1.trim(),
  canSaveHint: 'Slug + H1 krävs',
};
