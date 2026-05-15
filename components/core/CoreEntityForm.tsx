'use client';

import { useEffect } from 'react';
import { CoreEntityName } from '@/lib/core/registry';
import { CORE_ENTITY_FORMS, FormField } from '@/lib/core/forms';

interface LinkOption {
  recordId: string;
  label: string;
}

interface Props {
  entity: CoreEntityName;
  initialState: Record<string, unknown>;
  /** Per-link-entity option-lista (recordId + display label). */
  linkOptions?: Record<string, LinkOption[]>;
  onChange: (state: Record<string, unknown>) => void;
  state: Record<string, unknown>;
}

export default function CoreEntityForm({
  entity,
  initialState,
  linkOptions = {},
  onChange,
  state,
}: Props) {
  const config = CORE_ENTITY_FORMS[entity];

  useEffect(() => {
    // Synka in initialState när entity ändras. State-management ägs av föräldern.
    onChange(initialState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const setField = (key: string, value: unknown) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <div className="space-y-4">
      {renderGroupedFields(config.fields, state, setField, linkOptions)}
    </div>
  );
}

function renderGroupedFields(
  fields: FormField[],
  state: Record<string, unknown>,
  setField: (k: string, v: unknown) => void,
  linkOptions: Record<string, LinkOption[]>,
) {
  // Gruppera 'half'-fält parvis i grid-2 så de hamnar bredvid varandra.
  const rows: Array<FormField[]> = [];
  let buf: FormField[] = [];
  for (const f of fields) {
    if (f.width === 'half') {
      buf.push(f);
      if (buf.length === 2) {
        rows.push(buf);
        buf = [];
      }
    } else {
      if (buf.length) {
        rows.push(buf);
        buf = [];
      }
      rows.push([f]);
    }
  }
  if (buf.length) rows.push(buf);

  return rows.map((row, i) => (
    <div key={i} className={row.length === 2 ? 'grid grid-cols-2 gap-3' : ''}>
      {row.map((field) => (
        <Field
          key={field.key}
          field={field}
          value={state[field.key]}
          onChange={(v) => setField(field.key, v)}
          linkOptions={linkOptions[field.linkedEntity ?? ''] ?? []}
        />
      ))}
    </div>
  ));
}

function Field({
  field,
  value,
  onChange,
  linkOptions,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  linkOptions: LinkOption[];
}) {
  const id = `f-${field.key}`;
  const labelEl = (
    <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">
      {field.label}
    </label>
  );
  const helpEl = field.help ? (
    <p className="mt-1 text-[11px] text-gray-400">{field.help}</p>
  ) : null;

  switch (field.type) {
    case 'checkbox':
      return (
        <div className="flex items-start gap-2 pt-1">
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <div className="flex-1">
            <label htmlFor={id} className="text-xs text-gray-700">{field.label}</label>
            {helpEl}
          </div>
        </div>
      );

    case 'textarea':
      return (
        <div>
          {labelEl}
          <textarea
            id={id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none"
          />
          {helpEl}
        </div>
      );

    case 'number':
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="number"
            value={value === '' || value == null ? '' : Number(value)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none"
          />
          {helpEl}
        </div>
      );

    case 'color':
      return (
        <div>
          {labelEl}
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="text"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#11325D"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none font-mono"
            />
            <span
              className="w-8 h-8 rounded border border-gray-200"
              style={{ background: typeof value === 'string' && value.startsWith('#') ? value : 'transparent' }}
            />
          </div>
          {helpEl}
        </div>
      );

    case 'image':
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="url"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… eller WP Media URL"
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none"
          />
          {typeof value === 'string' && value !== '' && (
            <div className="mt-2 inline-block border border-gray-100 rounded p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="max-h-24 max-w-[200px]" />
            </div>
          )}
          {helpEl}
        </div>
      );

    case 'link': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          {labelEl}
          <select
            id={id}
            multiple
            value={arr}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
              onChange(selected);
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none min-h-[80px]"
          >
            {linkOptions.map((opt) => (
              <option key={opt.recordId} value={opt.recordId}>{opt.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-400">Håll cmd/ctrl och klicka för flera val.</p>
          {helpEl}
        </div>
      );
    }

    case 'email':
    case 'url':
    case 'phone':
    case 'text':
    default:
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:border-gray-400 focus:outline-none"
          />
          {helpEl}
        </div>
      );
  }
}
