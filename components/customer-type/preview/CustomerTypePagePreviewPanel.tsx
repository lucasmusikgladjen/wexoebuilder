'use client';

import { useRef } from 'react';
import { CustomerTypePageState, CustomerTypePageSectionId } from '@/lib/customer-type-types';
import { useScrollToActiveSection } from '@/hooks/useScrollToActiveSection';
import HeroPreview from './HeroPreview';
import ValuePreview from './ValuePreview';
import ContactFormPreview from '@/components/contact-form/ContactFormPreview';

interface Props {
  state: CustomerTypePageState;
  /** PageTypeBuilder skickar `string | null` — vi normaliserar nedan. */
  activeSection: CustomerTypePageSectionId | string | null;
  onSectionClick: (id: string) => void;
  scrollTrigger: number;
}

export default function CustomerTypePagePreviewPanel({
  state,
  activeSection,
  onSectionClick,
  scrollTrigger,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollToActiveSection(pageRef, activeSection, scrollTrigger);
  const activeId = activeSection as CustomerTypePageSectionId | null;
  const onSelect = (id: CustomerTypePageSectionId) => onSectionClick(id);

  const isEmpty =
    !state.title.trim() &&
    !state.eyebrow.trim() &&
    !state.description.trim() &&
    !state.valueH2.trim() &&
    !state.valueText1.trim();

  const caseCount = state.caseIds.length;

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
            wexoe.se/{state.slug || '...'}/ — Preview
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-dm-sans)', color: '#11325D' }}>
          <HeroPreview state={state} active={activeId} onSelect={onSelect} />

          {state.showValue && (
            <ValuePreview state={state} active={activeId} onSelect={onSelect} />
          )}

          {caseCount > 0 && (
            <div
              style={{
                background: '#f8f9fa',
                padding: '40px 40px 60px',
                color: '#11325D',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <div style={{ maxWidth: 1270, margin: '0 auto' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                    color: '#F28C28',
                    marginBottom: 8,
                  }}
                >
                  Kundcase ({caseCount})
                </div>
                <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
                  Linkade case-records renderas i strippen på publika sidan.
                  Innehåll hanteras i Airtable (cms_case_pages).
                </p>
              </div>
            </div>
          )}

          {state.showContactForm && (
            <div
              data-section="contactForm"
              onClick={() => onSelect('contactForm')}
              className={`relative cursor-pointer ${activeId === 'contactForm' ? 'ring-2 ring-orange-400 ring-inset' : ''}`}
            >
              <ContactFormPreview state={state.contactForm} />
            </div>
          )}
        </div>

        {isEmpty && (
          <div className="px-8 py-10 text-center text-gray-400 border-t border-gray-100">
            <p className="text-sm mb-1">Börja bygga din kundtyp-sida</p>
            <p className="text-xs">Fyll i fälten till höger — förhandsvisningen uppdateras direkt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
