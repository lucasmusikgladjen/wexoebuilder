'use client';

import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import Link from 'next/link';

export interface BuilderShellQuickNavItem {
  id: string;
  label: string;
}

export interface BuilderShellToolbarProps {
  /** Optional left-side block rendered between the back-link and the right cluster. */
  left?: ReactNode;
  /** Optional middle slot (status banners, labels, etc.). */
  middle?: ReactNode;
  /** Right-side block — typically the publish/save button. */
  right?: ReactNode;
  /** URL the "back" link points to. Default: `/`. */
  backHref?: string;
  /** Label next to the back arrow. Default: "Sidor". */
  backLabel?: string;
}

export interface BuilderShellProps {
  toolbar: BuilderShellToolbarProps;
  /** Quick-nav items rendered above the editor panel. */
  quickNav?: BuilderShellQuickNavItem[];
  /** Currently active section id (for highlighting + scroll-sync). */
  activeSection?: string | null;
  /** Called when user clicks a quick-nav pill or one of the section refs in the editor. */
  onActiveSectionChange?: (id: string) => void;
  /** The preview pane (left column, ~65% width). */
  previewPanel: ReactNode;
  /** Render the editor sections. Receives ref-setter so BuilderShell can do scroll-sync. */
  editorSections: (helpers: {
    sectionRef: (id: string) => (el: HTMLDivElement | null) => void;
    onSectionFocus: (id: string) => void;
  }) => ReactNode;
}

/**
 * BuilderShell — shared layout for builder pages (Audience, LP, PA, UniquePage,
 * /globals/*). Owns:
 *   - Top toolbar (back link, slug input slot, status, save button)
 *   - Split layout (65% preview, 35% editor)
 *   - Quick-nav pills row above editor
 *   - Scroll-sync between editor section refs and active-section state
 *
 * Caller is responsible for the actual editor / preview content and for the
 * data flow (state, save handlers). BuilderShell only handles plumbing.
 */
export default function BuilderShell({
  toolbar,
  quickNav,
  activeSection,
  onActiveSectionChange,
  previewPanel,
  editorSections,
}: BuilderShellProps) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollDetectedRef = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);
  const [internalScrollTrigger, setInternalScrollTrigger] = useState(0);

  // Programmatic scroll-into-view on activeSection change (unless caused by a scroll event).
  useEffect(() => {
    if (scrollDetectedRef.current) {
      scrollDetectedRef.current = false;
      return;
    }
    if (activeSection && sectionRefs.current[activeSection]) {
      isProgrammaticScroll.current = true;
      sectionRefs.current[activeSection]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 500);
    }
  }, [activeSection, internalScrollTrigger]);

  // Scroll listener — update active section based on which one is closest to top.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !quickNav || quickNav.length === 0) return;

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;
      const sectionIds = quickNav.map((s) => s.id);

      const nearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      if (nearBottom) {
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          if (sectionRefs.current[sectionIds[i]]) {
            if (sectionIds[i] !== activeSectionRef.current) {
              scrollDetectedRef.current = true;
              onActiveSectionChange?.(sectionIds[i]);
            }
            return;
          }
        }
      }

      const containerTop = container.getBoundingClientRect().top;
      let closest: string | null = null;
      let closestDistance = Infinity;
      for (const id of sectionIds) {
        const el = sectionRefs.current[id];
        if (el) {
          const distance = Math.abs(el.getBoundingClientRect().top - containerTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = id;
          }
        }
      }
      if (closest && closest !== activeSectionRef.current) {
        scrollDetectedRef.current = true;
        onActiveSectionChange?.(closest);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [quickNav, onActiveSectionChange]);

  const sectionRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el;
    },
    [],
  );

  const onSectionFocus = useCallback(
    (id: string) => {
      onActiveSectionChange?.(id);
      setInternalScrollTrigger((n) => n + 1);
    },
    [onActiveSectionChange],
  );

  const handleQuickNavClick = useCallback(
    (id: string) => {
      onActiveSectionChange?.(id);
      setInternalScrollTrigger((n) => n + 1);
    },
    [onActiveSectionChange],
  );

  const backHref = toolbar.backHref ?? '/';
  const backLabel = toolbar.backLabel ?? 'Sidor';

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily: 'var(--font-dm-sans)' }}>
      <header className="h-14 border-b border-gray-100 bg-white flex items-center px-4 gap-4 flex-shrink-0 z-10">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          title={`Tillbaka till ${backLabel.toLowerCase()}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">{backLabel}</span>
        </Link>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        {toolbar.left}

        <div className="flex-1" />

        {toolbar.middle}
        {toolbar.right}
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-[65] min-w-0">{previewPanel}</div>

        <div className="flex-[35] min-w-[380px] max-w-[520px] h-full flex flex-col bg-white border-l border-gray-100">
          {quickNav && quickNav.length > 0 && (
            <div className="flex flex-wrap px-3 py-2 gap-x-0.5 gap-y-1 flex-shrink-0 border-b border-gray-100">
              {quickNav.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleQuickNavClick(s.id)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors whitespace-nowrap ${
                    activeSection === s.id
                      ? 'bg-gray-100 text-gray-600'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto editor-panel p-4 space-y-10"
          >
            {editorSections({ sectionRef, onSectionFocus })}
          </div>
        </div>
      </div>
    </div>
  );
}
