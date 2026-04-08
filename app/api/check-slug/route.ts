import { NextResponse } from 'next/server';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appXoUcK68dQwASjF';
const TABLE_ID = 'tbl8KDqGq0Ray1uqS';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Slug saknas' }, { status: 400 });
  }
  if (!AIRTABLE_API_KEY) {
    return NextResponse.json({ error: 'AIRTABLE_API_KEY ej konfigurerad' }, { status: 500 });
  }

  const formula = encodeURIComponent(`{Slug}="${slug}"`);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${formula}&fields[]=Slug&maxRecords=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Airtable-fel vid slug-kontroll' }, { status: 500 });
  }

  const data = await res.json();
  const exists = Array.isArray(data.records) && data.records.length > 0;

  return NextResponse.json({ exists });
}
