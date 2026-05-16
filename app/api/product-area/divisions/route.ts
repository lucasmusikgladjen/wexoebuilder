/**
 * Product-area divisions list.
 *
 * Product Area är migrerad till Wexoe NY och `PA_TABLE_IDS.divisions` pekar
 * på `core_divisions`. Endpointen finns kvar som tunn klientvänlig wrapper
 * runt loadDivisions() för SettingsEditor.
 */

import { NextResponse } from 'next/server';
import { loadDivisions } from '@/lib/product-area-loader';

export async function GET() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'AIRTABLE_API_KEY ej konfigurerad.' }, { status: 500 });
  }
  try {
    const divisions = await loadDivisions(apiKey);
    return NextResponse.json({ success: true, divisions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hämtning misslyckades.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
