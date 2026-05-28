'use client';

import { useRef, useEffect } from 'react';
import { PageState, SectionId } from '@/lib/types';
import HeroPreview from './preview/HeroPreview';
import ContentPreview from './preview/ContentPreview';
import TabsPreview from './preview/TabsPreview';
import ContactPreview from './preview/ContactPreview';
import ContactFormPreview from './contact-form/ContactFormPreview';

interface Props {
  state: PageState;
  activeSection: SectionId | null;
  onSectionClick: (section: SectionId) => void;
  scrollTrigger: number;
}

export default function PreviewPanel({ state, activeSection, onSectionClick, scrollTrigger }: Props) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const target = activeSection === 'sidebar' ? 'content' : activeSection;
    if (target && sectionRefs.current[target]) {
      sectionRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSection, scrollTrigger]);

  return (
    <div className="h-full overflow-y-auto bg-gray-100 hide-scrollbar">
      <div className="builder-preview-canvas mx-auto my-4 shadow-lg rounded-lg overflow-hidden bg-white">
        {/* Preview label */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-gray-400 ml-2">
            wexoe.se/kampanj/{state.slug || '...'}/ — Preview
          </span>
        </div>

        {/* Hero */}
        <div
          ref={(el) => { sectionRefs.current.hero = el; }}
          className={`preview-section ${activeSection === 'hero' ? 'active' : ''}`}
          onClick={() => onSectionClick('hero')}
        >
          <HeroPreview state={state} />
        </div>

        {/* Content + Sidebar */}
        {(state.showContent || (state.showSidebar && state.sidebarType)) && (
          <div
            ref={(el) => { sectionRefs.current.content = el; }}
            className={`preview-section ${activeSection === 'content' ? 'active' : ''}`}
            onClick={() => onSectionClick('content')}
          >
            <ContentPreview
              state={state}
              onClickSidebar={() => onSectionClick('sidebar')}
              sidebarActive={activeSection === 'sidebar'}
            />
          </div>
        )}

        {/* Tabs */}
        {state.showTabs && state.tabs.length > 0 && (
          <div
            ref={(el) => { sectionRefs.current.tabs = el; }}
            className={`preview-section ${activeSection === 'tabs' ? 'active' : ''}`}
            onClick={() => onSectionClick('tabs')}
          >
            <TabsPreview state={state} />
          </div>
        )}

        {/* Contact */}
        {state.showContact && (
          <div
            ref={(el) => { sectionRefs.current.contact = el; }}
            className={`preview-section ${activeSection === 'contact' ? 'active' : ''}`}
            onClick={() => onSectionClick('contact')}
          >
            <ContactPreview state={state} />
          </div>
        )}

        {/* Contact form */}
        {state.showContactForm && (
          <div
            ref={(el) => { sectionRefs.current.contactForm = el; }}
            className={`preview-section ${activeSection === 'contactForm' ? 'active' : ''}`}
            onClick={() => onSectionClick('contactForm')}
          >
            <ContactFormPreview state={state.contactForm} />
          </div>
        )}

        {/* Empty state */}
        {!state.h1 && !state.contentH2 && state.tabs.length === 0 && !state.contactName && (
          <div className="px-8 py-16 text-center text-gray-400">
            <p className="text-lg mb-1">Börja bygga din sida</p>
            <p className="text-sm">Klicka på en sektion i panelen till höger för att redigera.</p>
          </div>
        )}
      </div>
    </div>
  );
}
