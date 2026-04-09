'use client';

import { PageState, PageAction } from '@/lib/types';
import { FieldInput, FieldTextarea } from './FieldInput';

interface Props {
  state: PageState;
  dispatch: React.Dispatch<PageAction>;
}

export default function HeroEditor({ state, dispatch }: Props) {
  const set = (field: keyof PageState, value: string) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return (
    <div className="space-y-3">
      <FieldInput label="Rubrik" value={state.h1} onChange={(v) => set('h1', v)} placeholder="T.ex. Framtidens nätverkslösning" />
      <FieldTextarea label="Beskrivning" value={state.heroDescription} onChange={(v) => set('heroDescription', v)} rows={3} placeholder="Kort beskrivning under rubriken..." />
      <FieldInput label="Bild" value={state.heroImage} onChange={(v) => set('heroImage', v)} placeholder="https://wexoe.se/wp-content/uploads/..." />
      <div className="grid grid-cols-2 gap-2">
        <FieldInput label="CTA text" value={state.heroCta1Text} onChange={(v) => set('heroCta1Text', v)} placeholder="Kontakta oss" />
        <FieldInput label="CTA url" value={state.heroCta1Url} onChange={(v) => set('heroCta1Url', v)} placeholder="/kontakt/" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FieldInput label="CTA 2 text" value={state.heroCta2Text} onChange={(v) => set('heroCta2Text', v)} placeholder="Läs mer" />
        <FieldInput label="CTA 2 url" value={state.heroCta2Url} onChange={(v) => set('heroCta2Url', v)} placeholder="/produkt/" />
      </div>
    </div>
  );
}
