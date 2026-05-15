'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PAGE_TYPES,
  TYPE_LABEL,
  getPageType,
  type PageRow,
  type PageTypeId as PageType,
} from '@/lib/page-types/registry';

interface SsotOption {
  recordId: string;
  label: string;
}

export default function PageManager() {
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<PageType | 'all'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [copyTarget, setCopyTarget] = useState<PageRow | null>(null);
  // Bumped after a successful copy to force the list effect to re-fetch.
  const [refreshKey, setRefreshKey] = useState(0);

  // SSOT-länkade filter. Båda är `''` för "inget filter aktivt"; sätts till
  // ett SSOT-record-id för att begränsa listan till sidor som länkar mot det.
  const [divisionFilter, setDivisionFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [divisionOptions, setDivisionOptions] = useState<SsotOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<SsotOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/core/core_divisions')
        .then((r) => r.json())
        .catch(() => ({ records: [] })),
      fetch('/api/core/core_countries')
        .then((r) => r.json())
        .catch(() => ({ records: [] })),
    ]).then(([divisions, countries]) => {
      if (cancelled) return;
      type CoreRecord = { _recordId: string; name?: string; slug?: string; code?: string };
      setDivisionOptions(
        ((divisions.records ?? []) as CoreRecord[]).map((d) => ({
          recordId: d._recordId,
          label: d.name || d.slug || d._recordId,
        })),
      );
      setCountryOptions(
        ((countries.records ?? []) as CoreRecord[]).map((c) => ({
          recordId: c._recordId,
          label: c.name || c.code || c._recordId,
        })),
      );
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Iterera över registry:n — en ny sidtyp behöver bara registreras i
    // lib/page-types/registry.ts för att dyka upp här. Failure i en typ
    // bryter inte de andra (per-typ-catch returnerar tom array).
    Promise.all(
      PAGE_TYPES.map((type) =>
        fetch(type.listUrl)
          .then((r) => r.json())
          .then((data) => {
            if (data.error) throw new Error(data.error);
            return type.mapList(data);
          })
          .catch((err) => {
            console.error(`[page-manager] ${type.id} fetch failed:`, err);
            return [] as PageRow[];
          }),
      ),
    )
      .then((perTypeResults) => {
        if (cancelled) return;
        const merged = perTypeResults.flat().sort((a, b) => a.name.localeCompare(b.name, 'sv'));
        setPages(merged);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Kunde inte hämta sidor');
        setPages([]);
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  const filteredPages = useMemo(() => {
    if (!pages) return [];
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (activeType !== 'all' && p.type !== activeType) return false;
      if (divisionFilter && !(p.divisionIds ?? []).includes(divisionFilter)) return false;
      if (countryFilter && !(p.countryIds ?? []).includes(countryFilter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.h1.toLowerCase().includes(q)
      );
    });
  }, [pages, query, activeType, divisionFilter, countryFilter]);

  const counts = useMemo(() => {
    const byType = Object.fromEntries(
      PAGE_TYPES.map((type) => [
        type.id,
        pages?.filter((page) => page.type === type.id).length ?? 0,
      ]),
    ) as Record<PageType, number>;
    return { all: pages?.length ?? 0, byType };
  }, [pages]);

  const editPathFor = (page: PageRow) => getPageType(page.type).editPath(page.id);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-dm-sans)' }}>
      <div className="max-w-3xl mx-auto px-8 pt-24 pb-32">
        {/* Header */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-gray-900">Sidor</h1>
            <p className="text-sm text-gray-400 mt-1">
              {pages === null ? 'Laddar…' : `${counts.all} ${counts.all === 1 ? 'sida' : 'sidor'}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/globals"
              className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900 transition-colors"
              title="Företag, partners, medarbetare, citat osv."
            >
              Globaler
            </Link>
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: '#11325D' }}
            >
              Ny sida
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök på namn, slug eller rubrik…"
            className="w-full px-0 py-3 text-base bg-transparent border-0 border-b border-gray-200 focus:border-gray-900 focus:outline-none placeholder:text-gray-300 transition-colors"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-6 mb-4 text-sm">
          <button
            onClick={() => setActiveType('all')}
            className={`transition-colors ${activeType === 'all' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Alla <span className="text-gray-300 ml-1">{counts.all}</span>
          </button>
          {PAGE_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`transition-colors ${
                activeType === t.id
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label} <span className="text-gray-300 ml-1">{counts.byType[t.id]}</span>
            </button>
          ))}
        </div>

        {/* SSOT filter — tom dropdown = inget filter aktivt. Designen
            matchar resten av sidan (transparent, underline-bottom, samma
            text-storlek som typ-filtret). */}
        <div className="flex items-center gap-4 mb-10">
          <SsotFilter
            label="Division"
            value={divisionFilter}
            onChange={setDivisionFilter}
            options={divisionOptions}
          />
          <SsotFilter
            label="Land"
            value={countryFilter}
            onChange={setCountryFilter}
            options={countryOptions}
          />
          {(divisionFilter || countryFilter) && (
            <button
              onClick={() => {
                setDivisionFilter('');
                setCountryFilter('');
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Rensa filter
            </button>
          )}
        </div>

        {/* List */}
        {error && (
          <div className="py-6 text-sm text-red-500">
            Kunde inte hämta sidor: {error}
          </div>
        )}

        {pages === null && !error && (
          <div className="space-y-px">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="py-5 border-b border-gray-100">
                <div className="h-4 w-48 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-24 bg-gray-50 rounded" />
              </div>
            ))}
          </div>
        )}

        {pages && filteredPages.length === 0 && !error && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">
              {query ? 'Inga sidor matchar din sökning.' : 'Inga sidor ännu.'}
            </p>
          </div>
        )}

        {pages && filteredPages.length > 0 && (
          <ul className="space-y-px">
            {filteredPages.map((page) => (
              <li key={`${page.type}-${page.id}`} className="group">
                <div className="flex items-baseline gap-3 py-5 border-b border-gray-100 -mx-4 px-4 rounded transition-colors hover:bg-gray-50/50">
                  {/* Link wraps the title + slug only so the Kopiera button
                      stays a sibling, avoiding invalid <button> inside <a>
                      nesting. The Link takes flex-1 so the whole left side of
                      the row (including the empty space after the slug) is
                      still a clickable anchor. */}
                  <Link
                    href={editPathFor(page)}
                    className="flex items-baseline gap-3 min-w-0 flex-1"
                  >
                    <p className="text-base text-gray-900 truncate min-w-0 group-hover:text-lp-main transition-colors">
                      {page.name || page.slug || 'Ingen titel'}
                    </p>
                    <span className="text-xs text-gray-300 font-mono whitespace-nowrap flex-none">
                      /{page.slug}
                    </span>
                  </Link>

                  {/* Three-dots menu — sibling of the Link, appears on hover.
                      Provides "Kopiera" today; designed to host future actions
                      (Radera, Duplicera till annan typ, ...) without redesigning
                      the row. Unique-sidor saknar copy-path i /api/copy så
                      menyn döljs där tills fler alternativ tillkommer. */}
                  {page.type !== 'unique' && (
                    <RowActionsMenu
                      onCopy={() => setCopyTarget(page)}
                    />
                  )}

                  <span className="flex-none text-[10px] uppercase tracking-wider text-gray-300 whitespace-nowrap">
                    {TYPE_LABEL[page.type]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAddDialog && (
        <AddPageDialog
          onClose={() => setShowAddDialog(false)}
          onSelect={(type) => {
            router.push(getPageType(type).createPath);
          }}
        />
      )}

      {copyTarget && (
        <CopyPageDialog
          source={copyTarget}
          onClose={() => setCopyTarget(null)}
          onCopied={() => {
            setCopyTarget(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

/**
 * Minimalistisk SSOT-filterdropdown — visas i samma rad som typ-filtret.
 * Stäng på outside-click. Tom värde = inget filter aktivt.
 */
function SsotFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SsotOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (options.length === 0) return null;

  const selected = options.find((o) => o.recordId === value);
  const active = !!value;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-sm transition-colors ${
          active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <span>{label}</span>
        {selected && (
          <span className="text-gray-900">: {selected.label}</span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-20 min-w-[180px] max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-md shadow-md py-1">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
              !value ? 'text-gray-900 bg-gray-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            — Alla —
          </button>
          {options.map((opt) => (
            <button
              key={opt.recordId}
              type="button"
              onClick={() => {
                onChange(opt.recordId);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                value === opt.recordId ? 'text-gray-900 bg-gray-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Three-dots overflow menu on the page-list row. Appears on hover and on
 * keyboard focus. Designed to host additional row actions in the future
 * (Radera, Duplicera till annan typ, ...) — today only "Kopiera" is wired.
 */
function RowActionsMenu({ onCopy }: { onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Fler åtgärder"
        className={`flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-opacity ${
          open
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-white border border-gray-100 rounded-md shadow-md py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCopy();
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Kopiera
          </button>
        </div>
      )}
    </div>
  );
}

function AddPageDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (type: PageType) => void;
}) {
  const creatableTypes = PAGE_TYPES.filter((type) => type.creatable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-medium text-gray-900">Ny sida</h2>
          <p className="text-sm text-gray-400 mt-0.5">Välj vilken typ du vill skapa</p>
        </div>
        <div className="px-3 py-3">
          {creatableTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onSelect(t.id);
                onClose();
              }}
              className="w-full text-left px-3 py-3 rounded-md transition-colors hover:bg-gray-50 cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-6 py-3 flex justify-end border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyPageDialog({
  source,
  onClose,
  onCopied,
}: {
  source: PageRow;
  onClose: () => void;
  onCopied: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = `${source.name || 'Sida'} COPY`;
  const defaultSlug = `${source.slug || 'page'}-copy`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const apiType =
        source.type === 'product'
          ? 'product-area'
          : source.type === 'audience'
          ? 'audience'
          : 'landing';
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: apiType,
          sourceId: source.id,
          name: name.trim() || undefined,
          slug: slug.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kopiering misslyckades');
      onCopied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-medium text-gray-900">Kopiera sida</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Dupliceras från <span className="text-gray-600">{source.name || source.slug}</span>
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          <label className="block">
            <span className="text-[11px] text-gray-400">Namn</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              autoFocus
              className="mt-0.5 block w-full rounded bg-gray-100/80 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:bg-white focus:ring-1 focus:ring-gray-200 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-400">Slug</span>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder={defaultSlug}
              className="mt-0.5 block w-full rounded bg-gray-100/80 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:bg-white focus:ring-1 focus:ring-gray-200 focus:outline-none font-mono"
            />
          </label>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        <div className="px-6 py-3 flex justify-end gap-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-1.5 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#11325D' }}
          >
            {busy ? 'Kopierar…' : 'Kopiera'}
          </button>
        </div>
      </form>
    </div>
  );
}
