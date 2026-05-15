'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { PageState, Tab } from '@/lib/types';
import { renderInlineMarkdown, renderMarkdown } from '@/lib/markdown';

interface Props {
  state: PageState;
}

export default function TabsPreview({ state }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  if (!state.showTabs || state.tabs.length === 0) return null;

  const tab = state.tabs[activeTab] || state.tabs[0];

  return (
    <div className="px-8 py-10" style={{ background: '#F5F6F8' }}>
      {/* Pill bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {state.tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={(e) => { e.stopPropagation(); setActiveTab(i); }}
            className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
            style={
              i === activeTab
                ? { background: state.colorMain, color: '#fff' }
                : { background: '#fff', color: state.colorMain, border: `1px solid ${state.colorMain}20` }
            }
          >
            {t.name || `Tab ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <TabContent tab={tab} state={state} />
      </div>
    </div>
  );
}

function TabContent({ tab, state }: { tab: Tab; state: PageState }) {
  switch (tab.type) {
    case 'textimage':
      return <TextImageTab tab={tab} mainColor={state.colorMain} secondaryColor={state.colorSecondary} />;
    case 'fullmedia':
      return <FullMediaTab tab={tab} />;
    case 'faq':
      return <FaqTab tab={tab} mainColor={state.colorMain} />;
    case 'calameo':
      return <CalameoTab tab={tab} mainColor={state.colorMain} />;
    case 'downloads':
      return <DownloadsTab tab={tab} secondaryColor={state.colorSecondary} />;
    case 'compare':
      return <CompareTab tab={tab} mainColor={state.colorMain} />;
    case 'steps':
      return <StepsTab tab={tab} mainColor={state.colorMain} secondaryColor={state.colorSecondary} />;
    default:
      return <div className="text-sm text-gray-400">Välj tabtyp...</div>;
  }
}

function TextImageTab({ tab, mainColor, secondaryColor }: { tab: Tab; mainColor: string; secondaryColor: string }) {
  const benefits = tab.tiBenefits.split('\n').map(b => b.trim()).filter(Boolean);
  const content = (
    <div className="flex-1 min-w-0">
      {tab.tiH2 && <h3 className="text-xl font-bold mb-3" style={{ color: mainColor }}>{tab.tiH2}</h3>}
      {tab.tiText && (
        <div className="text-sm leading-relaxed text-lp-text mb-4">
          {renderMarkdown(tab.tiText)}
        </div>
      )}
      {benefits.length > 0 && (
        <ul className="space-y-1.5">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: secondaryColor }}>✓</span>
              <span>{renderInlineMarkdown(b)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const image = tab.tiImage ? (
    <div className="w-[280px] flex-shrink-0">
      <img src={tab.tiImage} alt="" className="w-full rounded-lg object-cover" />
    </div>
  ) : null;

  return (
    <div className="flex gap-6 items-start">
      {tab.tiInverted ? <>{image}{content}</> : <>{content}{image}</>}
    </div>
  );
}

function FullMediaTab({ tab }: { tab: Tab }) {
  if (!tab.fmUrl) return <div className="text-sm text-gray-400 italic">Ange en bild- eller YouTube-URL...</div>;
  const isYouTube = tab.fmUrl.includes('youtube.com') || tab.fmUrl.includes('youtu.be');
  if (isYouTube) {
    const videoId = tab.fmUrl.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1];
    if (!videoId) return <div className="text-sm text-gray-400">Ogiltig YouTube-URL</div>;
    return (
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="absolute inset-0 w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return <img src={tab.fmUrl} alt="" className="w-full rounded-lg" />;
}

function FaqTab({ tab, mainColor }: { tab: Tab; mainColor: string }) {
  const items = tab.faqItems.filter(f => f.question || f.answer);

  if (items.length === 0) return <div className="text-sm text-gray-400 italic">Lägg till frågor via editorn...</div>;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-1" style={{ color: mainColor }}>{item.question || 'Fråga...'}</h4>
          <p className="text-sm text-lp-text-light leading-relaxed">
            {item.answer ? renderInlineMarkdown(item.answer) : 'Svar...'}
          </p>
        </div>
      ))}
    </div>
  );
}

function CalameoTab({ tab, mainColor }: { tab: Tab; mainColor: string }) {
  const items = [
    { title: tab.calTitle1, url: tab.calUrl1 },
    { title: tab.calTitle2, url: tab.calUrl2 },
    { title: tab.calTitle3, url: tab.calUrl3 },
  ].filter(item => item.title || item.url);

  if (items.length === 0) return <div className="text-sm text-gray-400 italic">Lägg till Calameo-dokument...</div>;

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i}>
          {item.title && <h4 className="font-semibold text-sm mb-2" style={{ color: mainColor }}>{item.title}</h4>}
          {item.url ? (
            <div className="relative w-full bg-gray-100 rounded-lg" style={{ paddingBottom: '60%' }}>
              <iframe src={item.url} className="absolute inset-0 w-full h-full rounded-lg border-0" />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-xs text-gray-400">Ingen URL angiven</div>
          )}
        </div>
      ))}
    </div>
  );
}

function DownloadsTab({ tab, secondaryColor }: { tab: Tab; secondaryColor: string }) {
  if (tab.downloads.length === 0) return <div className="text-sm text-gray-400 italic">Inga nedladdningar ännu...</div>;

  return (
    <div className="space-y-3">
      {tab.downloads.map((dl) => (
        <div key={dl.id} className="flex items-center gap-4 border border-gray-200 rounded-lg p-3">
          <div className="w-10 h-10 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: secondaryColor }}>
            {dl.fileType || 'FIL'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{dl.name || 'Namnlös fil'}</div>
            {dl.description && <div className="text-xs text-lp-text-light truncate">{dl.description}</div>}
          </div>
          <span className="text-xs font-medium" style={{ color: secondaryColor }}>Ladda ner →</span>
        </div>
      ))}
    </div>
  );
}

function CompareTab({ tab, mainColor }: { tab: Tab; mainColor: string }) {
  const rows = tab.compareRows.filter(r => r.label || r.valueA || r.valueB);

  return (
    <div>
      {tab.compareTitle && <h3 className="text-lg font-bold mb-4" style={{ color: mainColor }}>{tab.compareTitle}</h3>}
      {rows.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: mainColor }}>
              <th className="text-left px-3 py-2 text-white font-medium rounded-tl-lg">Egenskap</th>
              <th className="text-left px-3 py-2 text-white font-medium">{tab.compareColA}</th>
              <th className="text-left px-3 py-2 text-white font-medium rounded-tr-lg">{tab.compareColB}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-3 py-2 font-medium">{r.label}</td>
                <td className="px-3 py-2">{r.valueA}</td>
                <td className="px-3 py-2">{r.valueB}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-sm text-gray-400 italic">Lägg till rader via editorn...</div>
      )}
    </div>
  );
}

function StepsTab({ tab, mainColor, secondaryColor }: { tab: Tab; mainColor: string; secondaryColor: string }) {
  const steps = tab.stepsItems.filter(s => s.title || s.description);

  return (
    <div>
      {tab.stepsTitle && <h3 className="text-lg font-bold mb-4" style={{ color: mainColor }}>{tab.stepsTitle}</h3>}
      {steps.length > 0 ? (
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex gap-4 items-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: secondaryColor }}
              >
                {i + 1}
              </div>
              <div>
                <h4 className="font-semibold text-sm" style={{ color: mainColor }}>{s.title}</h4>
                {s.description && (
                  <p className="text-sm text-lp-text-light mt-0.5">
                    {renderInlineMarkdown(s.description)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic">Lägg till steg via editorn...</div>
      )}
    </div>
  );
}
