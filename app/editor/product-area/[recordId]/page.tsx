import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageTypeBuilder from '@/components/shared/builder/PageTypeBuilder';
import { productAreaUI } from '@/lib/page-types/product-area.ui';
import { loadProductAreaState } from '@/lib/product-area-loader';
import { ProductAreaState } from '@/lib/product-area-types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ recordId: string }>;
}

export default async function EditProductAreaPage({ params }: Props) {
  const { recordId } = await params;
  const apiKey = process.env.AIRTABLE_API_KEY;

  if (!apiKey) {
    return (
      <ErrorScreen
        title="Konfigurationsfel"
        message="AIRTABLE_API_KEY saknas i miljövariablerna."
      />
    );
  }

  let state: ProductAreaState;
  try {
    state = await loadProductAreaState(apiKey, recordId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel';
    if (/not found|404/i.test(message)) notFound();
    return <ErrorScreen title="Kunde inte hämta sidan" message={message} />;
  }

  return (
    <PageTypeBuilder
      uiDef={productAreaUI}
      initialState={state}
      mode="edit"
      recordId={recordId}
      apiPath="/api/product-area"
      editPath="/editor/product-area/:recordId"
    />
  );
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white" style={{ fontFamily: 'var(--font-dm-sans)' }}>
      <div className="max-w-md text-center px-8">
        <h1 className="text-xl font-medium text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <Link
          href="/"
          className="inline-block text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Tillbaka till sidor
        </Link>
      </div>
    </div>
  );
}
