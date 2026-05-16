import { contactFieldsEmpty, resolveDefaultCoworker } from '../default-coworker';
import {
  createRecord,
  createRecords,
  updateRecord,
  updateRecords,
  deleteRecords,
  getRecord,
  listRecords,
  AirtableRecord,
} from '../airtable';
import { AIRTABLE_FAMILIES } from '../airtable-registry';
import {
  transformLandingPage,
  clearsForTabType,
  clearsForSidebarType,
  LpTransformDownload,
} from '../claude-transform';
import { PageState } from '../types';

const LANDING_BASE_ID = AIRTABLE_FAMILIES.landing.baseId;
const LANDING_TABLE_IDS = AIRTABLE_FAMILIES.landing.tables;

function requireAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY ej konfigurerad.');
  return key;
}

function validateDownloadRefs(args: {
  downloads: LpTransformDownload[];
  tabIdByClientIndex: Record<number, string>;
  recordId: string;
  context: 'create' | 'update';
}) {
  const invalidDownloads = args.downloads
    .map((dl, index) => ({
      index,
      tabClientIndex: dl._tabClientIndex,
      isValid:
        Number.isInteger(dl._tabClientIndex) &&
        Object.prototype.hasOwnProperty.call(args.tabIdByClientIndex, dl._tabClientIndex),
    }))
    .filter((item) => !item.isValid)
    .map(({ index, tabClientIndex }) => ({ index, tabClientIndex }));

  if (invalidDownloads.length > 0) {
    console.error(
      `[landing:${args.context}] Download validation failed: invalid _tabClientIndex reference`,
      JSON.stringify({
        recordId: args.recordId,
        validTabClientIndexes: Object.keys(args.tabIdByClientIndex).map(Number),
        downloadCount: args.downloads.length,
        invalidDownloads,
      }),
    );
    throw new Error('Ogiltig download-referens: _tabClientIndex måste peka på en existerande tab.');
  }
}

export interface LandingCreateResult {
  recordId: string;
  tabCount: number;
  downloadCount: number;
}

export interface LandingUpdateResult {
  recordId: string;
  tabCount: number;
  tabsCreated: number;
  tabsUpdated: number;
  tabsDeleted: number;
  downloadsCreated: number;
  downloadsUpdated: number;
  downloadsDeleted: number;
}

