'use client';

import { PageState, PageAction, SidebarType } from '@/lib/types';
import { FieldInput, FieldTextarea, FieldSelect, RichTextarea } from './FieldInput';
import EditorSection from './EditorSection';
import { Field } from '@/components/shared/fields';

interface Props {
  state: PageState;
  dispatch: React.Dispatch<PageAction>;
}

const sidebarOptions: { value: string; label: string }[] = [
  { value: '', label: '— Ingen —' },
  { value: 'case', label: 'Kundcase' },
  { value: 'calculator', label: 'Kalkylator' },
  { value: 'event', label: 'Event' },
  { value: 'leadmagnet', label: 'Lead Magnet' },
];

export default function SidebarEditor({ state, dispatch }: Props) {
  const set = (field: keyof PageState, value: unknown) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return (
    <EditorSection
      title="Sidebar"
      visible={state.showSidebar}
      onToggleVisible={(v) => set('showSidebar', v)}
    >
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
    </EditorSection>
  );
}

function CaseFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <Field.LinkedRecords
        label="Kundcase"
        source="cases"
        value={state.caseId ? [state.caseId] : []}
        onChange={(ids) => set('caseId', ids.length ? ids[ids.length - 1] : '')}
        max={1}
        filter={(r) => r.is_active !== false}
        description="Välj ett kundcase. Kortet (titel, bild, resultat, CTA) hämtas från cms_cases — redigera caset där."
      />
    </div>
  );
}

function CalculatorFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <FieldInput label="Titel" value={state.calcTitle} onChange={(v) => set('calcTitle', v)} placeholder="Beräkna din besparing" />
      <FieldTextarea label="Kod" value={state.calcHtml} onChange={(v) => set('calcHtml', v)} rows={12} placeholder="<div class='calc'>...</div>" />
    </div>
  );
}

function EventFields({ state, set }: { state: PageState; set: (f: keyof PageState, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <FieldInput label="Typ" value={state.eventType} onChange={(v) => set('eventType', v)} placeholder="Webinar, Seminarium, Workshop..." />
      <FieldInput label="Titel" value={state.eventTitle} onChange={(v) => set('eventTitle', v)} placeholder="Webinar: Introduktion till FTTO" />
      <RichTextarea label="Beskrivning" value={state.eventDescription} onChange={(v) => set('eventDescription', v)} rows={6} />
      <div className="grid grid-cols-2 gap-2">
        <FieldInput label="Datum & tid" value={state.eventDate} onChange={(v) => set('eventDate', v)} type="datetime-local" />
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
      <RichTextarea label="Beskrivning" value={state.magnetDescription} onChange={(v) => set('magnetDescription', v)} rows={6} />
      <FieldInput label="Fillänk" value={state.magnetFileUrl} onChange={(v) => set('magnetFileUrl', v)} placeholder="https://wexoe.se/wp-content/uploads/..." />
      <FieldInput label="Webhook" value={state.magnetWebhook} onChange={(v) => set('magnetWebhook', v)} placeholder="https://hook.eu2.make.com/..." />
    </div>
  );
}
