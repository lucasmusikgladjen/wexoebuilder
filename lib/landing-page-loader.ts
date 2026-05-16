import { getRecord, listRecords, AirtableRecord } from './airtable';
import { AIRTABLE_FAMILIES } from './airtable-registry';
import { pageStateFromRecords } from './page-mapper';
import { PageState } from './types';

const LANDING_BASE_ID = AIRTABLE_FAMILIES.landing.baseId;
const LANDING_TABLE_IDS = AIRTABLE_FAMILIES.landing.tables;

export async function loadLandingPageState(apiKey: string, recordId: string): Promise<PageState> {
  const lp = await getRecord(apiKey, LANDING_TABLE_IDS.landingPages, recordId, LANDING_BASE_ID);

  const tabIds = (lp.fields['tab_ids'] as string[] | undefined) ?? [];
  let tabs: AirtableRecord[] = [];
  if (tabIds.length > 0) {
    const formula = `OR(${tabIds.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    tabs = await listRecords(apiKey, LANDING_TABLE_IDS.landingPageTabs, {
      filterByFormula: formula,
      baseId: LANDING_BASE_ID,
    });
  }

  const downloadIds = new Set<string>();
  for (const tab of tabs) {
    const ids = (tab.fields['download_ids'] as string[] | undefined) ?? [];
    ids.forEach((id) => downloadIds.add(id));
  }

  let downloads: AirtableRecord[] = [];
  if (downloadIds.size > 0) {
    const formula = `OR(${[...downloadIds].map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    downloads = await listRecords(apiKey, LANDING_TABLE_IDS.landingPageDownloads, {
      filterByFormula: formula,
      baseId: LANDING_BASE_ID,
    });
  }

  const downloadsByTabId: Record<string, AirtableRecord[]> = {};
  for (const dl of downloads) {
    const tabRefs = (dl.fields['tab_ids'] as string[] | undefined) ?? [];
    for (const tabId of tabRefs) (downloadsByTabId[tabId] ??= []).push(dl);
  }

  return pageStateFromRecords({ landingPage: lp, tabs, downloadsByTabId });
}