export async function landingCreate(
  state: PageState,
  ctx: { apiKey: string },
): Promise<LandingCreateResult> {
  const anthropicKey = requireAnthropicKey();

  if (contactFieldsEmpty(state)) {
    const defaults = await resolveDefaultCoworker({ apiKey: ctx.apiKey, countryCode: 'SE' });
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

  const transformed = await transformLandingPage(anthropicKey, state, 'create');
  const lp = await createRecord(
    ctx.apiKey,
    LANDING_TABLE_IDS.landingPages,
    transformed.landingPage,
    LANDING_BASE_ID,
  );

  const sortedTabs = [...transformed.tabs].sort(
    (a, b) => (a._clientIndex ?? 0) - (b._clientIndex ?? 0),
  );
  const tabIdByClientIndex: Record<number, string> = {};

  if (sortedTabs.length > 0) {
    const createdTabs = await createRecords(
      ctx.apiKey,
      LANDING_TABLE_IDS.landingPageTabs,
      sortedTabs.map((tab) => ({
        fields: {
          ...tab.fields,
          landing_page_ids: [lp.id],
        },
      })),
      LANDING_BASE_ID,
    );
    sortedTabs.forEach((tab, i) => {
      if (createdTabs[i]) tabIdByClientIndex[tab._clientIndex] = createdTabs[i].id;
    });
  }

  let downloadCount = 0;
  if (transformed.downloads.length > 0) {
    validateDownloadRefs({
      downloads: transformed.downloads,
      tabIdByClientIndex,
      recordId: lp.id,
      context: 'create',
    });

    const sortedDownloads = [...transformed.downloads].sort((a, b) => {
      if (a._tabClientIndex !== b._tabClientIndex) return a._tabClientIndex - b._tabClientIndex;
      return (a._clientIndex ?? 0) - (b._clientIndex ?? 0);
    });

    const createdDownloads = await createRecords(
      ctx.apiKey,
      LANDING_TABLE_IDS.landingPageDownloads,
      sortedDownloads.map((dl) => ({
        fields: {
          ...dl.fields,
          tab_ids: [tabIdByClientIndex[dl._tabClientIndex]],
        },
      })),
      LANDING_BASE_ID,
    );
    downloadCount = createdDownloads.length;
  }

  return { recordId: lp.id, tabCount: sortedTabs.length, downloadCount };
}

export async function landingUpdate(
  recordId: string,
  state: PageState,
  ctx: { apiKey: string },
): Promise<LandingUpdateResult> {
  const anthropicKey = requireAnthropicKey();
  state = { ...state, recordId };

  const existingLp = await getRecord(
    ctx.apiKey,
    LANDING_TABLE_IDS.landingPages,
    recordId,
    LANDING_BASE_ID,
  );
  const existingTabIds: string[] = (existingLp.fields['tab_ids'] as string[] | undefined) ?? [];

  let existingTabs: AirtableRecord[] = [];
  if (existingTabIds.length > 0) {
    const formula = `OR(${existingTabIds.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    existingTabs = await listRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageTabs, {
      filterByFormula: formula,
      baseId: LANDING_BASE_ID,
    });
  }
  const existingTabsById = new Map(existingTabs.map((t) => [t.id, t]));

  const transformed = await transformLandingPage(anthropicKey, state, 'update');
  await updateRecord(
    ctx.apiKey,
    LANDING_TABLE_IDS.landingPages,
    recordId,
    {
      ...clearsForSidebarType(state.sidebarType || ''),
      ...transformed.landingPage,
    },
    LANDING_BASE_ID,
  );

  const stateTabRecordIds = new Set(
    state.tabs.map((t) => t.recordId).filter((id): id is string => !!id),
  );

  const tabsToCreate: Array<{ clientIndex: number; fields: Record<string, unknown> }> = [];
  const tabsToPatch: Array<{ id: string; clientIndex: number; fields: Record<string, unknown> }> = [];

  for (const tab of transformed.tabs) {
    const stateTab = state.tabs[tab._clientIndex];
    const mergedFields = { ...clearsForTabType(stateTab?.type ?? ''), ...tab.fields };

    if (tab._recordId && existingTabsById.has(tab._recordId)) {
      tabsToPatch.push({ id: tab._recordId, clientIndex: tab._clientIndex, fields: mergedFields });
    } else {
      tabsToCreate.push({
        clientIndex: tab._clientIndex,
        fields: { ...mergedFields, landing_page_ids: [recordId] },
      });
    }
  }

  const tabIdsToDelete = existingTabIds.filter((id) => !stateTabRecordIds.has(id));
  if (tabIdsToDelete.length > 0) {
    await deleteRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageTabs, tabIdsToDelete, LANDING_BASE_ID);
  }
  if (tabsToPatch.length > 0) {
    await updateRecords(
      ctx.apiKey,
      LANDING_TABLE_IDS.landingPageTabs,
      tabsToPatch.map(({ id, fields }) => ({ id, fields })),
      LANDING_BASE_ID,
    );
  }

  const tabIdByClientIndex: Record<number, string> = {};
  tabsToPatch.forEach(({ clientIndex, id }) => {
    tabIdByClientIndex[clientIndex] = id;
  });
  if (tabsToCreate.length > 0) {
    const created = await createRecords(
      ctx.apiKey,
      LANDING_TABLE_IDS.landingPageTabs,
      tabsToCreate.map((t) => ({ fields: t.fields })),
      LANDING_BASE_ID,
    );
    tabsToCreate.forEach((t, i) => {
      if (created[i]) tabIdByClientIndex[t.clientIndex] = created[i].id;
    });
  }

  let downloadsCreated = 0;
  let downloadsUpdated = 0;
  let downloadsDeleted = 0;

  if (transformed.downloads.length > 0) {
    validateDownloadRefs({
      downloads: transformed.downloads,
      tabIdByClientIndex,
      recordId,
      context: 'update',
    });
  }

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

    const existingTabRecord = stateTab.recordId ? existingTabsById.get(stateTab.recordId) : undefined;
    const existingDlIds: string[] =
      (existingTabRecord?.fields['download_ids'] as string[] | undefined) ?? [];
    const stateDlRecordIds = new Set(
      stateTab.downloads.map((d) => d.recordId).filter((id): id is string => !!id),
    );

    const dlToPatch: Array<{ id: string; fields: Record<string, unknown> }> = [];
    const dlToCreate: Array<{ fields: Record<string, unknown> }> = [];

    for (const dl of downloadsByTabIndex.get(i) ?? []) {
      if (dl._recordId && existingDlIds.includes(dl._recordId)) {
        dlToPatch.push({ id: dl._recordId, fields: dl.fields });
      } else {
        dlToCreate.push({ fields: { ...dl.fields, tab_ids: [tabAirtableId] } });
      }
    }

    const dlToDelete = existingDlIds.filter((id) => !stateDlRecordIds.has(id));
    if (dlToDelete.length > 0) {
      await deleteRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageDownloads, dlToDelete, LANDING_BASE_ID);
      downloadsDeleted += dlToDelete.length;
    }
    if (dlToPatch.length > 0) {
      await updateRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageDownloads, dlToPatch, LANDING_BASE_ID);
      downloadsUpdated += dlToPatch.length;
    }
    if (dlToCreate.length > 0) {
      await createRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageDownloads, dlToCreate, LANDING_BASE_ID);
      downloadsCreated += dlToCreate.length;
    }
  }

  return {
    recordId,
    tabCount: state.tabs.length,
    tabsCreated: tabsToCreate.length,
    tabsUpdated: tabsToPatch.length,
    tabsDeleted: tabIdsToDelete.length,
    downloadsCreated,
    downloadsUpdated,
    downloadsDeleted,
  };
}


export async function landingDelete(recordId: string, ctx: { apiKey: string }): Promise<void> {
  const lp = await getRecord(ctx.apiKey, LANDING_TABLE_IDS.landingPages, recordId, LANDING_BASE_ID);
  const tabIds = (lp.fields['tab_ids'] as string[] | undefined) ?? [];

  const downloadIds = new Set<string>();
  if (tabIds.length > 0) {
    const formula = `OR(${tabIds.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    const tabs = await listRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageTabs, {
      filterByFormula: formula,
      baseId: LANDING_BASE_ID,
      fields: ['download_ids'],
    });
    for (const tab of tabs) {
      const ids = (tab.fields['download_ids'] as string[] | undefined) ?? [];
      ids.forEach((id) => downloadIds.add(id));
    }
  }

  if (downloadIds.size > 0) {
    await deleteRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageDownloads, [...downloadIds], LANDING_BASE_ID);
  }
  if (tabIds.length > 0) {
    await deleteRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPageTabs, tabIds, LANDING_BASE_ID);
  }
  await deleteRecords(ctx.apiKey, LANDING_TABLE_IDS.landingPages, [recordId], LANDING_BASE_ID);
}
