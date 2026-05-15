'use client';

import { useRef } from 'react';
import { UniquePageState } from '@/lib/unique-page-types';
import { useScrollToActiveSection } from '@/hooks/useScrollToActiveSection';
import ContactFormPreview from '@/components/contact-form/ContactFormPreview';

interface Props {
  state: UniquePageState;
  activeSection?: string | null;
  scrollTrigger?: number;
  onSectionClick?: (id: string) => void;
}

/**
 * Visual skiss av Tier 2-sidan. Speglar wexoe-pages-PHP-renderaren i sektion-ordning.
 * Inte pixelidentisk — målet är att redaktören ska se VILKA sektioner som visas
 * och i vilken ordning, inte exakt CSS-utseende.
 */
export default function UniquePagePreview({
  state,
  activeSection = null,
  scrollTrigger,
  onSectionClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useScrollToActiveSection(containerRef, activeSection, scrollTrigger);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-sm">
        {/* Metadata-strip */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex items-center gap-4">
          <span>/{state.slug || 'ingen-slug'}</span>
          <span className={`px-1.5 py-0.5 rounded ${state.published ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {state.published ? 'Publicerad' : 'Utkast'}
          </span>
        </div>

        {/* H1 — visas alltid om ingen Hero används */}
        {!state.showHero && state.h1 && (
          <div className="p-6">
            <h1 className="text-3xl font-medium tracking-tight text-gray-900">{state.h1}</h1>
          </div>
        )}

        {/* Hero */}
        {state.showHero && (
          <SectionFrame id="hero" label="Hero" theme={state.hero.theme} onSectionClick={onSectionClick}>
            {state.hero.eyebrow && <p className="text-xs uppercase tracking-wider opacity-70">{state.hero.eyebrow}</p>}
            <h1 className="text-3xl font-medium mb-2">{state.hero.h1Override || state.h1 || '(saknar H1)'}</h1>
            {state.hero.subtitle && <p className="text-sm opacity-80 mb-3 whitespace-pre-line">{state.hero.subtitle}</p>}
            {state.hero.ctaText && (
              <button className="px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900 inline-block">
                {state.hero.ctaText}
              </button>
            )}
          </SectionFrame>
        )}

        {state.showTextImageA && <TextImageBlock id="textImageA" onSectionClick={onSectionClick} label="Text+bild A" h2={state.textImageA.h2} body={state.textImageA.body} theme={state.textImageA.theme} reversed={state.textImageA.reversed} image={state.textImageA.imageUrl} />}
        {state.showTextImageB && <TextImageBlock id="textImageB" onSectionClick={onSectionClick} label="Text+bild B" h2={state.textImageB.h2} body={state.textImageB.body} theme={state.textImageB.theme} reversed={state.textImageB.reversed} image={state.textImageB.imageUrl} />}

        {state.showTextOnly && (
          <SectionFrame id="textOnly" label="Text" theme="light" onSectionClick={onSectionClick}>
            {state.textOnly.h2 && <h2 className={`text-xl font-medium mb-2 ${state.textOnly.align === 'center' ? 'text-center' : ''}`}>{state.textOnly.h2}</h2>}
            <p className={`text-sm whitespace-pre-line opacity-80 ${state.textOnly.align === 'center' ? 'text-center' : ''}`}>{state.textOnly.body}</p>
          </SectionFrame>
        )}

        {state.showFaq && (
          <SectionFrame id="faq" label="FAQ" theme="light" onSectionClick={onSectionClick}>
            {state.faq.h2 && <h2 className="text-xl font-medium mb-3">{state.faq.h2}</h2>}
            <ul className="space-y-2">
              {state.faq.items.split('\n').filter(Boolean).map((line, i) => {
                const m = line.match(/^\*\*([^*]+)\*\*\s*\|\s*(.+)$/);
                if (!m) return <li key={i} className="text-xs text-gray-400">{line}</li>;
                return (
                  <li key={i} className="text-sm">
                    <strong className="block">{m[1]}</strong>
                    <span className="opacity-80">{m[2]}</span>
                  </li>
                );
              })}
            </ul>
          </SectionFrame>
        )}

        {state.showTeamGrid && (
          <SectionFrame id="teamGrid" label="Team grid (SSOT)" theme="light" onSectionClick={onSectionClick}>
            {state.teamGrid.h2 && <h2 className="text-xl font-medium mb-2">{state.teamGrid.h2}</h2>}
            <p className="text-xs text-gray-400">
              Visar medarbetare från SSOT med scope: land={state.teamGrid.scope.country || 'sidans'} · division={state.teamGrid.scope.division || 'sidans'} · limit={state.teamGrid.scope.limit || '∞'}
            </p>
          </SectionFrame>
        )}

        {state.showPartnersMarquee && (
          <SectionFrame id="partnersMarquee" label="Partners marquee (SSOT)" theme="light" onSectionClick={onSectionClick}>
            {state.partnersMarquee.h2 && <h2 className="text-xl font-medium mb-2">{state.partnersMarquee.h2}</h2>}
            <p className="text-xs text-gray-400">
              Visar partners från SSOT · land={state.partnersMarquee.scope.country || 'sidans'} · division={state.partnersMarquee.scope.division || 'sidans'}
            </p>
          </SectionFrame>
        )}

        {state.showTestimonialCard && (
          <SectionFrame id="testimonialCard" label="Citat-kort (SSOT)" theme="light" onSectionClick={onSectionClick}>
            <p className="text-xs text-gray-400">
              Visar testimonial från SSOT · kundtyp={state.testimonialCard.scope.customerType || '–'} · division={state.testimonialCard.scope.division || '–'} · land={state.testimonialCard.scope.country || 'sidans'}
            </p>
          </SectionFrame>
        )}

        {state.showCtaBanner && (
          <SectionFrame id="ctaBanner" label="CTA-banner" theme={state.ctaBanner.theme} onSectionClick={onSectionClick}>
            {state.ctaBanner.h2 && <h2 className="text-xl font-medium mb-2">{state.ctaBanner.h2}</h2>}
            {state.ctaBanner.body && <p className="text-sm mb-3 opacity-80 whitespace-pre-line">{state.ctaBanner.body}</p>}
            {state.ctaBanner.ctaText && (
              <button className="px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900">{state.ctaBanner.ctaText}</button>
            )}
          </SectionFrame>
        )}

        {state.showContactForm && (
          <div data-section="contactForm" className="relative border-t border-gray-100" onClick={() => onSectionClick?.('contactForm')}>
            <span className="absolute top-2 right-3 text-[10px] uppercase tracking-wider text-gray-300 bg-white px-1.5 py-0.5 rounded z-10">Kontaktformulär</span>
            <ContactFormPreview state={state.contactForm} />
          </div>
        )}

        {!state.showHero && !state.showTextImageA && !state.showTextImageB && !state.showTextOnly && !state.showFaq && !state.showTeamGrid && !state.showPartnersMarquee && !state.showTestimonialCard && !state.showCtaBanner && !state.showContactForm && (
          <div className="p-12 text-center text-sm text-gray-400">
            Inga sektioner aktiverade. Toggla &quot;Visa&quot; på panelerna till höger.
          </div>
        )}
      </div>
    </div>
  );
}

function SectionFrame({
  id,
  label,
  theme,
  children,
  onSectionClick,
}: {
  id: string;
  label: string;
  theme: 'dark' | 'light';
  children: React.ReactNode;
  onSectionClick?: (id: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <div data-section={id} className="relative border-t border-gray-100" onClick={() => onSectionClick?.(id)}>
      <span className="absolute top-2 right-3 text-[10px] uppercase tracking-wider text-gray-300 bg-white px-1.5 py-0.5 rounded z-10">{label}</span>
      <div className={`p-6 ${dark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        {children}
      </div>
    </div>
  );
}

function TextImageBlock({
  id,
  label,
  h2,
  body,
  theme,
  reversed,
  image,
  onSectionClick,
}: {
  id: string;
  label: string;
  h2: string;
  body: string;
  theme: 'dark' | 'light';
  reversed: boolean;
  image: string;
  onSectionClick?: (id: string) => void;
}) {
  return (
    <SectionFrame id={id} label={label} theme={theme} onSectionClick={onSectionClick}>
      <div className={`grid grid-cols-2 gap-4 items-center ${reversed ? 'direction-rtl' : ''}`}>
        <div className={reversed ? 'col-start-2' : ''}>
          {h2 && <h2 className="text-xl font-medium mb-2">{h2}</h2>}
          <p className="text-sm opacity-80 whitespace-pre-line">{body}</p>
        </div>
        <div className={`bg-gray-100 rounded h-32 flex items-center justify-center text-xs text-gray-400 ${reversed ? 'col-start-1 row-start-1' : ''}`}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="max-h-full max-w-full object-contain rounded" />
          ) : (
            'Bild saknas'
          )}
        </div>
      </div>
    </SectionFrame>
  );
}
