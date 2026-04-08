'use client';

import { useState } from 'react';
import { PageState } from '@/lib/types';

interface Props {
  state: PageState;
  onClose: () => void;
}

type PublishStatus = 'idle' | 'validating' | 'publishing' | 'success' | 'error';

interface PublishResult {
  recordId?: string;
  slug?: string;
  tabCount?: number;
  error?: string;
}

export default function PublishDialog({ state, onClose }: Props) {
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [step, setStep] = useState('');
  const [result, setResult] = useState<PublishResult>({});

  const validationErrors = validate(state);
  const hasErrors = validationErrors.length > 0;

  async function handlePublish() {
    if (hasErrors) return;

    setStatus('validating');
    setStep('Kontrollerar slug...');

    try {
      const checkRes = await fetch(`/api/check-slug?slug=${encodeURIComponent(state.slug)}`);
      const checkData = await checkRes.json();

      if (checkData.exists) {
        setResult({ error: `Slug "${state.slug}" finns redan. Välj ett annat slug.` });
        setStatus('error');
        return;
      }

      setStatus('publishing');
      setStep('Skapar sida via Claude + Airtable MCP...');

      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Publicering misslyckades');
      }

      setResult({
        recordId: data.recordId,
        slug: data.slug || state.slug,
        tabCount: data.tabCount || state.tabs.length,
      });
      setStatus('success');
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Okänt fel' });
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-lp-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-lp-main">
            {status === 'success' ? 'Publicerad!' : 'Publicera sida'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {status === 'idle' && (
            <>
              {/* Summary */}
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-lp-text-light">Slug:</span>
                  <span className="font-medium">{state.slug || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lp-text-light">Rubrik:</span>
                  <span className="font-medium truncate max-w-[250px]">{state.h1 || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lp-text-light">Tabs:</span>
                  <span className="font-medium">{state.tabs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lp-text-light">Sidebar:</span>
                  <span className="font-medium">{state.sidebarType || 'Ingen'}</span>
                </div>
              </div>

              {/* Validation */}
              {hasErrors && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Åtgärda innan publicering:</p>
                  <ul className="text-sm text-red-700 space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {(status === 'validating' || status === 'publishing') && (
            <div className="text-center py-6">
              <div className="inline-block w-8 h-8 border-3 border-lp-main border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-lp-text">{step}</p>
              {status === 'publishing' && (
                <p className="text-xs text-lp-text-light mt-1">Detta kan ta 10-20 sekunder...</p>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-10">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <span className="text-green-600 text-4xl">✓</span>
              </div>
              <p className="text-2xl font-bold text-lp-text mb-3">Sidan har publicerats!</p>
              <p className="text-lg text-lp-text-light">
                Slug: <strong className="text-lp-text">{result.slug}</strong>
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <p className="text-sm font-medium text-red-800 mb-1">Publicering misslyckades</p>
              <p className="text-xs text-red-600">{result.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-lp-border flex justify-end gap-3">
          {status === 'idle' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-lp-text-light hover:text-lp-text">
                Avbryt
              </button>
              <button
                onClick={handlePublish}
                disabled={hasErrors}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: hasErrors ? '#9ca3af' : '#11325D' }}
              >
                Publicera →
              </button>
            </>
          )}
          {(status === 'success' || status === 'error') && (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#11325D' }}
            >
              Stäng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function validate(state: PageState): string[] {
  const errors: string[] = [];
  if (!state.slug.trim()) errors.push('Slug är obligatoriskt');
  if (!/^[a-z0-9-]+$/.test(state.slug) && state.slug.trim()) errors.push('Slug får bara innehålla a-z, 0-9 och bindestreck');
  if (!state.h1.trim()) errors.push('H1 (rubrik) är obligatoriskt');
  return errors;
}
