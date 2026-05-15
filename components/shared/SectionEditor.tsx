'use client';

import { ReactNode, useId, useState } from 'react';
import { FieldCheckbox } from '@/components/editors/FieldInput';

interface VisibilityToggle {
  value: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

interface Props {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  visibilityToggle?: VisibilityToggle;
  filledIndicator?: boolean;
}

/**
 * Standardiserad sektions-wrapper för PageTypeBuilder:s högerpanel.
 * Sidtyper renderar bara fält; buildern äger wrapper, data-section-ankare,
 * collapse, visibility-toggle och fylld-indikator.
 */
export default function SectionEditor({
  id,
  title,
  description,
  children,
  collapsible = true,
  defaultOpen = true,
  visibilityToggle,
  filledIndicator,
}: Props) {
  const headingId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const bodyVisible = !collapsible || open;

  return (
    <section
      data-section={id}
      aria-labelledby={headingId}
      className="group rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:border-gray-200 focus-within:border-gray-300"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && setOpen((v) => !v)}
          aria-expanded={bodyVisible}
          aria-controls={`${headingId}-body`}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <div className="flex items-center gap-2">
            {collapsible && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className={`flex-none text-gray-300 transition-transform group-hover:text-gray-500 ${open ? 'rotate-90' : ''}`}
                aria-hidden
              >
                <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <h3 id={headingId} className="text-xl font-bold text-gray-900">
              {title}
            </h3>
            {filledIndicator !== undefined && (
              <span
                className={`h-2 w-2 rounded-full ${filledIndicator ? 'bg-emerald-400' : 'bg-gray-200'}`}
                title={filledIndicator ? 'Ifylld' : 'Ej ifylld'}
                aria-label={filledIndicator ? 'Sektionen är ifylld' : 'Sektionen är inte ifylld'}
              />
            )}
          </div>
          {description && <p className="mt-1 text-xs leading-5 text-gray-400">{description}</p>}
        </button>

        {visibilityToggle && (
          <div className="pt-1">
            <FieldCheckbox
              label={visibilityToggle.label ?? 'Visa'}
              checked={visibilityToggle.value}
              onChange={visibilityToggle.onChange}
            />
          </div>
        )}
      </div>

      {bodyVisible && (
        <div id={`${headingId}-body`} className="mt-4 space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}
