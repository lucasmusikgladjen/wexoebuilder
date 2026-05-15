import { NextResponse } from 'next/server';
import { PageState } from '@/lib/types';
import { contactFieldsEmpty, resolveDefaultCoworker } from '@/lib/default-coworker';
import {
  createRecord,
  createRecords,
  updateRecord,
  updateRecords,
  deleteRecords,
  getRecord,
  TABLE_IDS,
  AirtableRecord,
} from '@/lib/airtable';
import {
  transformLandingPage,
  clearsForTabType,
  clearsForSidebarType,
  LpTransformDownload,
} from '@/lib/claude-transform';
import { invalidateWexoeCoreCache } from '@/lib/wexoe-cache';
import { getPageType } from '@/lib/page-types/registry';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

// ─── Main publish handler ──────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY ej konfigurerad.' },
      { status: 500 },
    );
  }
  if (!AIRTABLE_API_KEY) {
    return NextResponse.json(
      { error: 'AIRTABLE_API_KEY ej konfigurerad.' },
      { status: 500 },
    );
  }

  try {
    const state: PageState = await request.json();

    if (!state.slug?.trim()) {
      return NextResponse.json({ error: 'Slug är obligatoriskt' }, { status: 400 });
    }
    if (!state.h1?.trim()) {
      return NextResponse.json({ error: 'H1 (rubrik) är obligatoriskt' }, { status: 400 });
    }

    if (state.recordId) {
      return await updateExistingPage(AIRTABLE_API_KEY, ANTHROPIC_API_KEY, state);
    }
    return await createNewPage(AIRTABLE_API_KEY, ANTHROPIC_API_KEY, state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel';
    console.error('[publish] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Create flow: brand-new Landing Page ───────────────────────────────────

async function createNewPage(
  airtableKey: string,
  anthropicKey: string,
  state: PageState,
) {
  // 0. Default-coworker injection — om alla contact_*-fält är tomma, slå upp
  //    första aktiva coworker i SSOT (country=SE default) och förfyll. Manuella
  //    värden bevaras eftersom guard:en bara triggar om allt är tomt.
  if (contactFieldsEmpty(state)) {
    const defaults = await resolveDefaultCoworker({ apiKey: airtableKey, countryCode: 'SE' });
    if (defaults) {
      state = {
        ...state,
        contactName: defaults.contactName,
        contactTitle: defaults.contactTitle,
        contactEmail: defaults.contactEmail,
        contactPhone: defaults.contactPhone,
        contactImage: defaults.contactImage,
      };
    }
  }

  // 1. Claude transforms state → Airtable-ready fields
  const transformed = await transformLandingPage(anthropicKey, state, 'create');

  // 2. CREATE the Landing Page record
  const lp = await createRecord(
    airtableKey,
    TABLE_IDS.landingPages,
    transformed.landingPage,
  );

  // 3. CREATE tabs linked to the new LP. Preserve state order via
  //    _clientIndex — sort Claude's output defensively in case it reordered.
  const sortedTabs = [...transformed.tabs].sort(
    (a, b) => (a._clientIndex ?? 0) - (b._clientIndex ?? 0),
  );
  const tabIdByClientIndex: Record<number, string> = {};
  if (sortedTabs.length > 0) {
    const tabPayloads = sortedTabs.map((tab) => ({
      fields: {
        ...tab.fields,
        'landing_page_ids': [lp.id],
      },
    }));
    const createdTabs = await createRecords(
      airtableKey,
      TABLE_IDS.landingPageTabs,
      tabPayloads,
    );
    sortedTabs.forEach((tab, i) => {
      if (createdTabs[i]) tabIdByClientIndex[tab._clientIndex] = createdTabs[i].id;
    });
  }

  // 4. CREATE downloads linked to the new tabs via _tabClientIndex.
  //
  //    Before any download is created we validate that each entry's
  //    _tabClientIndex references a tab we actually just created —
  //    otherwise Claude's output is malformed and silently dropping
  //    downloads would leave dangling UI state with nothing in
  //    Airtable. Refuse and report instead (ported from the earlier
  //    tabIndex validation on commit 4604d94, now keyed on the new
  //    _tabClientIndex metadata).
  let downloadCount = 0;
  if (transformed.downloads.length > 0) {
    const invalidDownloads = transformed.downloads
      .map((dl, index) => ({
        index,
        tabClientIndex: dl._tabClientIndex,
        isValid:
          Number.isInteger(dl._tabClientIndex) &&
          Object.prototype.hasOwnProperty.call(
            tabIdByClientIndex,
            dl._tabClientIndex,
          ),
      }))
      .filter((item) => !item.isValid)
      .map(({ index, tabClientIndex }) => ({ index, tabClientIndex }));

    if (invalidDownloads.length > 0) {
      console.error(
        '[publish] Download validation failed: invalid _tabClientIndex reference',
        JSON.stringify({
          recordId: lp.id,
          tabCount: sortedTabs.length,
          downloadCount: transformed.downloads.length,
          invalidDownloads,
        }),
      );
      return NextResponse.json(
        {
          error:
            'Ogiltig download-referens: _tabClientIndex måste peka på en existerande tab.',
          validation: {
            recordId: lp.id,
            tabCount: sortedTabs.length,
            validTabClientIndexes: Object.keys(tabIdByClientIndex).map(Number),
            invalidDownloads,
          },
        },
        { status: 400 },
      );
    }

    const sortedDownloads = [...transformed.downloads].sort((a, b) => {
      if (a._tabClientIndex !== b._tabClientIndex) {
        return a._tabClientIndex - b._tabClientIndex;
      }
      return (a._clientIndex ?? 0) - (b._clientIndex ?? 0);
    });

    const dlPayloads: Array<{ fields: Record<string, unknown> }> = [];
    for (const dl of sortedDownloads) {
      const tabId = tabIdByClientIndex[dl._tabClientIndex];
      // Already validated above, but keep the explicit guard: we never
      // want to emit a Download record without exactly one Tab link.
      if (!tabId) {
        throw new Error(
          `Invariant violation for download ${dl._clientIndex} on tab ${dl._tabClientIndex}: no Tab link available`,
        );
      }
      dlPayloads.push({
        fields: { ...dl.fields, tab_ids: [tabId] },
      });
    }

    if (dlPayloads.length > 0) {
      const createdDownloads = await createRecords(
        airtableKey,
        TABLE_IDS.landingPageDownloads,
        dlPayloads,
      );
      downloadCount = createdDownloads.length;
    }
  }

  // Tell Wexoe Core (WordPress) to drop its caches for landing-page-related
  // entities so editors see the new page on the live site immediately.
  // Awaited intentionally — Vercel can spin the lambda down before a
  // dangling promise resolves, so we'd rather pay the ~hundreds-of-ms.
  await invalidateWexoeCoreCache(getPageType('landing').cacheEntities, 'publish:create');

  return NextResponse.json({
    success: true,
    mode: 'create' as const,
    recordId: lp.id,
    slug: state.slug,
    tabCount: sortedTabs.length,
    downloadCount,
  });
}

// ─── Update flow: existing Landing Page ────────────────────────────────────

async function updateExistingPage(
  airtableKey: string,
  anthropicKey: string,
  state: PageState,
) {
  if (!state.recordId) throw new Error('updateExistingPage called without recordId');

  // 1. Fetch existing LP + its linked tabs so we know which records to
  //    diff against (PATCH vs CREATE vs DELETE).
  const existingLp = await getRecord(airtableKey, TABLE_IDS.landingPages, state.recordId);
  const existingTabIds: string[] =
    (existingLp.fields['tab_ids'] as string[] | undefined) ?? [];

  let existingTabs: AirtableRecord[] = [];
  if (existingTabIds.length > 0) {
    const formula = `OR(${existingTabIds.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    const { listRecords, BASE_ID } = await import('@/lib/airtable');
    existingTabs = await listRecords(airtableKey, TABLE_IDS.landingPageTabs, {
      filterByFormula: formula,
      baseId: BASE_ID,
    });
  }
  const existingTabsById = new Map(existingTabs.map((t) => [t.id, t]));

  // 2. Claude transforms state → Airtable-ready fields
  const transformed = await transformLandingPage(anthropicKey, state, 'update');

  // 3. PATCH the Landing Page record. Apply backend sidebar-type clears so
  //    switching from (e.g.) case → event wipes the old sidebar fields.
  const sidebarClears = clearsForSidebarType(state.sidebarType || '');
  await updateRecord(airtableKey, TABLE_IDS.landingPages, state.recordId, {
    ...sidebarClears,
    ...transformed.landingPage,
  });

  // 4. Diff tabs. We pair Claude's `tabs` output with `state.tabs` via
  //    _clientIndex. Each state tab also carries its `type` so we can
  //    compute tab-type clears for the PATCH.
  const stateTabRecordIds = new Set(
    state.tabs.map((t) => t.recordId).filter((id): id is string => !!id),
  );

  const tabsToCreate: Array<{ clientIndex: number; fields: Record<string, unknown> }> = [];
  const tabsToPatch: Array<{
    id: string;
    clientIndex: number;
    fields: Record<string, unknown>;
  }> = [];

  for (const tab of transformed.tabs) {
    // Map to the state tab at the same clientIndex so we know the new tab type
    const stateTab = state.tabs[tab._clientIndex];
    const typeClears = stateTab ? clearsForTabType(stateTab.type) : {};
    const mergedFields = { ...typeClears, ...tab.fields };

    if (tab._recordId && existingTabsById.has(tab._recordId)) {
      tabsToPatch.push({
        id: tab._recordId,
        clientIndex: tab._clientIndex,
        fields: mergedFields,
      });
    } else {
      tabsToCreate.push({
        clientIndex: tab._clientIndex,
        fields: { ...mergedFields, 'landing_page_ids': [state.recordId] },
      });
    }
  }

  const tabIdsToDelete = existingTabIds.filter((id) => !stateTabRecordIds.has(id));

  // DELETE first to free up the linked-record slots (Airtable allows this
  // order freely — it's more about keeping a clean narrative in logs).
  if (tabIdsToDelete.length > 0) {
    await deleteRecords(airtableKey, TABLE_IDS.landingPageTabs, tabIdsToDelete);
  }

  if (tabsToPatch.length > 0) {
    await updateRecords(
      airtableKey,
      TABLE_IDS.landingPageTabs,
      tabsToPatch.map(({ id, fields }) => ({ id, fields })),
    );
  }

  const tabIdByClientIndex: Record<number, string> = {};
  tabsToPatch.forEach(({ clientIndex, id }) => {
    tabIdByClientIndex[clientIndex] = id;
  });

  if (tabsToCreate.length > 0) {
    const created = await createRecords(
      airtableKey,
      TABLE_IDS.landingPageTabs,
      tabsToCreate.map((t) => ({ fields: t.fields })),
    );
    tabsToCreate.forEach((t, i) => {
      if (created[i]) tabIdByClientIndex[t.clientIndex] = created[i].id;
    });
  }

  // 5. Diff downloads. Each download carries _tabClientIndex so we know
  //    which tab it belongs to. Validate every download's reference
  //    against the final tab ID map first — a malformed reference means
  //    Claude's output is inconsistent and we'd otherwise silently drop
  //    the download when grouping by parent.
  let downloadsCreated = 0;
  let downloadsUpdated = 0;
  let downloadsDeleted = 0;

  if (transformed.downloads.length > 0) {
    const invalidDownloads = transformed.downloads
      .map((dl, index) => ({
        index,
        tabClientIndex: dl._tabClientIndex,
        isValid:
          Number.isInteger(dl._tabClientIndex) &&
          Object.prototype.hasOwnProperty.call(
            tabIdByClientIndex,
            dl._tabClientIndex,
          ),
      }))
      .filter((item) => !item.isValid)
      .map(({ index, tabClientIndex }) => ({ index, tabClientIndex }));

    if (invalidDownloads.length > 0) {
      console.error(
        '[publish] Download validation failed: invalid _tabClientIndex reference in update',
        JSON.stringify({
          recordId: state.recordId,
          tabCount: Object.keys(tabIdByClientIndex).length,
          downloadCount: transformed.downloads.length,
          invalidDownloads,
        }),
      );
      return NextResponse.json(
        {
          error:
            'Ogiltig download-referens: _tabClientIndex måste peka på en existerande tab.',
          validation: {
            recordId: state.recordId,
            validTabClientIndexes: Object.keys(tabIdByClientIndex).map(Number),
            invalidDownloads,
          },
        },
        { status: 400 },
      );
    }
  }

  // Group Claude's download output by parent tab clientIndex
  const downloadsByTabIndex = new Map<number, LpTransformDownload[]>();
  for (const dl of transformed.downloads) {
    const list = downloadsByTabIndex.get(dl._tabClientIndex) ?? [];
    list.push(dl);
    downloadsByTabIndex.set(dl._tabClientIndex, list);
  }

  for (let i = 0; i < state.tabs.length; i++) {
    const stateTab = state.tabs[i];
    const tabAirtableId = tabIdByClientIndex[i];
    if (!tabAirtableId) continue;

    // Existing download IDs currently linked under this tab (only if the
    // tab itself is pre-existing — brand-new tabs have no prior downloads).
    const existingTabRecord = stateTab.recordId
      ? existingTabsById.get(stateTab.recordId)
      : undefined;
    const existingDlIds: string[] =
      (existingTabRecord?.fields['download_ids'] as string[] | undefined) ?? [];

    const stateDlRecordIds = new Set(
      stateTab.downloads.map((d) => d.recordId).filter((id): id is string => !!id),
    );

    const transformedForThisTab = downloadsByTabIndex.get(i) ?? [];

    const dlToPatch: Array<{ id: string; fields: Record<string, unknown> }> = [];
    const dlToCreate: Array<{ fields: Record<string, unknown> }> = [];

    for (const dl of transformedForThisTab) {
      if (dl._recordId && existingDlIds.includes(dl._recordId)) {
        dlToPatch.push({ id: dl._recordId, fields: dl.fields });
      } else {
        dlToCreate.push({
          fields: { ...dl.fields, tab_ids: [tabAirtableId] },
        });
      }
    }

    const dlToDelete = existingDlIds.filter((id) => !stateDlRecordIds.has(id));

    if (dlToDelete.length > 0) {
      await deleteRecords(airtableKey, TABLE_IDS.landingPageDownloads, dlToDelete);
      downloadsDeleted += dlToDelete.length;
    }
    if (dlToPatch.length > 0) {
      await updateRecords(airtableKey, TABLE_IDS.landingPageDownloads, dlToPatch);
      downloadsUpdated += dlToPatch.length;
    }
    if (dlToCreate.length > 0) {
      await createRecords(airtableKey, TABLE_IDS.landingPageDownloads, dlToCreate);
      downloadsCreated += dlToCreate.length;
    }
  }

  // Cache-bust Wexoe Core after a successful update so changes show up
  // straight away on the live site instead of waiting for the 24h TTL.
  await invalidateWexoeCoreCache(getPageType('landing').cacheEntities, 'publish:update');

  return NextResponse.json({
    success: true,
    mode: 'update' as const,
    recordId: state.recordId,
    slug: state.slug,
    tabCount: state.tabs.length,
    tabsCreated: tabsToCreate.length,
    tabsUpdated: tabsToPatch.length,
    tabsDeleted: tabIdsToDelete.length,
    downloadsCreated,
    downloadsUpdated,
    downloadsDeleted,
  });
}
