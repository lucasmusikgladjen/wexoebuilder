'use client';

import { PageState, PageAction, Tab, TabType } from '@/lib/types';
import { FieldInput, FieldTextarea, FieldSelect, FieldCheckbox } from './FieldInput';

function ItemCard({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="group border border-lp-border rounded-md p-2.5 space-y-2 relative">
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        title="Ta bort"
      >
        ✕
      </button>
      {children}
    </div>
  );
}

interface Props {
  state: PageState;
  dispatch: React.Dispatch<PageAction>;
}

const tabTypeOptions: { value: string; label: string }[] = [
  { value: 'textimage', label: 'Text + Bild' },
  { value: 'fullmedia', label: 'Helbild / Video' },
  { value: 'faq', label: 'FAQ' },
  { value: 'calameo', label: 'Calameo (dokument)' },
  { value: 'downloads', label: 'Nedladdningar' },
  { value: 'compare', label: 'Jämförelsetabell' },
  { value: 'steps', label: 'Steg-för-steg' },
];

export default function TabsEditor({ state, dispatch }: Props) {
  const set = (field: keyof PageState, value: unknown) =>
    dispatch({ type: 'SET_FIELD', field, value });

  const moveTab = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.tabs.length) return;
    dispatch({ type: 'REORDER_TABS', fromIndex: index, toIndex: newIndex });
  };

  return (
    <div className="space-y-3">
      <FieldCheckbox label="Tabs" checked={state.showTabs} onChange={(v) => set('showTabs', v)} />
      {state.showTabs && (
        <>
          {state.tabs.map((tab, index) => (
            <TabEditor
              key={tab.id}
              tab={tab}
              index={index}
              total={state.tabs.length}
              dispatch={dispatch}
              onMoveUp={() => moveTab(index, -1)}
              onMoveDown={() => moveTab(index, 1)}
              onRemove={() => dispatch({ type: 'REMOVE_TAB', tabId: tab.id })}
            />
          ))}
          <button
            onClick={() => dispatch({ type: 'ADD_TAB' })}
            className="w-full py-1.5 border border-dashed border-lp-border rounded-md text-xs text-lp-text-light hover:border-lp-main hover:text-lp-main transition-colors"
          >
            + Lägg till tab
          </button>
        </>
      )}
    </div>
  );
}

