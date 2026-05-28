'use client';

/**
 * Live-preview för case-sidan. Speglar PHP-pluginets sektionsstruktur
 * (wexoe-case.php) men är en React-komponent — pixel-perfect är inte målet,
 * att redaktören ser HUR sidan kommer se ut är det.
 *
 * Render-ordning matchar pluginet:
 *   header → lead → stats → challenge → pullquote → solution-text →
 *   products → solution-image → results → testimonial → gallery →
 *   about-customer (+ sticky glance-sidebar i grid) → contact-form
 *
 * Linked-records (products + articles) fetchas lazy från samma cache som
 * `LinkedRecords`-pickern. Brand visas via supplier_ids → core_partners-lookup.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CaseState,
  CaseSectionId,
  CaseQuickStat,
  CaseResult,
  CaseGalleryImage,
} from '@/lib/case-types';
import { useScrollToActiveSection } from '@/hooks/useScrollToActiveSection';
import { renderMarkdown, renderInlineMarkdown } from '@/lib/markdown';
import {
  fetchLinkedRecords,
  type NormalizedLinkedRecord,
} from '@/lib/linked-records-cache';
import ContactFormPreview from '@/components/contact-form/ContactFormPreview';

interface Props {
  state: CaseState;
  activeSection: CaseSectionId | string | null;
  onSectionClick: (id: string) => void;
  scrollTrigger: number;
}

const COLORS = {
  main: '#11325D',
  secondary: '#F28C28',
  text: '#1a1a1a',
  muted: '#6B7280',
  rule: '#E5E7EB',
  bgSoft: '#F8F9FB',
  bgMid: '#F0F2F5',
};

/* ============================================================
   useCmsLinkedRecords — lazy fetch + supplier lookup
   ============================================================ */

interface LinkedItem {
  rec: NormalizedLinkedRecord;
  kind: 'product' | 'article';
}

function useCmsLinkedRecords(productIds: string[], articleIds: string[]): LinkedItem[] {
  // Fetchar HELA tabellerna (cache:n delas med pickern, så efter första
  // hit är det gratis). Filtreringen mot ids sker i useMemo nedan.
  const hasProducts = productIds.length > 0;
  const hasArticles = articleIds.length > 0;

  const [products, setProducts] = useState<NormalizedLinkedRecord[]>([]);
  const [articles, setArticles] = useState<NormalizedLinkedRecord[]>([]);

  useEffect(() => {
    if (!hasProducts) return;
    let alive = true;
    fetchLinkedRecords('products')
      .then((all) => alive && setProducts(all))
      .catch(() => { /* swallow — preview tolererar tom data */ });
    return () => { alive = false; };
  }, [hasProducts]);

  useEffect(() => {
    if (!hasArticles) return;
    let alive = true;
    fetchLinkedRecords('articles')
      .then((all) => alive && setArticles(all))
      .catch(() => { /* swallow */ });
    return () => { alive = false; };
  }, [hasArticles]);

  return useMemo<LinkedItem[]>(() => {
    const byId = (records: NormalizedLinkedRecord[]) => {
      const m = new Map<string, NormalizedLinkedRecord>();
      for (const r of records) m.set(r._recordId, r);
      return m;
    };
    const productMap = byId(products);
    const articleMap = byId(articles);
    // Visa produkter först, sedan artiklar — matchar render_products() i PHP.
    const productItems: LinkedItem[] = productIds
      .map((id) => productMap.get(id))
      .filter((r): r is NormalizedLinkedRecord => !!r && r.is_active !== false)
      .map((rec) => ({ rec, kind: 'product' as const }));
    const articleItems: LinkedItem[] = articleIds
      .map((id) => articleMap.get(id))
      .filter((r): r is NormalizedLinkedRecord => !!r && r.is_active !== false)
      .map((rec) => ({ rec, kind: 'article' as const }));
    return [...productItems, ...articleItems];
  }, [products, articles, productIds, articleIds]);
}

function usePartnerLookup(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    fetchLinkedRecords('core_partners')
      .then((records) => {
        if (!alive) return;
        const m = new Map<string, string>();
        for (const r of records) {
          const name = typeof r.name === 'string' ? r.name : '';
          if (name) m.set(r._recordId, name);
        }
        setMap(m);
      })
      .catch(() => { /* swallow */ });
    return () => { alive = false; };
  }, []);
  return map;
}

