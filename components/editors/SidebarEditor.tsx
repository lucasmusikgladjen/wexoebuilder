'use client';

import { PageState, PageAction, SidebarType } from '@/lib/types';
import { FieldInput, FieldTextarea, FieldSelect, FieldCheckbox } from './FieldInput';

interface Props {
  state: PageState;
  dispatch: React.Dispatch<PageAction>;
}

const sidebarOptions: { value: string; label: string }[] = [
  { value: '', label: '— Ingen sidebar —' },
  { value: 'case', label: 'Kundcase' },
  { value: 'calculator', label: 'Kalkylator' },
  { value: 'event', label: 'Event' },
  { value: 'leadmagnet', label: 'Lead Magnet' },
];

export default function SidebarEditor({ state, dispatch }: Props) {
  const set = (field: keyof PageState, value: unknown) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return (
    <div className="space-y-3">
      <FieldCheckbox
        label="Sidebar"
        checked={state.showSidebar}
        onChange={(v) => set('showSidebar', v)}
      />
      {state.showSidebar && (
        <>
          <FieldSelect
            label="Typ"
            value={state.sidebarType}
            onChange={(v) => set('sidebarType', v as SidebarType)}
            options={sidebarOptions}
          />
          {state.sidebarType === 'case' && <CaseFields state={state} set={set} />}
          {state.sidebarType === 'calculator' && <CalculatorFields state={state} set={set} />}
          {state.sidebarType === 'event' && <EventFields state={state} set={set} />}
          {state.sidebarType === 'leadmagnet' && <LeadMagnetFields state={state} set={set} />}
        </>
      )}
    </div>
  );
}

function CaseFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <FieldInput label="Titel" value={state.caseTitle} onChange={(v) => set('caseTitle', v)} placeholder="Kundcase: Företaget AB" />
      <FieldTextarea label="Beskrivning" value={state.caseDescription} onChange={(v) => set('caseDescription', v)} rows={3} placeholder="Kort beskrivning av caset..." />
      <FieldInput label="Bild" value={state.caseImage} onChange={(v) => set('caseImage', v)} placeholder="https://..." />
      <FieldTextarea label="Resultat" value={state.caseOutcomes} onChange={(v) => set('caseOutcomes', v)} rows={3} hint="en per rad" placeholder={"40% snabbare installation\n60% lägre driftkostnad"} />
      <div className="grid grid-cols-2 gap-2">
        <FieldInput label="CTA text" value={state.caseCta} onChange={(v) => set('caseCta', v)} placeholder="Läs hela caset" />
        <FieldInput label="CTA url" value={state.caseCtaUrl} onChange={(v) => set('caseCtaUrl', v)} placeholder="/kundcase/..." />
      </div>
    </div>
  );
}

function CalculatorFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <FieldInput label="Titel" value={state.calcTitle} onChange={(v) => set('calcTitle', v)} placeholder="Beräkna din besparing" />
      <FieldTextarea label="HTML/CSS/JS" value={state.calcHtml} onChange={(v) => set('calcHtml', v)} rows={6} placeholder="<div class='calc'>...</div>" />
    </div>
  );
}

function EventFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <FieldSelect label="Typ" value={state.eventType} onChange={(v) => set('eventType', v)} options={[
        { value: '', label: 'Välj typ...' },
        { value: 'webinar', label: 'Webinar' },
        { value: 'seminar', label: 'Seminarium' },
        { value: 'workshop', label: 'Workshop' },
        { value: 'mässa', label: 'Mässa' },
      ]} />
      <FieldInput label="Titel" value={state.eventTitle} onChange={(v) => set('eventTitle', v)} placeholder="Webinar: Introduktion till FTTO" />
      <FieldTextarea label="Beskrivning" value={state.eventDescription} onChange={(v) => set('eventDescription', v)} rows={3} />
      <div className="grid grid-cols-2 gap-2">
        <FieldInput label="Datum" value={state.eventDate} onChange={(v) => set('eventDate', v)} type="date" />
        <FieldInput label="Plats" value={state.eventLocation} onChange={(v) => set('eventLocation', v)} placeholder="Online / Stockholm" />
      </div>
      <FieldInput label="Webhook" value={state.eventWebhook} onChange={(v) => set('eventWebhook', v)} placeholder="https://hook.eu2.make.com/..." />
    </div>
  );
}

function LeadMagnetFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <FieldInput label="Titel" value={state.magnetTitle} onChange={(v) => set('magnetTitle', v)} placeholder="Ladda ner vår guide" />
      <FieldSelect label="Format" value={state.magnetFormat} onChange={(v) => set('magnetFormat', v)} options={[
        { value: '', label: 'Välj format...' },
        { value: 'PDF', label: 'PDF' },
        { value: 'Whitepaper', label: 'Whitepaper' },
        { value: 'Guide', label: 'Guide' },
        { value: 'Checklista', label: 'Checklista' },
      ]} />
      <FieldTextarea label="Beskrivning" value={state.magnetDescription} onChange={(v) => set('magnetDescription', v)} rows={3} />
      <FieldInput label="Fil-URL" value={state.magnetFileUrl} onChange={(v) => set('magnetFileUrl', v)} placeholder="https://wexoe.se/wp-content/uploads/..." />
      <FieldInput label="Webhook" value={state.magnetWebhook} onChange={(v) => set('magnetWebhook', v)} placeholder="https://hook.eu2.make.com/..." />
    </div>
  );
}
