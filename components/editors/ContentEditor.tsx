'use client';

import { PageState, PageAction } from '@/lib/types';
import { FieldInput, FieldTextarea, FieldCheckbox } from './FieldInput';

interface Props {
  state: PageState;
  dispatch: React.Dispatch<PageAction>;
}

export default function ContentEditor({ state, dispatch }: Props) {
  const set = (field: keyof PageState, value: unknown) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return (
    <div className="space-y-3">
      <FieldCheckbox
        label="Innehåll"
        checked={state.showContent}
        onChange={(v) => set('showContent', v)}
      />
      {state.showContent && (
        <>
          <FieldInput
            label="Rubrik"
            value={state.contentH2}
            onChange={(v) => set('contentH2', v)}
            placeholder="T.ex. Vad är FTTO?"
          />
          <FieldTextarea
            label="Brödtext"
            value={state.contentText}
            onChange={(v) => set('contentText', v)}
            rows={5}
            placeholder="Beskriv produkten/tjänsten..."
          />
          <FieldTextarea
            label="Benefits"
            value={state.contentBenefits}
            onChange={(v) => set('contentBenefits', v)}
            rows={4}
            hint="en per rad"
            placeholder={"Enkel installation\nLägre TCO\nFramtidssäker lösning"}
          />
        </>
      )}
    </div>
  );
}
