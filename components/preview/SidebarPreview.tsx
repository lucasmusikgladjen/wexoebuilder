'use client';

import { PageState } from '@/lib/types';
import { renderInlineMarkdown } from '@/lib/markdown';
import { useLinkedRecord } from '@/lib/linked-records-cache';

interface Props {
  state: PageState;
}

export default function SidebarPreview({ state }: Props) {
  const mainColor = state.colorMain;
  const secondaryColor = state.colorSecondary;

  if (state.sidebarType === 'case') return <CaseSidebar state={state} mainColor={mainColor} secondaryColor={secondaryColor} />;
  if (state.sidebarType === 'event') return <EventSidebar state={state} mainColor={mainColor} secondaryColor={secondaryColor} />;
  if (state.sidebarType === 'leadmagnet') return <LeadMagnetSidebar state={state} mainColor={mainColor} secondaryColor={secondaryColor} />;
  if (state.sidebarType === 'calculator') return <CalculatorSidebar state={state} mainColor={mainColor} />;
  return <div className="text-sm text-gray-400 italic p-4">Välj sidebar-typ...</div>;
}

function CaseSidebar({ state, mainColor, secondaryColor }: { state: PageState; mainColor: string; secondaryColor: string }) {
  const c = useLinkedRecord('cases', state.caseId);

  if (!state.caseId) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
        Inget kundcase valt — välj ett i sidebar-inställningarna.
      </div>
    );
  }

  const title = (c?.card_title as string) || (c?.title as string) || 'Kundcase';
  const image = (c?.card_image_url as string) || '';
  const desc = (c?.card_description as string) || '';
  const result = (c?.card_result as string) || '';
  const cta = (c?.card_cta_text as string) || '';

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 text-white text-sm font-semibold" style={{ background: mainColor }}>
        {title}
      </div>
      {image && (
        <img src={image} alt="" className="w-full h-36 object-cover" />
      )}
      <div className="p-4 space-y-3">
        {desc && (
          <p className="text-xs text-lp-text-light leading-relaxed">
            {renderInlineMarkdown(desc)}
          </p>
        )}
        {result && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-green-600 font-bold mt-px">▸</span>
            <span>{renderInlineMarkdown(result)}</span>
          </div>
        )}
        {cta && (
          <span className="inline-block px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ background: secondaryColor }}>
            {cta}
          </span>
        )}
      </div>
    </div>
  );
}

function EventSidebar({ state, mainColor, secondaryColor }: { state: PageState; mainColor: string; secondaryColor: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 text-white text-sm font-semibold" style={{ background: mainColor }}>
        {state.eventType ? state.eventType.charAt(0).toUpperCase() + state.eventType.slice(1) : 'Event'}
      </div>
      <div className="p-4 space-y-3">
        <h4 className="font-semibold text-sm" style={{ color: mainColor }}>{state.eventTitle || 'Event-titel'}</h4>
        {state.eventDescription && (
          <p className="text-xs text-lp-text-light leading-relaxed">
            {renderInlineMarkdown(state.eventDescription)}
          </p>
        )}
        <div className="flex gap-3 text-xs text-lp-text-light">
          {state.eventDate && <span>📅 {state.eventDate}</span>}
          {state.eventLocation && <span>📍 {state.eventLocation}</span>}
        </div>
        <span className="inline-block px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ background: secondaryColor }}>
          Anmäl dig
        </span>
      </div>
    </div>
  );
}

function LeadMagnetSidebar({ state, mainColor, secondaryColor }: { state: PageState; mainColor: string; secondaryColor: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 text-white text-sm font-semibold" style={{ background: mainColor }}>
        {state.magnetTitle || 'Ladda ner'}
      </div>
      <div className="p-4 space-y-3">
        {state.magnetFormat && (
          <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-lp-text-light">
            {state.magnetFormat}
          </span>
        )}
        {state.magnetDescription && (
          <p className="text-xs text-lp-text-light leading-relaxed">
            {renderInlineMarkdown(state.magnetDescription)}
          </p>
        )}
        <div className="space-y-2">
          <input type="text" placeholder="Ditt namn" className="w-full px-3 py-1.5 border border-gray-200 rounded text-xs" readOnly />
          <input type="email" placeholder="Din e-post" className="w-full px-3 py-1.5 border border-gray-200 rounded text-xs" readOnly />
          <span className="block w-full text-center px-4 py-1.5 rounded text-xs font-semibold text-white" style={{ background: secondaryColor }}>
            Ladda ner
          </span>
        </div>
      </div>
    </div>
  );
}

function CalculatorSidebar({ state, mainColor }: { state: PageState; mainColor: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 text-white text-sm font-semibold" style={{ background: mainColor }}>
        {state.calcTitle || 'Kalkylator'}
      </div>
      <div className="p-4">
        {state.calcHtml ? (
          <div className="text-xs text-lp-text-light border border-dashed border-gray-300 rounded p-3 bg-gray-50">
            <span className="text-gray-400">[Kalkylator-HTML renderas här]</span>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Ingen HTML-kod ännu...</p>
        )}
      </div>
    </div>
  );
}
