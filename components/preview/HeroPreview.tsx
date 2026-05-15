'use client';

/* eslint-disable @next/next/no-img-element */

import { PageState } from '@/lib/types';
import { renderInlineMarkdown } from '@/lib/markdown';

interface Props {
  state: PageState;
}

export default function HeroPreview({ state }: Props) {
  const mainColor = state.colorMain || '#11325D';
  const secondaryColor = state.colorSecondary || '#F28C28';

  return (
    <div className="relative overflow-hidden" style={{ minHeight: 340, background: mainColor }}>
      {/* Diagonal image clip */}
      {state.heroImage && (
        <div
          className="absolute top-0 right-0 h-full"
          style={{
            width: '55%',
            clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
          }}
        >
          <img
            src={state.heroImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to right, ${mainColor}, transparent 40%)` }}
          />
        </div>
      )}

      {/* Text content */}
      <div className="relative z-10 px-8 py-12 max-w-[55%]">
        <h1
          className="text-3xl font-bold leading-tight mb-4"
          style={{ color: '#ffffff', fontFamily: 'var(--font-dm-sans)' }}
        >
          {state.h1 || <span className="opacity-40">Rubrik (H1)...</span>}
        </h1>
        {(state.heroDescription || !state.h1) && (
          <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {state.heroDescription
              ? renderInlineMarkdown(state.heroDescription)
              : <span className="opacity-40">Beskrivning...</span>}
          </p>
        )}
        <div className="flex gap-3 flex-wrap">
          {state.heroCta1Text && (
            <span
              className="inline-block px-6 py-2.5 rounded-md text-sm font-semibold"
              style={{ background: secondaryColor, color: '#fff' }}
            >
              {state.heroCta1Text}
            </span>
          )}
          {state.heroCta2Text && (
            <span
              className="inline-block px-6 py-2.5 rounded-md text-sm font-semibold border-2"
              style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }}
            >
              {state.heroCta2Text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