function truncate(s: string, max = 120): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + '…';
}

/* ============================================================
   PreviewSection wrapper
   ============================================================ */

interface SectionProps {
  id: CaseSectionId;
  active: string | null;
  onClick: (id: string) => void;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

function PreviewSection({ id, active, onClick, style, className = '', children }: SectionProps) {
  const isActive = active === id;
  return (
    <section
      data-section={id}
      onClick={(e) => {
        e.stopPropagation();
        onClick(id);
      }}
      style={style}
      className={`preview-section ${isActive ? 'active' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

/* ============================================================
   Main component
   ============================================================ */

export default function CasePreviewPanel({
  state,
  activeSection,
  onSectionClick,
  scrollTrigger,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollToActiveSection(pageRef, activeSection, scrollTrigger);
  const active = activeSection as string | null;

  const linkedItems = useCmsLinkedRecords(state.productIds, state.articleIds);
  const partnerNames = usePartnerLookup();

  const isEmpty = !state.title.trim() && !state.subtitle.trim() && !state.leadParagraph.trim();

  // Lines-fält till array.
  const headerLogoUrls = state.headerLogos.split('\n').map((s) => s.trim()).filter(Boolean);
  const challengeBulletItems = state.challengeBullets.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="h-full overflow-y-auto bg-gray-100 hide-scrollbar">
      <div
        ref={pageRef}
        className="builder-preview-canvas mx-auto my-4 shadow-lg rounded-lg overflow-hidden bg-white"
      >
        {/* Browser-chrome */}
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

        <div style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif', color: COLORS.text, fontSize: 14, lineHeight: 1.6 }}>
          {/* ============== HEADER ============== */}
          <PreviewSection
            id="header"
            active={active}
            onClick={onSectionClick}
            style={{ background: COLORS.main, color: '#fff', padding: '32px 40px 28px' }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 700,
              letterSpacing: 1.4, textTransform: 'uppercase', color: COLORS.secondary, marginBottom: 18,
            }}>
              <span>Kundcase</span>
              {state.industry && (
                <>
                  <span style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.3)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, letterSpacing: 1 }}>
                    {state.industry}
                  </span>
                </>
              )}
            </div>

            <h1 style={{
              fontSize: 28, fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.02em',
              margin: '0 0 14px', color: '#fff',
              opacity: state.title ? 1 : 0.45,
            }}>
              {state.title || 'Din rubrik här'}
            </h1>

            {state.subtitle && (
              <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', margin: '0 0 22px', maxWidth: 700 }}>
                {state.subtitle}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 12 }}>
              {([
                ['Kund', state.customerName],
                ['Plats', state.location],
                ['År', state.projectYear],
                ['Projekttyp', state.projectType],
                ['Lästid', state.readingTime],
              ] as const).filter(([, v]) => !!v).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                    {label}
                  </span>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              {headerLogoUrls.length > 0 && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {headerLogoUrls.map((url, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.95)', padding: '6px 10px', borderRadius: 3, height: 32, display: 'flex', alignItems: 'center',
                    }}>
                      <img src={url} alt="" style={{ height: 20, maxWidth: 80, objectFit: 'contain', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PreviewSection>

          {/* ============== ARTICLE GRID ============== */}
          <div style={{ padding: '32px 40px 40px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 32, alignItems: 'start' }}>
            <main style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

                {/* ============== LEAD ============== */}
                <PreviewSection id="lead" active={active} onClick={onSectionClick}>
                  {state.leadImageUrl && (
                    <figure style={{ margin: '0 0 20px' }}>
                      <img src={state.leadImageUrl} alt="" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 4 }} />
                      {state.leadImageCaption && (
                        <figcaption style={{ fontSize: 11, color: COLORS.muted, fontStyle: 'italic', marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${COLORS.rule}` }}>
                          {state.leadImageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}
                  {state.leadParagraph && (
                    <div style={{ fontSize: 15, lineHeight: 1.65, color: '#2a2a2a' }}>
                      <DropCapWrapper>{renderMarkdown(state.leadParagraph)}</DropCapWrapper>
                    </div>
                  )}
                  {!state.leadImageUrl && !state.leadParagraph && (
                    <Placeholder label="Lead — bild + ingresstext" />
                  )}
                </PreviewSection>

                {/* ============== STATS STRIP ============== */}
                {state.showStatsStrip && state.quickStats.length > 0 && (
                  <PreviewSection id="statsStrip" active={active} onClick={onSectionClick}>
                    <StatsRow stats={state.quickStats} large={false} />
                  </PreviewSection>
                )}

                {/* ============== CHALLENGE ============== */}
                <PreviewSection id="challenge" active={active} onClick={onSectionClick}>
                  <SectionEyebrow>{state.challengeEyebrow || 'Utmaningen'}</SectionEyebrow>
                  {state.challengeTitle ? (
                    <SectionH2>{state.challengeTitle}</SectionH2>
                  ) : (
                    <Placeholder label="Challenge — H2 + brödtext" inline />
                  )}
                  {state.challengeText && (
                    <SectionBody>{renderMarkdown(state.challengeText)}</SectionBody>
                  )}
                  {challengeBulletItems.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0' }}>
                      {challengeBulletItems.map((b, i) => (
                        <li key={i} style={{ position: 'relative', paddingLeft: 24, marginBottom: 8, lineHeight: 1.55, fontSize: 14 }}>
                          <span style={{ position: 'absolute', left: 0, top: 0, color: COLORS.secondary, fontWeight: 700 }}>→</span>
                          {renderInlineMarkdown(b)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {state.challengeImageUrl && (
                    <InlineImage url={state.challengeImageUrl} caption={state.challengeImageCaption} />
                  )}
                </PreviewSection>

                {/* ============== PULLQUOTE ============== */}
                {state.showPullquote && state.pullquoteText && (
                  <PreviewSection id="pullquote" active={active} onClick={onSectionClick}>
                    <aside style={{ padding: '4px 0 4px 20px', borderLeft: `4px solid ${COLORS.secondary}`, margin: '12px 0' }}>
                      <blockquote style={{
                        fontStyle: 'italic', fontSize: 19, lineHeight: 1.4, fontWeight: 500,
                        color: COLORS.main, margin: '0 0 10px',
                      }}>
                        {renderInlineMarkdown(state.pullquoteText)}
                      </blockquote>
                      {state.pullquoteAttribution && (
                        <div style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: 1.3,
                          textTransform: 'uppercase', color: COLORS.muted,
                        }}>
                          {state.pullquoteAttribution}
                        </div>
                      )}
                    </aside>
                  </PreviewSection>
                )}

                {/* ============== SOLUTION (text) ============== */}
                <PreviewSection id="solution" active={active} onClick={onSectionClick}>
                  <SectionEyebrow>{state.solutionEyebrow || 'Lösningen'}</SectionEyebrow>
                  {state.solutionTitle ? (
                    <SectionH2>{state.solutionTitle}</SectionH2>
                  ) : (
                    <Placeholder label="Solution — H2 + brödtext" inline />
                  )}
                  {state.solutionText && (
                    <SectionBody>{renderMarkdown(state.solutionText)}</SectionBody>
                  )}
                </PreviewSection>

                {/* ============== PRODUCTS ============== */}
                {linkedItems.length > 0 && (
                  <PreviewSection id="products" active={active} onClick={onSectionClick}>
                    <ProductsBox
                      title={state.productsTitle || 'Produkter i lösningen'}
                      meta={state.productsMeta}
                      items={linkedItems}
                      partnerNames={partnerNames}
                    />
                  </PreviewSection>
                )}
                {linkedItems.length === 0 && (state.productIds.length > 0 || state.articleIds.length > 0) && (
                  <PreviewSection id="products" active={active} onClick={onSectionClick}>
                    <Placeholder label={`Produkter (${state.productIds.length + state.articleIds.length} valda) — laddar…`} />
                  </PreviewSection>
                )}

                {/* ============== SOLUTION IMAGE ============== */}
                {state.solutionImageUrl && (
                  <InlineImage url={state.solutionImageUrl} caption={state.solutionImageCaption} />
                )}

                {/* ============== RESULTS ============== */}
                <PreviewSection id="results" active={active} onClick={onSectionClick}>
                  <SectionEyebrow>{state.resultsEyebrow || 'Resultatet'}</SectionEyebrow>
                  {state.resultsTitle ? (
                    <SectionH2>{state.resultsTitle}</SectionH2>
                  ) : (
                    <Placeholder label="Results — H2 + brödtext + siffror" inline />
                  )}
                  {state.resultsText && (
                    <SectionBody>{renderMarkdown(state.resultsText)}</SectionBody>
                  )}
                  {state.results.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <StatsRow stats={state.results} large />
                    </div>
                  )}
                </PreviewSection>

                {/* ============== TESTIMONIAL ============== */}
                {state.showTestimonial && (state.testimonialQuote || state.testimonialAuthorName) && (
                  <PreviewSection id="testimonial" active={active} onClick={onSectionClick}>
                    <aside style={{
                      padding: '22px 24px 20px', background: COLORS.bgSoft,
                      borderLeft: `4px solid ${COLORS.main}`,
                    }}>
                      {state.testimonialQuote && (
                        <blockquote style={{
                          fontStyle: 'italic', fontSize: 15, lineHeight: 1.55, fontWeight: 500,
                          color: COLORS.main, margin: '0 0 16px', position: 'relative',
                        }}>
                          {renderInlineMarkdown(state.testimonialQuote)}
                        </blockquote>
                      )}
                      {(state.testimonialAuthorName || state.testimonialPhotoUrl) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {state.testimonialPhotoUrl ? (
                            <img src={state.testimonialPhotoUrl} alt="" style={{
                              width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: COLORS.bgMid,
                            }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: COLORS.bgMid }} />
                          )}
                          <div>
                            {state.testimonialAuthorName && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.main }}>
                                {state.testimonialAuthorName}
                              </div>
                            )}
                            {state.testimonialAuthorTitle && (
                              <div style={{ fontSize: 11, color: COLORS.muted }}>
                                {state.testimonialAuthorTitle}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </aside>
                  </PreviewSection>
                )}

                {/* ============== GALLERY ============== */}
                {state.showGallery && state.galleryImages.length > 0 && (
                  <PreviewSection id="gallery" active={active} onClick={onSectionClick}>
                    {state.galleryTitle && (
                      <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: COLORS.main, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
                        {state.galleryTitle}
                      </h3>
                    )}
                    <Gallery images={state.galleryImages} />
                  </PreviewSection>
                )}

                {/* ============== ABOUT CUSTOMER ============== */}
                {state.showAboutCustomer && (state.aboutCustomerTitle || state.aboutCustomerText || state.aboutCustomerLogoUrl) && (
                  <PreviewSection
                    id="aboutCustomer"
                    active={active}
                    onClick={onSectionClick}
                    style={{ marginTop: 18, paddingTop: 20, borderTop: `1px solid ${COLORS.rule}` }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: state.aboutCustomerLogoUrl ? '100px 1fr' : '1fr',
                      gap: 20, alignItems: 'start',
                    }}>
                      {state.aboutCustomerLogoUrl && (
                        <img src={state.aboutCustomerLogoUrl} alt="" style={{
                          maxHeight: 48, maxWidth: 100, objectFit: 'contain', objectPosition: 'left center',
                        }} />
                      )}
                      <div>
                        {state.aboutCustomerTitle && (
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.main, margin: '0 0 8px' }}>
                            {state.aboutCustomerTitle}
                          </h3>
                        )}
                        {state.aboutCustomerText && (
                          <SectionBody small>{renderMarkdown(state.aboutCustomerText)}</SectionBody>
                        )}
                        {state.aboutCustomerUrl && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, color: COLORS.main,
                            borderBottom: `2px solid ${COLORS.secondary}`, paddingBottom: 1, marginTop: 8,
                          }}>
                            {state.aboutCustomerLinkLabel || 'Läs mer'} <span>→</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </PreviewSection>
                )}
              </div>
            </main>

            {/* ============== GLANCE SIDEBAR ============== */}
            <PreviewSection
              id="glance"
              active={active}
              onClick={onSectionClick}
              style={{
                position: 'sticky', top: 16,
                background: COLORS.bgSoft, borderTop: `4px solid ${COLORS.secondary}`,
                padding: '20px 20px 22px',
              }}
            >
              <h3 style={{
                fontSize: 14, fontWeight: 700, color: COLORS.main, margin: '0 0 16px',
                paddingBottom: 12, borderBottom: `1px solid ${COLORS.rule}`, letterSpacing: '-0.01em',
              }}>
                Caset i korthet
              </h3>
              {([
                ['Utmaning', state.glanceChallenge],
                ['Lösning', state.glanceSolution],
                ['Resultat', state.glanceResult],
              ] as const).map(([label, value]) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                    textTransform: 'uppercase', color: COLORS.secondary, marginBottom: 6,
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.55, color: COLORS.text }}>
                    {value ? renderInlineMarkdown(value) : (
                      <span style={{ color: COLORS.muted, fontStyle: 'italic' }}>(tom)</span>
                    )}
                  </div>
                </div>
              ))}
            </PreviewSection>
          </div>

          {/* ============== CONTACT FORM ============== */}
          {state.showContactForm && (
            <PreviewSection id="contactForm" active={active} onClick={onSectionClick}>
              <ContactFormPreview state={state.contactForm} />
            </PreviewSection>
          )}
        </div>

        {isEmpty && (
          <div className="px-8 py-10 text-center text-gray-400 border-t border-gray-100">
            <p className="text-sm mb-1">Börja bygga ditt case</p>
            <p className="text-xs">Fyll i fälten till höger — förhandsvisningen uppdateras direkt.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Small inline helpers
   ============================================================ */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
      color: COLORS.secondary, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ display: 'inline-block', width: 24, height: 2, background: COLORS.secondary }} />
      {children}
    </div>
  );
}

