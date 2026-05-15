/**
 * Field-primitiver — delad uppsättning input-komponenter som alla editors
 * använder så redigeringsupplevelsen är identisk över sidtyper.
 *
 * Importera via namespace för konsekvent stil i nya editors:
 *
 *   import { Field } from '@/components/shared/fields';
 *   <Field.Text label="…" value={…} onChange={…} />
 *   <Field.Textarea ... />
 *   <Field.RichText ... />
 *   <Field.Select<MyType> ... />
 *   <Field.Checkbox ... /> / <Field.Toggle ... />
 *   <Field.Number ... />
 *   <Field.Color ... />
 *   <Field.Image ... />
 *
 * De namngivna exporterna nedan re-exporteras från `components/editors/FieldInput.tsx`
 * och `components/editors/ButtonFieldset.tsx` så befintliga importer från de
 * filerna fortsätter att fungera. På sikt migreras alla editors till
 * namespace-import:en så fält-implementationerna kan flyttas till denna mapp.
 */

import {
  FieldInput,
  FieldTextarea,
  RichTextarea,
  FieldSelect,
  FieldCheckbox,
  FieldColor,
  FieldGroup,
} from '@/components/editors/FieldInput';
import ButtonFieldset from '@/components/editors/ButtonFieldset';
import LinkedRecords from './LinkedRecords';

function FieldNumber({
  label,
  value,
  onChange,
  placeholder,
  description,
}: {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  description?: string;
}) {
  return (
    <FieldInput
      label={label}
      type="number"
      value={value === '' ? '' : String(value)}
      onChange={(next) => onChange(next === '' ? '' : Number(next))}
      placeholder={placeholder}
      description={description}
    />
  );
}

function FieldImage(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
}) {
  return <FieldInput type="url" {...props} />;
}


export const Field = {
  Text: FieldInput,
  Textarea: FieldTextarea,
  RichText: RichTextarea,
  Select: FieldSelect,
  Checkbox: FieldCheckbox,
  Toggle: FieldCheckbox,
  Number: FieldNumber,
  Color: FieldColor,
  Image: FieldImage,
  Buttons: ButtonFieldset,
  Group: FieldGroup,
  LinkedRecords: LinkedRecords,
} as const;

export {
  FieldInput,
  FieldTextarea,
  RichTextarea,
  FieldSelect,
  FieldCheckbox,
  FieldColor,
  FieldGroup,
  FieldNumber,
  FieldImage,
  ButtonFieldset,
  LinkedRecords,
};
