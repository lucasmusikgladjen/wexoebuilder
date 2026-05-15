'use client';

import { useRef, useEffect } from 'react';
import { PageState, PageAction, SectionId } from '@/lib/types';
import HeroEditor from './editors/HeroEditor';
import ContentEditor from './editors/ContentEditor';
import SidebarEditor from './editors/SidebarEditor';
import TabsEditor from './editors/TabsEditor';
import ContactEditor from './editors/ContactEditor';
import ContactFormSection from './contact-form/ContactFormSection';

interface Props {
  state: PageState;
  dispatch: React.Dispatch<PageAction>;
  activeSection: SectionId | null;
  onSectionClick: (section: SectionId) => void;
  onSectionFocus: (section: SectionId) => void;
}

export default function EditorPanel({ state, dispatch, activeSection, onSectionClick, onSectionFocus }: Props) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollDetectedRef = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // Auto-scroll editor to active section (skip when triggered by scroll detection)
  useEffect(() => {
    if (scrollDetectedRef.current) {
      scrollDetectedRef.current = false;
      return;
    }
    if (activeSection && sectionRefs.current[activeSection]) {
      isProgrammaticScroll.current = true;
      sectionRefs.current[activeSection]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 500);
    }
  }, [activeSection]);

  // Detect which section is visible when user scrolls the editor
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;

      const sectionIds: SectionId[] = ['hero', 'content', 'sidebar', 'tabs', 'contact', 'contactForm'];

      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      if (nearBottom) {
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          if (sectionRefs.current[sectionIds[i]]) {
            if (sectionIds[i] !== activeSectionRef.current) {
              scrollDetectedRef.current = true;
              onSectionClick(sectionIds[i]);
            }
            return;
          }
        }
      }

      const containerTop = container.getBoundingClientRect().top;
      let closestSection: SectionId | null = null;
      let closestDistance = Infinity;

      for (const id of sectionIds) {
        const el = sectionRefs.current[id];
        if (el) {
          const distance = Math.abs(el.getBoundingClientRect().top - containerTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestSection = id;
          }
        }
      }

      if (closestSection && closestSection !== activeSectionRef.current) {
        scrollDetectedRef.current = true;
        onSectionClick(closestSection);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onSectionClick]);

  const sections: { id: SectionId; label: string }[] = [
    { id: 'hero', label: 'Hero' },
    { id: 'content', label: 'Innehåll' },
    { id: 'sidebar', label: 'Sidebar' },
    { id: 'tabs', label: 'Tabs' },
    { id: 'contact', label: 'Visitkort' },
    { id: 'contactForm', label: 'Kontaktform' },
  ];

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-100">
      {/* Section quick-nav */}
      <div className="flex px-3 py-2 gap-0.5 flex-shrink-0 overflow-x-auto border-b border-gray-100">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSectionClick(s.id)}
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

      {/* Editor sections */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto editor-panel p-4 space-y-10">
        <div
          ref={(el) => { sectionRefs.current.hero = el; }}
          className="cursor-pointer"
          onClick={() => onSectionClick('hero')}
          onFocusCapture={() => onSectionFocus('hero')}
        >
          <HeroEditor state={state} dispatch={dispatch} />
        </div>

        <div
          ref={(el) => { sectionRefs.current.content = el; }}
          className="cursor-pointer"
          onClick={() => onSectionClick('content')}
          onFocusCapture={() => onSectionFocus('content')}
        >
          <ContentEditor state={state} dispatch={dispatch} />
        </div>

        <div
          ref={(el) => { sectionRefs.current.sidebar = el; }}
          className="cursor-pointer"
          onClick={() => onSectionClick('sidebar')}
          onFocusCapture={() => onSectionFocus('sidebar')}
        >
          <SidebarEditor state={state} dispatch={dispatch} />
        </div>

        <div
          ref={(el) => { sectionRefs.current.tabs = el; }}
          className="cursor-pointer"
          onClick={() => onSectionClick('tabs')}
          onFocusCapture={() => onSectionFocus('tabs')}
        >
          <TabsEditor state={state} dispatch={dispatch} />
        </div>

        <div
          ref={(el) => { sectionRefs.current.contact = el; }}
          className="cursor-pointer"
          onClick={() => onSectionClick('contact')}
          onFocusCapture={() => onSectionFocus('contact')}
        >
          <ContactEditor state={state} dispatch={dispatch} />
        </div>

        <div
          ref={(el) => { sectionRefs.current.contactForm = el; }}
          className="cursor-pointer"
          onClick={() => onSectionClick('contactForm')}
          onFocusCapture={() => onSectionFocus('contactForm')}
        >
          <ContactFormSection
            visible={state.showContactForm}
            onToggleVisible={(v) => dispatch({ type: 'SET_FIELD', field: 'showContactForm', value: v })}
            state={state.contactForm}
            onChange={(s) => dispatch({ type: 'SET_FIELD', field: 'contactForm', value: s })}
          />
        </div>
      </div>
    </div>
  );
}
