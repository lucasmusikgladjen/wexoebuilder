'use client';

import { useRef } from 'react';
import { PartnerPageState, PartnerPageSectionId } from '@/lib/partner-types';
import { useScrollToActiveSection } from '@/hooks/useScrollToActiveSection';
import ContactFormPreview from '@/components/contact-form/ContactFormPreview';
import HeroPreview from './HeroPreview';
import QuickFactsPreview from './QuickFactsPreview';
import AboutPreview from './AboutPreview';
import WhyWexoePreview from './WhyWexoePreview';
import CategoriesPreview from './CategoriesPreview';
import FaqPreview from './FaqPreview';
import ContactPersonPreview from './ContactPersonPreview';

interface Props {
  state: PartnerPageState;
  /** PageTypeBuilder skickar `string | null` — vi normaliserar nedan. */
  activeSection: PartnerPageSectionId | string | null;
  onSectionClick: (id: string) => void;
  scrollTrigger: number;
}

/**
 * Top-level preview-shell — samma mönster som
 * `CustomerTypePagePreviewPanel`. Renderar sektioner i samma ordning som
 * `wexoe-partner-page/src/Renderer.php` (Hero → QuickFacts → About →
 * WhyWexoe → Categories → FAQ → Contact Person → Contact Form).
 *
 * Visibility-toggles (`show_*`) bestämmer om en sektion ska visas alls.
 * För sektioner som är på men saknar innehåll renderar respektive
 * preview-komponent en tom-state-notis (så marknadsföraren ser att
 * sektionen finns men är tom).
 */
export default function PartnerPreviewPanel({
  state,
  activeSection,
  onSectionClick,
  scrollTrigger,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollToActiveSection(pageRef, activeSection, scrollTrigger);
  const activeId = activeSection as PartnerPageSectionId | null;
  const onSelect = (id: PartnerPageSectionId) => onSectionClick(id);

  const isEmpty =
    !state.h1.trim() &&
    !state.heroTagline.trim() &&
    !state.aboutH2.trim() &&
    !state.whyH2.trim() &&
    state.partnerIds.length === 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-100 hide-scrollbar">
      <div
        ref={pageRef}
        className="builder-preview-canvas mx-auto my-4 shadow-lg rounded-lg overflow-hidden bg-white"
      >
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-gray-400 ml-2">
            wexoe.se/leverantor/{state.slug || '...'}/ — Preview
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-dm-sans)', color: '#11325D' }}>
          <HeroPreview state={state} active={activeId} onSelect={onSelect} />
          {state.showQuickFacts && (
            <QuickFactsPreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showAbout && (
            <AboutPreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showWhyWexoe && (
            <WhyWexoePreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showCategories && (
            <CategoriesPreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showFaq && (
            <FaqPreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showContactPerson && (
            <ContactPersonPreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showContactForm && (
            <div
              data-section="contactForm"
              onClick={() => onSelect('contactForm')}
              className={`relative cursor-pointer ${
                activeId === 'contactForm' ? 'ring-2 ring-orange-400 ring-inset' : ''
              }`}
            >
              <ContactFormPreview state={state.contactForm} />
            </div>
          )}
        </div>

        {isEmpty && (
          <div className="px-8 py-10 text-center text-gray-400 border-t border-gray-100">
            <p className="text-sm mb-1">Börja bygga partner-sidan</p>
            <p className="text-xs">
              Välj partner under Inställningar och fyll i Hero-fälten — förhandsvisningen uppdateras direkt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
