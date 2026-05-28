'use client';

/**
 * Live-preview för cms_pages-editor.
 *
 * Render-strategi: en sektion-blok per state.sections[i], i ordning. Varje
 * blok har `data-section={section.clientId}` så scroll-syncen från
 * SectionsEditor (custom event `cms-page-focus-section`) hittar rätt
 * element.
 *
 * Editor-quickNav-syncen drivs av `data-section` på topp-nivå-paneler
 * (metadata/sections) — vi sätter en outer wrapper för "sections"-panelen
 * vid första section-block och låter quickNav scrolla dit.
 */

import { useEffect, useRef, useState } from 'react';
import {
  CmsPageState,
  PageSection,
  SECTION_TYPE_LABELS,
} from '@/lib/cms-page-types';
import { useScrollToActiveSection } from '@/hooks/useScrollToActiveSection';
import {
  CaseGridPreview,
  CatalogPreview,
  CompanyDataStripPreview,
  ContactFormPreview,
  CtaBannerPreview,
  FaqPreview,
  HeroPreview,
  NewsGridPreview,
  NewsTextSplitPreview,
  PartnerListPreview,
  TabsPreview,
  TeamGridPreview,
  TestimonialPreview,
  TextImagePreview,
  TextOnlyPreview,
} from './SectionPreviews';

interface Props {
  state: CmsPageState;
  activeSection?: string | null;
  scrollTrigger?: number;
  onSectionClick?: (id: string) => void;
}

function renderSection(section: PageSection, pageH1: string) {
  switch (section.type) {
    case 'hero': return <HeroPreview section={section} pageH1={pageH1} />;
    case 'text_image': return <TextImagePreview section={section} />;
    case 'text_only': return <TextOnlyPreview section={section} />;
    case 'company_data_strip': return <CompanyDataStripPreview section={section} />;
    case 'news_text_split': return <NewsTextSplitPreview section={section} />;
    case 'case_grid': return <CaseGridPreview section={section} />;
    case 'news_grid': return <NewsGridPreview section={section} />;
    case 'catalog': return <CatalogPreview section={section} />;
    case 'tabs': return <TabsPreview section={section} />;
    case 'team_grid': return <TeamGridPreview section={section} />;
    case 'partner_list': return <PartnerListPreview section={section} />;
    case 'faq': return <FaqPreview section={section} />;
    case 'testimonial': return <TestimonialPreview section={section} />;
    case 'cta_banner': return <CtaBannerPreview section={section} />;
    case 'contact_form': return <ContactFormPreview section={section} />;
  }
}

export default function CmsPagePreview({
  state,
  activeSection = null,
  scrollTrigger,
  onSectionClick,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);

  // QuickNav-scroll (metadata / sections panel-nivå)
  useScrollToActiveSection(pageRef, activeSection, scrollTrigger);

  // Per-section scroll triggered av SectionsEditor custom event
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (typeof ce.detail !== 'string') return;
      setFocusedSection(ce.detail);
      setFocusTrigger((n) => n + 1);
    };
    window.addEventListener('cms-page-focus-section', handler);
    return () => window.removeEventListener('cms-page-focus-section', handler);
  }, []);

  useEffect(() => {
    if (!focusedSection || !pageRef.current) return;
    const el = pageRef.current.querySelector(`[data-section="${focusedSection}"]`);
    if (el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedSection, focusTrigger]);

  const themeBg = state.pageTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const hasHero = state.sections.some((s) => s.type === 'hero');

  return (
    <div className="h-full overflow-y-auto hide-scrollbar bg-gray-100 p-6">
      <div ref={pageRef} className={`max-w-4xl mx-auto shadow-sm ${themeBg}`}>
        {/* Metadata-strip — fungerar som metadata-panelens scroll-target */}
        <div data-section="metadata" className="px-6 py-3 border-b border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex items-center gap-4">
          <span>/{state.slug || 'ingen-slug'}</span>
          <span className={`px-1.5 py-0.5 rounded ${state.isPublished ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {state.isPublished ? 'Publicerad' : 'Utkast'}
          </span>
          <span className="text-gray-400">Tema: {state.pageTheme}</span>
          <span className="text-gray-400">Bredd: {state.maxWidth}</span>
        </div>

        {/* Top-H1 visas bara om INGEN hero-sektion finns (matchar PHP-pluginet) */}
        {!hasHero && state.h1 && (
          <div className="p-6">
            <h1 className="text-3xl font-bold tracking-tight">{state.h1}</h1>
          </div>
        )}

        {state.sections.length === 0 && (
          <div data-section="sections" className="p-12 text-center text-sm text-gray-400">
            Inga sektioner. Lägg till en till höger.
          </div>
        )}

        {state.sections.map((section, i) => {
          const isFocused = focusedSection === section.clientId;
          const isFirstSection = i === 0;
          return (
            <div
              // Första sektionen får också data-section="sections" så
              // quickNav-syncen för "Sektioner"-panelen scrollar hit.
              data-section={isFirstSection ? `sections ${section.clientId}` : section.clientId}
              key={section.clientId}
              onClick={() => onSectionClick?.('sections')}
              className={`relative cursor-pointer border-t border-gray-100/30 ${isFocused ? 'ring-2 ring-orange-400 ring-inset' : ''} ${!section.isActive ? 'opacity-50' : ''}`}
            >
              <span className="absolute top-2 right-3 text-[10px] uppercase tracking-wider text-gray-300 bg-white/80 px-1.5 py-0.5 rounded z-10">
                {SECTION_TYPE_LABELS[section.type]}{!section.isActive ? ' (inaktiv)' : ''}
              </span>
              {/* Per-sektion temaöverstyrning */}
              <div className={section.theme === 'dark' ? 'bg-gray-900 text-white' : section.theme === 'light' ? 'bg-white text-gray-900' : ''}>
                {renderSection(section, state.h1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
