import { notFound } from 'next/navigation';
import { getRecord, SSOT_BASE_ID } from '@/lib/airtable';
import PageTypeBuilder from '@/components/shared/builder/PageTypeBuilder';
import { uniquePageUI } from '@/lib/page-types/unique-page.ui';
import { uniquePageStateFromRecord, UNIQUE_PAGES_TABLE_ID } from '@/lib/unique-page-mapper';

export const dynamic = 'force-dynamic';

export default async function EditUniquePage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return <main className="p-8 text-sm text-red-600">AIRTABLE_API_KEY ej konfigurerad.</main>;
  }
  let rec;
  try {
    rec = await getRecord(apiKey, UNIQUE_PAGES_TABLE_ID, recordId, SSOT_BASE_ID);
  } catch {
    notFound();
  }
  if (!rec) notFound();
  const state = uniquePageStateFromRecord(rec);
  return (
    <PageTypeBuilder
      uiDef={uniquePageUI}
      initialState={state}
      mode="edit"
      recordId={recordId}
      apiPath="/api/unique-page"
      editPath="/editor/unique/:recordId"
    />
  );
}
