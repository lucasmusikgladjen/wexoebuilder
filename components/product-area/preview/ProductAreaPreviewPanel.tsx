'use client';

import { useRef } from 'react';
import { ProductAreaState, ProductAreaSectionId, NormalSection } from '@/lib/product-area-types';
import { useScrollToActiveSection } from '@/hooks/useScrollToActiveSection';
import TopBannerPreview from './TopBannerPreview';
import HeroPreview from './HeroPreview';
import NormalSectionPreview from './NormalSectionPreview';
import ProductsPreview from './ProductsPreview';
import SolutionsPreview from './SolutionsPreview';
import ContactPreview from './ContactPreview';
import ContactFormPreview from '@/components/contact-form/ContactFormPreview';

interface Props {
  state: ProductAreaState;
  /** PageTypeBuilder skickar `string | null` — vi normaliserar internt. */
  activeSection: ProductAreaSectionId | string | null;
  onSectionClick: (id: string) => void;
  /** Increments whenever the user focuses an editor field — triggers the
   *  preview to scroll so the active section lands in the centre of the
   *  visible area. */
  scrollTrigger: number;
}

/**
 * Renders all PA sections in the order the PHP plugin emits them:
 *
 *   1. Top banner
 *   2. Hero
 *   3. "Early" Normal sections — any with `upp === true`
 *   4. Products (toggle OR side-menu mode)
 *   5. Solutions grid
 *   6. "Late" Normal sections — the remaining ones without `upp`
 *   7. Contact
 *
 * Top banner, hero and contact always render (with ghost placeholders when
 * empty) so the create flow shows a meaningful skeleton of the page.
 */
export default function ProductAreaPreviewPanel({
  state,
  activeSection,
  onSectionClick,
  scrollTrigger,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollToActiveSection(pageRef, activeSection, scrollTrigger);
  const activeId = activeSection as ProductAreaSectionId | null;
  const onSelect = (id: ProductAreaSectionId) => onSectionClick(id);

  const normals: Array<{ n: 1 | 2 | 3 | 4; section: NormalSection }> = [
    { n: 1, section: state.normal1 },
    { n: 2, section: state.normal2 },
    { n: 3, section: state.normal3 },
    { n: 4, section: state.normal4 },
  ];
  const early = normals.filter((x) => x.section.upp);
  const late = normals.filter((x) => !x.section.upp);

  const isEmpty =
    !state.h1.trim() &&
    !state.heroH2.trim() &&
    !state.heroText.trim() &&
    state.products.length === 0 &&
    state.solutions.length === 0 &&
    !state.contactName.trim() &&
    !normals.some((x) => x.section.h2.trim() || x.section.text.trim());

  return (
    <div className="h-full overflow-y-auto bg-gray-100 hide-scrollbar">
      <div
        ref={pageRef}
        className="builder-preview-canvas mx-auto my-4 shadow-lg rounded-lg overflow-hidden bg-white"
      >
        {/* Browser chrome */}
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
          <TopBannerPreview state={state} active={activeId} onSelect={onSelect} />
          <HeroPreview state={state} active={activeId} onSelect={onSelect} />

          {state.showContent && early.map(({ n, section }) => (
            <NormalSectionPreview
              key={`early-${n}`}
              n={n}
              section={section}
              active={activeId}
              onSelect={onSelect}
            />
          ))}

          {state.showProducts && (
            <ProductsPreview state={state} active={activeId} onSelect={onSelect} />
          )}
          {state.showSolutions && (
            <SolutionsPreview state={state} active={activeId} onSelect={onSelect} />
          )}

          {state.showContent && late.map(({ n, section }) => (
            <NormalSectionPreview
              key={`late-${n}`}
              n={n}
              section={section}
              active={activeId}
              onSelect={onSelect}
            />
          ))}

          {state.showContact && (
            <ContactPreview state={state} active={activeId} onSelect={onSelect} />
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

        {/* Empty-state hint overlay when the whole state is pristine. */}
        {isEmpty && (
          <div className="px-8 py-10 text-center text-gray-400 border-t border-gray-100">
            <p className="text-sm mb-1">Börja bygga din produktsida</p>
            <p className="text-xs">Fyll i fälten till höger — förhandsvisningen uppdateras direkt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
