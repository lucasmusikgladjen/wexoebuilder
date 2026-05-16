/**
 * Back-compat alias for the old Landing Page publish endpoint.
 *
 * The Landing editor now saves via /api/landing, which is driven by the
 * page-type route factory. This endpoint accepts the old POST shape and
 * delegates to the same Landing actions for any older clients still calling
 * /api/publish.
 */

import { NextResponse } from 'next/server';
import { PageState } from '@/lib/types';
import { landingCreate, landingUpdate } from '@/lib/page-types/landing-actions';
import { invalidateWexoeCoreCache } from '@/lib/wexoe-cache';
import { getPageType } from '@/lib/page-types/registry';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

export async function POST(request: Request) {
  if (!AIRTABLE_API_KEY) {
    return NextResponse.json({ error: 'AIRTABLE_API_KEY ej konfigurerad.' }, { status: 500 });
  }

  try {
    const state = (await request.json()) as PageState;
    if (!state.slug?.trim()) return NextResponse.json({ error: 'Slug är obligatoriskt' }, { status: 400 });
    if (!state.h1?.trim()) return NextResponse.json({ error: 'H1 (rubrik) är obligatoriskt' }, { status: 400 });

    if (state.recordId) {
      const result = await landingUpdate(state.recordId, state, { apiKey: AIRTABLE_API_KEY });
      await invalidateWexoeCoreCache(getPageType('landing').cacheEntities, 'publish:update');
      return NextResponse.json({ success: true, mode: 'update', ...result, slug: state.slug });
    }

    const result = await landingCreate(state, { apiKey: AIRTABLE_API_KEY });
    await invalidateWexoeCoreCache(getPageType('landing').cacheEntities, 'publish:create');
    return NextResponse.json({ success: true, mode: 'create', ...result, slug: state.slug }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel';
    console.error('[publish] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