function TabEditor({
  tab,
  index,
  total,
  dispatch,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  tab: Tab;
  index: number;
  total: number;
  dispatch: React.Dispatch<PageAction>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const setField = (field: keyof Tab, value: unknown) =>
    dispatch({ type: 'SET_TAB_FIELD', tabId: tab.id, field, value });

  return (
    <div className="border border-lp-border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-lp-border">
        <span className="text-[10px] text-lp-text-light w-4 text-center">{index + 1}</span>
        <input
          value={tab.name}
          onChange={(e) => setField('name', e.target.value)}
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-lp-text"
          placeholder="Tabnamn..."
        />
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="text-gray-400 hover:text-lp-main disabled:opacity-30 text-xs px-1" title="Flytta upp">▲</button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="text-gray-400 hover:text-lp-main disabled:opacity-30 text-xs px-1" title="Flytta ner">▼</button>
          <button onClick={onRemove} className="text-gray-400 hover:text-red-500 text-xs px-1 ml-1" title="Ta bort">✕</button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <FieldSelect
          label="Typ"
          value={tab.type}
          onChange={(v) => setField('type', v as TabType)}
          options={tabTypeOptions}
        />
        {tab.type === 'textimage' && <TextImageFields tab={tab} setField={setField} />}
        {tab.type === 'fullmedia' && <FullMediaFields tab={tab} setField={setField} />}
        {tab.type === 'faq' && <FaqFields tab={tab} dispatch={dispatch} />}
        {tab.type === 'calameo' && <CalameoFields tab={tab} setField={setField} />}
        {tab.type === 'downloads' && <DownloadFields tab={tab} dispatch={dispatch} />}
        {tab.type === 'compare' && <CompareFields tab={tab} setField={setField} dispatch={dispatch} />}
        {tab.type === 'steps' && <StepsFields tab={tab} setField={setField} dispatch={dispatch} />}
      </div>
    </div>
  );
}

function TextImageFields({ tab, setField }: { tab: Tab; setField: (f: keyof Tab, v: unknown) => void }) {
  return (
    <>
      <FieldInput label="Rubrik" value={tab.tiH2} onChange={(v) => setField('tiH2', v)} placeholder="Rubrik för tabben" />
      <FieldTextarea label="Text" value={tab.tiText} onChange={(v) => setField('tiText', v)} rows={3} />
      <FieldTextarea label="Benefits" value={tab.tiBenefits} onChange={(v) => setField('tiBenefits', v)} rows={3} hint="en per rad" placeholder={"Fördel 1\nFördel 2\nFördel 3"} />
      <FieldInput label="Bild" value={tab.tiImage} onChange={(v) => setField('tiImage', v)} placeholder="https://..." />
      <FieldCheckbox label="Inverterad layout (bild till vänster)" checked={tab.tiInverted} onChange={(v) => setField('tiInverted', v)} />
    </>
  );
}

function FullMediaFields({ tab, setField }: { tab: Tab; setField: (f: keyof Tab, v: unknown) => void }) {
  return (
    <FieldInput label="URL" value={tab.fmUrl} onChange={(v) => setField('fmUrl', v)} placeholder="https://youtube.com/watch?v=... eller bild-URL" />
  );
}

function FaqFields({ tab, dispatch }: { tab: Tab; dispatch: React.Dispatch<PageAction> }) {
  return (
    <div className="space-y-3">
      {tab.faqItems.map((item) => (
        <ItemCard key={item.id} onRemove={() => dispatch({ type: 'REMOVE_FAQ_ITEM', tabId: tab.id, itemId: item.id })}>
          <FieldInput
            label="Fråga"
            value={item.question}
            onChange={(v) => dispatch({ type: 'SET_FAQ_ITEM_FIELD', tabId: tab.id, itemId: item.id, field: 'question', value: v })}
            placeholder="T.ex. Vad är FTTO?"
          />
          <FieldTextarea
            label="Svar"
            value={item.answer}
            onChange={(v) => dispatch({ type: 'SET_FAQ_ITEM_FIELD', tabId: tab.id, itemId: item.id, field: 'answer', value: v })}
            rows={2}
            placeholder="Svaret på frågan..."
          />
        </ItemCard>
      ))}
      <button
        onClick={() => dispatch({ type: 'ADD_FAQ_ITEM', tabId: tab.id })}
        className="w-full py-1.5 border border-dashed border-lp-border rounded-md text-xs text-lp-text-light hover:border-lp-main hover:text-lp-main transition-colors"
      >
        + Lägg till fråga
      </button>
    </div>
  );
}

function CalameoFields({ tab, setField }: { tab: Tab; setField: (f: keyof Tab, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((n) => (
        <div key={n} className="grid grid-cols-[1fr_2fr] gap-2">
          <FieldInput
            label={`Titel ${n}`}
            value={tab[`calTitle${n}` as keyof Tab] as string}
            onChange={(v) => setField(`calTitle${n}` as keyof Tab, v)}
            placeholder={`Dokument ${n}`}
          />
          <FieldInput
            label={`Iframe-URL ${n}`}
            value={tab[`calUrl${n}` as keyof Tab] as string}
            onChange={(v) => setField(`calUrl${n}` as keyof Tab, v)}
            placeholder="https://v.calameo.com/..."
          />
        </div>
      ))}
    </div>
  );
}

function DownloadFields({ tab, dispatch }: { tab: Tab; dispatch: React.Dispatch<PageAction> }) {
  return (
    <div className="space-y-3">
      {tab.downloads.map((dl) => (
        <ItemCard key={dl.id} onRemove={() => dispatch({ type: 'REMOVE_DOWNLOAD', tabId: tab.id, downloadId: dl.id })}>
          <FieldInput label="Namn" value={dl.name} onChange={(v) => dispatch({ type: 'SET_DOWNLOAD_FIELD', tabId: tab.id, downloadId: dl.id, field: 'name', value: v })} placeholder="Produktblad FTTO" />
          <FieldInput label="Beskrivning" value={dl.description} onChange={(v) => dispatch({ type: 'SET_DOWNLOAD_FIELD', tabId: tab.id, downloadId: dl.id, field: 'description', value: v })} placeholder="Teknisk specifikation..." />
          <div className="grid grid-cols-2 gap-2">
            <FieldInput label="Fil-URL" value={dl.fileUrl} onChange={(v) => dispatch({ type: 'SET_DOWNLOAD_FIELD', tabId: tab.id, downloadId: dl.id, field: 'fileUrl', value: v })} placeholder="https://..." />
            <FieldInput label="Filtyp" value={dl.fileType} onChange={(v) => dispatch({ type: 'SET_DOWNLOAD_FIELD', tabId: tab.id, downloadId: dl.id, field: 'fileType', value: v })} placeholder="PDF" />
          </div>
        </ItemCard>
      ))}
      <button
        onClick={() => dispatch({ type: 'ADD_DOWNLOAD', tabId: tab.id })}
        className="w-full py-1.5 border border-dashed border-lp-border rounded-md text-xs text-lp-text-light hover:border-lp-main hover:text-lp-main transition-colors"
      >
        + Lägg till nedladdning
      </button>
    </div>
  );
}

function CompareFields({ tab, setField, dispatch }: { tab: Tab; setField: (f: keyof Tab, v: unknown) => void; dispatch: React.Dispatch<PageAction> }) {
  return (
    <>
      <FieldInput label="Titel" value={tab.compareTitle} onChange={(v) => setField('compareTitle', v)} placeholder="Jämför lösningar" />
      <div className="grid grid-cols-2 gap-2">
        <FieldInput label="Kolumn A" value={tab.compareColA} onChange={(v) => setField('compareColA', v)} placeholder="FTTO" />
        <FieldInput label="Kolumn B" value={tab.compareColB} onChange={(v) => setField('compareColB', v)} placeholder="Traditionellt" />
      </div>
      {tab.compareRows.length > 0 && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 text-[10px] text-lp-text-light px-0.5">
            <span>Egenskap</span>
            <span>{tab.compareColA || 'Kolumn A'}</span>
            <span>{tab.compareColB || 'Kolumn B'}</span>
            <span></span>
          </div>
          {tab.compareRows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 items-center">
              <input
                value={row.label}
                onChange={(e) => dispatch({ type: 'SET_COMPARE_ROW_FIELD', tabId: tab.id, rowId: row.id, field: 'label', value: e.target.value })}
                placeholder="Egenskap"
                className="w-full px-2 py-1.5 text-sm border border-lp-border rounded-md bg-white focus:border-lp-main focus:outline-none"
              />
              <input
                value={row.valueA}
                onChange={(e) => dispatch({ type: 'SET_COMPARE_ROW_FIELD', tabId: tab.id, rowId: row.id, field: 'valueA', value: e.target.value })}
                placeholder="Värde"
                className="w-full px-2 py-1.5 text-sm border border-lp-border rounded-md bg-white focus:border-lp-main focus:outline-none"
              />
              <input
                value={row.valueB}
                onChange={(e) => dispatch({ type: 'SET_COMPARE_ROW_FIELD', tabId: tab.id, rowId: row.id, field: 'valueB', value: e.target.value })}
                placeholder="Värde"
                className="w-full px-2 py-1.5 text-sm border border-lp-border rounded-md bg-white focus:border-lp-main focus:outline-none"
              />
              <button
                onClick={() => dispatch({ type: 'REMOVE_COMPARE_ROW', tabId: tab.id, rowId: row.id })}
                className="text-xs text-gray-400 hover:text-red-500 text-center"
                title="Ta bort rad"
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => dispatch({ type: 'ADD_COMPARE_ROW', tabId: tab.id })}
        className="w-full py-1.5 border border-dashed border-lp-border rounded-md text-xs text-lp-text-light hover:border-lp-main hover:text-lp-main transition-colors"
      >
        + Lägg till rad
      </button>
    </>
  );
}

function StepsFields({ tab, setField, dispatch }: { tab: Tab; setField: (f: keyof Tab, v: unknown) => void; dispatch: React.Dispatch<PageAction> }) {
  return (
    <>
      <FieldInput label="Titel" value={tab.stepsTitle} onChange={(v) => setField('stepsTitle', v)} placeholder="Så här kommer du igång" />
      <div className="space-y-3">
        {tab.stepsItems.map((item, i) => (
          <ItemCard key={item.id} onRemove={() => dispatch({ type: 'REMOVE_STEP_ITEM', tabId: tab.id, itemId: item.id })}>
            <FieldInput
              label="Rubrik"
              value={item.title}
              onChange={(v) => dispatch({ type: 'SET_STEP_ITEM_FIELD', tabId: tab.id, itemId: item.id, field: 'title', value: v })}
              placeholder={`Steg ${i + 1}`}
            />
            <FieldTextarea
              label="Beskrivning"
              value={item.description}
              onChange={(v) => dispatch({ type: 'SET_STEP_ITEM_FIELD', tabId: tab.id, itemId: item.id, field: 'description', value: v })}
              rows={2}
              placeholder="Vad händer i detta steg..."
            />
          </ItemCard>
        ))}
        <button
          onClick={() => dispatch({ type: 'ADD_STEP_ITEM', tabId: tab.id })}
          className="w-full py-1.5 border border-dashed border-lp-border rounded-md text-xs text-lp-text-light hover:border-lp-main hover:text-lp-main transition-colors"
        >
          + Lägg till steg
        </button>
      </div>
    </>
  );
}