function SectionH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: COLORS.main,
      margin: '0 0 18px', letterSpacing: '-0.015em',
    }}>
      {children}
    </h2>
  );
}

function SectionBody({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div style={{
      fontSize: small ? 13 : 14, lineHeight: 1.7, color: '#2a2a2a',
    }}>
      {children}
    </div>
  );
}

function DropCapWrapper({ children }: { children: React.ReactNode }) {
  // Render-trick: vi använder en CSS-klass via inline-style. Reaktiv CSS för
  // ::first-letter kräver en class, så vi inkluderar en liten stilblock här.
  return (
    <>
      <style>{`
        .case-preview-leadpara > p:first-of-type::first-letter {
          font-weight: 700;
          font-size: 2.4rem;
          float: left;
          line-height: 0.95;
          padding: 4px 10px 0 0;
          color: ${COLORS.main};
          letter-spacing: -0.04em;
        }
      `}</style>
      <div className="case-preview-leadpara">{children}</div>
    </>
  );
}

function InlineImage({ url, caption }: { url: string; caption: string }) {
  return (
    <figure style={{ margin: '14px 0 0' }}>
      <img src={url} alt="" style={{ width: '100%', borderRadius: 4 }} />
      {caption && (
        <figcaption style={{ fontSize: 11, color: COLORS.muted, fontStyle: 'italic', marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${COLORS.rule}` }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function StatsRow({ stats, large }: { stats: Array<CaseQuickStat | CaseResult>; large: boolean }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', padding: '20px 0',
      borderTop: `1px solid ${COLORS.rule}`, borderBottom: `1px solid ${COLORS.rule}`,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          flex: '1 1 0', minWidth: 100, padding: i === 0 ? '0 18px 0 0' : '0 18px',
          borderLeft: i === 0 ? 'none' : `1px solid ${COLORS.rule}`,
        }}>
          <div style={{
            fontSize: large ? 22 : 18, fontWeight: 700, color: COLORS.main,
            letterSpacing: '-0.025em', lineHeight: 1, marginBottom: 4,
          }}>
            {s.value || '—'}
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 500, lineHeight: 1.4 }}>
            {s.label || ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function Gallery({ images }: { images: CaseGalleryImage[] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14,
    }}>
      {images.map((img, i) => {
        const isWide = i % 3 === 0;
        return (
          <figure key={i} style={{ margin: 0, gridColumn: isWide ? 'span 2' : 'span 1' }}>
            {img.url ? (
              <img src={img.url} alt="" style={{
                width: '100%', aspectRatio: isWide ? '16 / 9' : '4 / 3',
                objectFit: 'cover', borderRadius: 4,
              }} />
            ) : (
              <div style={{
                width: '100%', aspectRatio: isWide ? '16 / 9' : '4 / 3',
                background: COLORS.bgMid, borderRadius: 4, display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: COLORS.muted, fontSize: 11,
              }}>
                (ingen URL)
              </div>
            )}
            {img.caption && (
              <figcaption style={{ fontSize: 11, color: COLORS.muted, fontStyle: 'italic', marginTop: 6, paddingLeft: 8, borderLeft: `2px solid ${COLORS.rule}` }}>
                {img.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}

function ProductsBox({
  title, meta, items, partnerNames,
}: {
  title: string;
  meta: string;
  items: LinkedItem[];
  partnerNames: Map<string, string>;
}) {
  return (
    <section style={{
      border: `1px solid ${COLORS.rule}`, borderRadius: 6, overflow: 'hidden',
      background: COLORS.rule, // visas genom 1px-gap som hairlines
    }}>
      <header style={{
        padding: '12px 18px', background: COLORS.bgSoft, borderBottom: `1px solid ${COLORS.rule}`,
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14,
      }}>
        <h3 style={{
          fontSize: 10, fontWeight: 700, color: COLORS.main, textTransform: 'uppercase',
          letterSpacing: 1.4, margin: 0, lineHeight: 1.4,
        }}>
          {title}
        </h3>
        {meta && (
          <span style={{
            fontSize: 9, fontWeight: 500, letterSpacing: 0.5,
            color: COLORS.muted, textTransform: 'uppercase',
          }}>
            {meta}
          </span>
        )}
      </header>
      <div style={{
        display: 'grid',
        gridTemplateColumns: items.length === 1 ? '1fr' : '1fr 1fr',
        gap: 1,
      }}>
        {items.map(({ rec, kind }) => {
          const name = (rec.name as string) || '(namnlös)';
          const imageUrl = rec.image_url as string;
          const supplierIds = Array.isArray(rec.supplier_ids) ? (rec.supplier_ids as string[]) : [];
          const brand = supplierIds[0] ? partnerNames.get(supplierIds[0]) || '' : '';
          const description = (rec.description as string) || '';
          const articleNumber = kind === 'article' ? (rec.article_number as string) || '' : '';
          return (
            <div key={rec._recordId} style={{
              display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '14px 16px',
            }}>
              {imageUrl ? (
                <img src={imageUrl} alt="" style={{
                  width: 44, height: 44, objectFit: 'contain', background: COLORS.bgSoft,
                  borderRadius: 4, padding: 5, flexShrink: 0,
                }} />
              ) : (
                <div style={{
                  width: 44, height: 44, background: COLORS.bgSoft, borderRadius: 4, flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {brand && (
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
                    color: COLORS.secondary, marginBottom: 2,
                  }}>
                    {brand}
                  </div>
                )}
                <div style={{
                  fontSize: 13, fontWeight: 600, margin: 0, color: COLORS.main, lineHeight: 1.3,
                  marginBottom: articleNumber || description ? 2 : 0,
                }}>
                  {name}
                </div>
                {articleNumber && (
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 3, letterSpacing: 0.3 }}>
                    Art.nr {articleNumber}
                  </div>
                )}
                {description && (
                  <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.45, margin: 0 }}>
                    {truncate(description, 120)}
                  </p>
                )}
              </div>
              <span style={{ color: COLORS.rule, fontSize: 14, flexShrink: 0 }}>→</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Placeholder({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <div style={{
      padding: inline ? '8px 12px' : '24px',
      border: `1px dashed ${COLORS.rule}`,
      borderRadius: 4,
      color: COLORS.muted,
      fontSize: 12,
      fontStyle: 'italic',
      textAlign: inline ? 'left' : 'center',
    }}>
      {label}
    </div>
  );
}
