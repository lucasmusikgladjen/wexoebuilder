'use client';

/* eslint-disable @next/next/no-img-element */

import { PageState } from '@/lib/types';
import { renderInlineMarkdown } from '@/lib/markdown';

interface Props {
  state: PageState;
}

export default function ContactPreview({ state }: Props) {
  if (!state.showContact) return null;

  const mainColor = state.colorMain;

  return (
    <div className="px-8 py-10 bg-white border-t border-gray-100">
      <div className="flex items-start gap-6">
        {/* Photo */}
        <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
          {state.contactImage ? (
            <img src={state.contactImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">👤</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-lg font-bold" style={{ color: mainColor }}>
            {state.contactName || <span className="text-gray-400 font-normal">Kontaktperson</span>}
          </h3>
          {state.contactTitle && (
            <p className="text-sm text-lp-text-light mt-0.5">{state.contactTitle}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm">
            {state.contactEmail && (
              <span className="text-lp-text-light">
                ✉ {state.contactEmail}
              </span>
            )}
            {state.contactPhone && (
              <span className="text-lp-text-light">
                ☎ {state.contactPhone}
              </span>
            )}
          </div>
          {state.contactQuote && (
            <blockquote
              className="mt-3 pl-3 border-l-3 text-sm italic text-lp-text-light"
              style={{ borderColor: state.colorSecondary }}
            >
              &ldquo;{renderInlineMarkdown(state.contactQuote)}&rdquo;
            </blockquote>
          )}
        </div>
      </div>
    </div>
  );
}
